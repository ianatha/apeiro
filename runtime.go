package apeiro

import (
	"database/sql"
	"fmt"
	"strings"
	"sync"

	"github.com/apeiromont/apeiro/compiler"
	"github.com/apeiromont/apeiro/ecmatime"
	"github.com/goccy/go-json"
	_ "github.com/mattn/go-sqlite3"

	// ulid "github.com/oklog/ulid/v2"
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

func (a *ApeiroRuntime) execute(pid string, msg *string) error {
	row := a.db.QueryRow("SELECT mount.src, process.frame FROM mount RIGHT JOIN process ON process.mid = mount.mid WHERE process.pid = ?", strings.TrimPrefix(pid, "pid_"))

	var src string
	var previousFrame *string

	// id := ulid.Make()

	switch err := row.Scan(&src, &previousFrame); err {
	case sql.ErrNoRows:
		return fmt.Errorf("no process with pid %s", pid)
	case nil:
		// fmt.Printf("executing %s\n", id)
		err := a.stepProcess(pid, src, nullString(previousFrame), nullString(msg))
		if err != nil {
			a.triggerWatchers(pid)
			// fmt.Printf("error %s\n", id)
			log.Error().Str("pid", pid).Msgf("error %v", err)
			return err
		}
		// fmt.Printf("success %s\n", id)
		a.triggerWatchers(pid)
	default:
		panic(err)
	}

	return nil
}

func initializeDatabase(db *sql.DB) error {
	_, err := db.Exec("CREATE TABLE IF NOT EXISTS mount (mid INTEGER PRIMARY KEY, original_src TEXT, src TEXT, compiled_src BLOB)")
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

func (a *ApeiroRuntime) Mount(src []byte) (string, error) {
	compiledSource, err := compiler.CompileTypescript(src)
	log.Info().Str("compiledSource", string(compiledSource))
	if err != nil {
		return "", err
	}

	res, err := a.db.Exec("INSERT INTO mount (original_src, src) VALUES (?, ?)", src, compiledSource)
	if err != nil {
		return "", err
	}
	lastInsertId, err := res.LastInsertId()
	if err != nil {
		return "", err
	}
	return fmt.Sprintf("fn_%d", lastInsertId), nil
}

func (a *ApeiroRuntime) SpawnAndWatch(mid string) (string, chan *WatchEvent, error) {
	return a.spawn(mid, true)
}

func (a *ApeiroRuntime) Spawn(mid string) (string, error) {
	pid, _, err := a.spawn(mid, false)
	return pid, err
}

func (a *ApeiroRuntime) Supply(pid string, msg string) error {
	_, err := a.run(pid, &msg, false)
	return err
}

func (a *ApeiroRuntime) SupplyAndWatch(pid string, msg string) (chan *WatchEvent, error) {
	watcher, err := a.run(pid, &msg, true)
	return watcher, err
}

func (a *ApeiroRuntime) run(pid string, msg *string, watch bool) (chan *WatchEvent, error) {
	var watcher chan *WatchEvent
	if watch {
		var err error
		watcher, err = a.Watch(pid)
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
	mountId := strings.TrimPrefix(mid, "fn_")
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
	Val     interface{} `json:"val,omitempty"`
	Waiting interface{} `json:"waiting,omitempty"`
	Fin     bool        `json:"fin,omitempty"`
}

func (a *ApeiroRuntime) GetProcessValue(pid string) (*ProcessExternalState, error) {
	row := a.db.QueryRow("SELECT result, awaiting FROM process WHERE pid = ?", strings.TrimPrefix(pid, "pid_"))
	var resBytes []byte
	var awaitingBytes []byte

	switch err := row.Scan(&resBytes, &awaitingBytes); err {
	case sql.ErrNoRows:
		return nil, fmt.Errorf("no process with pid %s", pid)
	case nil:
		var res interface{}
		var awaiting interface{}
		json.Unmarshal(resBytes, &res)
		json.Unmarshal(awaitingBytes, &awaiting)
		return &ProcessExternalState{
			Pid:     pid,
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

func stepResultFromV8Value(jsStepResult *v8go.Value) *StepResult {
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

func (a *ApeiroRuntime) stepProcess(pid string, src string, previousFrame string, newMsg string) error {
	iso := a.isolates.Get().(*v8go.Isolate)
	defer a.isolates.Put(iso)

	ctx, _, err := a.newProcessContext(iso, pid, src)
	if err != nil {
		return fmt.Errorf("couldn't create process context: %v", err)
	}
	defer ctx.Close()

	global := ctx.Global()
	function, err := getModuleFunction(global, "$fn", "default")
	if err != nil {
		return fmt.Errorf("couldn't find $fn.default: %v", err)
	}
	apeiroStep, err := getModuleFunction(global, ecmatime.OBJECT_NAME, "step")
	if err != nil {
		return fmt.Errorf("couldn't find $apeiro.step: %v", err)
	}

	apeiroRunResultChan := make(chan *StepResult, 1)
	apeiroRunErrorChan := make(chan *v8go.JSError, 1)

	go func() {
		jsPreviousFrame, err := v8go.NewValue(iso, previousFrame)
		if err != nil {
			panic(err)
		}
		jsNewMsg, err := v8go.NewValue(iso, newMsg)
		if err != nil {
			panic(err)
		}

		jsStepResult, err := apeiroStep.Call(v8go.Null(iso), function, jsPreviousFrame, jsNewMsg)
		if err != nil {
			apeiroRunErrorChan <- err.(*v8go.JSError)
			return
		}

		debug, _ := jsStepResult.MarshalJSON()
		fmt.Printf("val: %v\n\n\n", string(debug))
		apeiroRunResultChan <- stepResultFromV8Value(jsStepResult)
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
				Msg("error in apeiro step")
			// fmt.Printf("error: %v\n", err)
			// fmt.Printf("error: %v\n", err.Location)
			// fmt.Printf("error: %v\n", err.StackTrace)
			return err
		case result := <-apeiroRunResultChan:
			log.Info().
				Int("FrameSize", len(result.frame)).
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
				return err
			}
			rowsAffected, err := update.RowsAffected()
			if err != nil {
				return err
			}
			if rowsAffected != 1 {
				return fmt.Errorf("updated %d rows while setting %s's result", rowsAffected, pid)
			}
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
