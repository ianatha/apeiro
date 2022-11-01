package runtime

import (
	"context"
	"database/sql"
	"fmt"
	"os"
	"strings"
	"sync"

	"github.com/apeiromont/apeiro/compiler"
	"github.com/apeiromont/apeiro/ecmatime"
	"github.com/goccy/go-json"
	_ "github.com/mattn/go-sqlite3"

	// ulid "github.com/oklog/ulid/v2"
	"github.com/rs/zerolog"
	"github.com/rs/zerolog/log"
	"rogchap.com/v8go"
)

type ApeiroRuntime struct {
	isolates             *sync.Pool
	db                   *sql.DB
	scheduleForExecution chan *ForExecution
	terminate            chan bool
	watchers             *sync.Map
}

type ForExecution struct {
	pid string
	msg *string
}

func NewApeiroRuntime(database string) (*ApeiroRuntime, error) {
	log.Logger = log.Output(zerolog.ConsoleWriter{Out: os.Stderr})
	isolates := &sync.Pool{
		New: func() any {
			return v8go.NewIsolate()
		},
	}

	db, err := sql.Open("sqlite3", database)
	if err != nil {
		return nil, err
	}

	err = initializeDatabase(db)
	if err != nil {
		return nil, err
	}

	return &ApeiroRuntime{
		isolates:             isolates,
		db:                   db,
		scheduleForExecution: make(chan *ForExecution, 100),
		terminate:            make(chan bool),
		watchers:             &sync.Map{},
	}, nil
}

func (a *ApeiroRuntime) Start() {
	go func() {
		for {
			select {
			case forExecution := <-a.scheduleForExecution:
				log.Debug().
					Str("pid", forExecution.pid).
					Str("msg", fmt.Sprintf("%v", nullString(forExecution.msg))).
					Msg("executing")
				a.execute(forExecution.pid, forExecution.msg)
			case <-a.terminate:
				return
			}
		}
	}()
}

func (a *ApeiroRuntime) HasPending() bool {
	return len(a.scheduleForExecution) > 0
}

func (a *ApeiroRuntime) Stop() {
	a.terminate <- true
}

func nullString(s *string) string {
	if s == nil {
		return ""
	} else {
		return *s
	}
}

func (a *ApeiroRuntime) execute(pid string, msg *string) {
	row := a.db.QueryRow("SELECT mount.src, process.frame FROM mount RIGHT JOIN process ON process.mid = mount.mid WHERE process.pid = ?", strings.TrimPrefix(pid, "pid_"))

	var src string
	var previousFrame *string

	// id := ulid.Make()

	switch err := row.Scan(&src, &previousFrame); err {
	case sql.ErrNoRows:
		log.Error().Str("pid", pid).Msg("no process with pid")
		return
	case nil:
		// fmt.Printf("executing %s\n", id)
		err := a.stepProcess(pid, src, nullString(previousFrame), nullString(msg))
		if err != nil {
			a.triggerWatchersError(pid, err)
			// fmt.Printf("error %s\n", id)
			log.Error().Str("pid", pid).Msgf("error %v", err)
			return
		}
		// fmt.Printf("success %s\n", id)
		a.triggerWatchersSuccess(pid)
	default:
		panic(err)
	}

	return
}

func initializeDatabase(db *sql.DB) error {
	_, err := db.Exec("CREATE TABLE IF NOT EXISTS mount (mid INTEGER PRIMARY KEY, original_src TEXT, src TEXT, compiled_src BLOB, name TEXT)")
	if err != nil {
		return err
	}
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS process (pid INTEGER PRIMARY KEY, mid INTEGER, frame BLOB, result BLOB, awaiting BLOB)")
	if err != nil {
		return err
	}
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS mbox (msgid INTEGER PRIMARY KEY, pid INTEGER, msg BLOB)")
	return err
}

func (a *ApeiroRuntime) Close() error {
	a.isolates.New = nil

	for isolate := a.isolates.Get(); isolate != nil; {
		isolate.(*v8go.Isolate).Dispose()
	}

	err := a.db.Close()
	return err
}

type Overview struct {
	NumMounts    int
	NumInstances int
	NumAlerts    int
}

func GetSingleNumber(db *sql.DB, query string, args ...interface{}) int {
	row := db.QueryRow(query, args...)
	var r int
	err := row.Scan(&r)
	if err != nil {
		return 0
	}
	return r
}

func (a *ApeiroRuntime) GetOverview() *Overview {
	return &Overview{
		NumMounts:    GetSingleNumber(a.db, "SELECT COUNT(*) FROM mount"),
		NumInstances: GetSingleNumber(a.db, "SELECT COUNT(*) FROM process"),
		NumAlerts:    0,
	}
}

type MountListEntry struct {
	Mid  string
	Name string
}

func (a *ApeiroRuntime) Mounts() ([]MountListEntry, error) {
	rows, err := a.db.Query("SELECT mid, name FROM mount")
	if err != nil {
		return []MountListEntry{}, err
	}
	defer rows.Close()

	result := []MountListEntry{}
	for rows.Next() {
		var r MountListEntry
		err = rows.Scan(&r.Mid, &r.Name)
		if err != nil {
			return []MountListEntry{}, err
		}
		result = append(result, r)
	}
	return result, nil
}

type MountOverview struct {
	Name   string   `json:"name,omitempty"`
	Mid    string   `json:"mid,omitempty"`
	Src    string   `json:"src,omitempty"`
	Procs  []string `json:"procs,omitempty"`
	RunSrc string   `json:"src_run,omitempty"`
}

func (a *ApeiroRuntime) GetMountOverview(mid string) (*MountOverview, error) {
	mid = strings.TrimPrefix(strings.TrimPrefix(mid, "mid_"), "src_")

	row, err := a.db.Query("SELECT mount.name, mount.mid, original_src, process.pid, mount.src FROM mount LEFT JOIN process ON process.mid = mount.mid WHERE mount.mid = ?", mid)
	if err != nil {
		return nil, err
	}

	var r MountOverview
	for row.Next() {
		var pid *string
		err = row.Scan(&r.Name, &r.Mid, &r.Src, &pid, &r.RunSrc)
		if err != nil {
			return nil, err
		}
		if pid != nil {
			r.Procs = append(r.Procs, *pid)
		}
	}
	return &r, nil
}

type ProcessStatus struct {
	Pid     string `json:"pid,omitempty"`
	Mid     string `json:"mid,omitempty"`
	MidName string `json:"mid_name,omitempty"`
}

func (a *ApeiroRuntime) Processes() (*[]ProcessStatus, error) {
	rows, err := a.db.Query("SELECT pid, mount.mid, mount.name FROM process RIGHT JOIN mount ON process.mid = mount.mid")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	result := []ProcessStatus{}
	for rows.Next() {
		var r ProcessStatus
		err = rows.Scan(&r.Pid, &r.Mid, &r.MidName)
		if err != nil {
			return nil, err
		}
		result = append(result, r)
	}
	return &result, nil
}

func (a *ApeiroRuntime) MountUpdate(mid string, src *string, name *string) (string, error) {
	mid = strings.TrimPrefix(mid, "mid_")

	previousState, err := a.GetMountOverview(mid)
	if err != nil {
		return "", err
	}

	var newSrc []byte
	var newRunSrc []byte
	if src != nil {
		compiledSource, err := compiler.CompileTypescript([]byte(*src))
		log.Info().Str("compiledSource", string(compiledSource))
		if err != nil {
			return "", err
		}
		newSrc = []byte(*src)
		newRunSrc = compiledSource
	} else {
		newSrc = []byte(previousState.Src)
		newRunSrc = []byte(previousState.RunSrc)
	}

	var newName string
	if name != nil {
		newName = *name
	} else {
		newName = previousState.Name
	}

	_, err = a.db.Exec("UPDATE mount SET original_src = ?, src = ?, name = ? WHERE mid = ?", newSrc, newRunSrc, newName, mid)
	if err != nil {
		return "", err
	}

	_, err = a.db.Exec("UPDATE process SET frame=NULL, result=NULL, awaiting=NULL WHERE mid = ?", mid)
	if err != nil {
		return "", err
	}

	for _, pid := range previousState.Procs {
		_, err := a.run(pid, nil, false)
		if err != nil {
			return "", err
		}
	}

	return fmt.Sprintf("mid_%s", mid), nil
}

func (a *ApeiroRuntime) Mount(src []byte, name string) (string, error) {
	compiledSource, err := compiler.CompileTypescript(src)
	log.Info().Str("compiledSource", string(compiledSource))
	if err != nil {
		return "", err
	}

	res, err := a.db.Exec("INSERT INTO mount (original_src, src, name) VALUES (?, ?, ?)", src, compiledSource, name)
	if err != nil {
		return "", err
	}
	lastInsertId, err := res.LastInsertId()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("src_%d", lastInsertId), nil
}

func (a *ApeiroRuntime) SpawnAndWatch(mid string) (string, chan *WatchEvent, error) {
	return a.spawn(mid, true)
}

func (a *ApeiroRuntime) Spawn(mid string) (string, error) {
	pid, _, err := a.spawn(mid, false)
	return pid, err
}

func (a *ApeiroRuntime) Supply(pid string, msg string) error {
	pid = strings.TrimPrefix(pid, "pid_")
	log.Debug().Str("pid", pid).Str("msg", msg).Msg("Supplying")
	_, err := a.run(pid, &msg, false)
	return err
}

func (a *ApeiroRuntime) SupplyAndWatch(pid string, msg string) (chan *WatchEvent, error) {
	pid = strings.TrimPrefix(pid, "pid_")
	watcher, err := a.run(pid, &msg, true)
	return watcher, err
}

func (a *ApeiroRuntime) run(pid string, msg *string, watch bool) (chan *WatchEvent, error) {
	pid = strings.TrimPrefix(pid, "pid_")
	var watcher chan *WatchEvent
	if watch {
		var err error
		watcher, err = a.Watch(context.Background(), pid)
		if err != nil {
			return nil, err
		}
	}

	a.scheduleForExecution <- &ForExecution{
		pid: pid,
		msg: msg,
	}

	return watcher, nil
}

func (a *ApeiroRuntime) spawn(mid string, watch bool) (string, chan *WatchEvent, error) {
	mountId := strings.TrimPrefix(mid, "src_")
	res, err := a.db.Exec("INSERT INTO process (mid) VALUES (?)", mountId)
	if err != nil {
		return "", nil, err
	}
	lastInsertId, err := res.LastInsertId()
	if err != nil {
		return "", nil, err
	}
	pid := fmt.Sprintf("pid_%d", lastInsertId)

	watcher, err := a.run(pid, nil, watch)
	return pid, watcher, err
}

type ProcessExternalState struct {
	Pid     string      `json:"pid,omitempty"`
	Mid     string      `json:"mid,omitempty"`
	Val     interface{} `json:"val,omitempty"`
	Waiting interface{} `json:"waiting,omitempty"`
	Fin     bool        `json:"fin,omitempty"`
}

func (a *ApeiroRuntime) GetProcessValue(pid string) (*ProcessExternalState, error) {
	row := a.db.QueryRow("SELECT mid, result, awaiting FROM process WHERE pid = ?", strings.TrimPrefix(pid, "pid_"))
	var resBytes []byte
	var awaitingBytes []byte
	var mid string

	switch err := row.Scan(&mid, &resBytes, &awaitingBytes); err {
	case sql.ErrNoRows:
		return nil, fmt.Errorf("no process with pid %s", pid)
	case nil:
		var res interface{}
		var awaiting interface{}
		json.Unmarshal(resBytes, &res)
		json.Unmarshal(awaitingBytes, &awaiting)
		return &ProcessExternalState{
			Pid:     pid,
			Mid:     "mid_" + mid,
			Val:     res,
			Waiting: awaiting,
		}, nil
	default:
		panic(err)
	}
}

type EventProcessMeta struct {
	log string
}

/*
Returns a new context at has:
* the PristineRuntime at $apeiro
* the process at $fn
*/
func (a *ApeiroRuntime) newProcessContext(iso *v8go.Isolate, pid string, src string) (*v8go.Context, chan *EventProcessMeta, error) {
	metaChan := make(chan *EventProcessMeta, 1)

	ctx := ecmatime.NewEcmatime(iso, pid)

	_, err := ctx.RunScript(src, "your_function.js")
	if err != nil {
		return nil, nil, err
	}

	return ctx, metaChan, nil
}

func getModuleFunction(global *v8go.Object, module string, function string) (*v8go.Function, error) {
	valImportedModule, err := global.Get(module)
	if err != nil {
		return nil, err
	}
	importedModule, err := valImportedModule.AsObject()
	if err != nil {
		return nil, err
	}
	valFunction, err := importedModule.Get(function)
	if err != nil {
		return nil, err
	}
	result, err := valFunction.AsFunction()
	if err != nil {
		return nil, err
	}
	return result, nil
}

type StepResult struct {
	frame    string
	result   []byte
	awaiting []byte
}

func (a *ApeiroRuntime) stepResultFromV8Value(jsStepResult *v8go.Value) *StepResult {
	stepResult, err := jsStepResult.AsObject()
	if err != nil {
		panic(err)
	}

	// frame
	jsFrame, err := stepResult.GetIdx(0)
	if err != nil {
		panic(err)
	}
	frame := jsFrame.String()

	// result
	jsResult, err := stepResult.GetIdx(1)
	if err != nil {
		panic(err)
	}

	result, err := jsResult.MarshalJSON()
	if err != nil {
		panic(err)
	}

	// awaiting
	jsAwaiting, err := stepResult.GetIdx(2)
	if err != nil {
		panic(err)
	}
	var awaiting []byte
	if jsAwaiting.IsObject() {
		awaiting, err = jsAwaiting.Object().MarshalJSON()
		if err != nil {
			panic(err)
		}
	}

	return &StepResult{
		frame:    frame,
		result:   result,
		awaiting: awaiting,
	}
}

type ApeiroStepError struct {
	Message           string
	Location          string
	StackTrace        string
	LastFetchReq      string
	LastFetchRespJson string
}

func apeiroerror(format string, a ...any) *ApeiroStepError {
	return &ApeiroStepError{
		Message: fmt.Sprintf(format, a...),
	}
}
func (a *ApeiroRuntime) stepProcess(pid string, src string, previousFrame string, newMsg string) *ApeiroStepError {
	pid = strings.TrimPrefix(pid, "pid_")
	pid = "pid_" + pid

	iso := a.isolates.Get().(*v8go.Isolate)

	ctx, _, err := a.newProcessContext(iso, pid, src)
	if err != nil {
		return apeiroerror("couldn't create process context: %v", err)
	}

	global := ctx.Global()
	function, err := getModuleFunction(global, "$fn", "default")
	if err != nil {
		return apeiroerror("couldn't find $fn.default: %v", err)
	}
	apeiroStep, err := getModuleFunction(global, ecmatime.OBJECT_NAME, "step")
	if err != nil {
		return apeiroerror("couldn't find $apeiro.step: %v", err)
	}

	apeiroRunResultChan := make(chan *StepResult, 1)
	apeiroRunErrorChan := make(chan *ApeiroStepError, 1)

	go func() {
		jsPreviousFrame, err := v8go.NewValue(iso, previousFrame)
		if err != nil {
			panic(err)
		}
		jsNewMsg, err := v8go.NewValue(iso, newMsg)
		if err != nil {
			panic(err)
		}

		log.Debug().Str("pid", pid).Msg("running step")
		jsPid, err := v8go.NewValue(iso, pid)
		if err != nil {
			log.Debug().Str("pid", pid).Msg("coudln't create pid value in JS")
			apeiroRunErrorChan <- &ApeiroStepError{
				Message: "could not create PID value in JS",
			}
			return
		}

		jsStepResult, err := apeiroStep.Call(v8go.Null(iso), jsPid, function, jsPreviousFrame, jsNewMsg)
		if err != nil {
			apeiroRunErrorChan <- &ApeiroStepError{
				Message: err.Error(),
			}
			return
		}

		jsStepResultPromise, err := jsStepResult.AsPromise()
		if err != nil {
			apeiroRunErrorChan <- &ApeiroStepError{
				Message: err.Error(),
			}
			return
		}

		log.Debug().Str("pid", pid).Msg("waiting for step result promise")
		jsStepResultPromise.Then(func(info *v8go.FunctionCallbackInfo) *v8go.Value {
			log.Debug().Str("pid", pid).Msg("step promise, succeeded")
			apeiroRunResultChan <- a.stepResultFromV8Value(info.Args()[0])
			return v8go.Undefined(info.Context().Isolate())
		}, func(info *v8go.FunctionCallbackInfo) *v8go.Value {
			e := info.Args()[0]
			es, _ := e.Object().MethodCall("toString")
			stack, _ := e.Object().Get("stack")

			log.Debug().Str("pid", pid).Str("errorToString", es.String()).Str("errorStack", stack.String()).Msg("step promise, rejected")

			v1, _ := e.Context().Global().Get("$last_fetch_req")
			v2, _ := e.Context().Global().Get("$last_fetch_resp")

			errobj := &ApeiroStepError{
				Message:           es.String(),
				Location:          stack.String(),
				StackTrace:        stack.String(),
				LastFetchReq:      v1.String(),
				LastFetchRespJson: v2.String(),
			}

			apeiroRunErrorChan <- errobj
			return v8go.Undefined(info.Context().Isolate())
		})

		ctx.PerformMicrotaskCheckpoint()
		log.Debug().Str("pid", pid).Msg("PerformMicrotaskCheckpoint")
		fmt.Printf("goland done with microtask checkpoint\n")
	}()

	// TODO: add timer
	for {
		select {
		// case meta := <-meta:
		// fmt.Printf("meta: %v\n", meta)
		case err := <-apeiroRunErrorChan:
			log.Error().
				Str("error", err.Message).
				Str("loc", err.Location).
				Str("trace", err.StackTrace).
				Str("last_fetch_req", err.LastFetchReq).
				Str("last_fetch_resp", err.LastFetchRespJson).
				Msg("error in apeiro step")

			// TODO: set the error in the database

			fmt.Printf("closing isolate\n")
			ctx.Close()
			a.isolates.Put(iso)

			// fmt.Printf("error: %v\n", err)
			// fmt.Printf("error: %v\n", err.Location)
			// fmt.Printf("error: %v\n", err.StackTrace)
			return err
		case result := <-apeiroRunResultChan:
			log.Info().
				Str("FrameSize", result.frame).
				Str("Result", string(result.result)).
				Str("Awaiting", string(result.awaiting)).
				Msg("apeiro step result")
			update, err := a.db.Exec(
				"UPDATE process SET result = $1, frame = $2, awaiting = $3 WHERE pid = $4",
				result.result,
				result.frame,
				result.awaiting,
				strings.TrimPrefix(pid, "pid_"),
			)
			if err != nil {
				return apeiroerror("%v", err.Error())
			}
			rowsAffected, err := update.RowsAffected()
			if err != nil {
				return apeiroerror("%v", err.Error())
			}
			if rowsAffected != 1 {
				return apeiroerror("updated %d rows while setting %s's result", rowsAffected, pid)
			}

			fmt.Printf("closing isolate\n")

			ctx.Close()
			a.isolates.Put(iso)

			return nil

			// if err == nil {
			// 	fmt.Printf("result (json): %v\n", string(resJson))
			// } else {
			// 	fmt.Printf("error: %v\n", err)
			// }
			// fmt.Printf("result (not json): %v\n", result)
			// return nil
		}
	}
}
