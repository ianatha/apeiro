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
	"rogchap.com/v8go"
)

type ApeiroRuntime struct {
	isolates             *sync.Pool
	db                   *sql.DB
	scheduleForExecution chan string
	terminate            chan bool
	watchers             *sync.Map
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
		scheduleForExecution: make(chan string, 100),
		terminate:            make(chan bool),
		watchers:             &sync.Map{},
	}, nil
}

func (a *ApeiroRuntime) Start() {
	go func() {
		for {
			select {
			case pid := <-a.scheduleForExecution:
				a.execute(pid)
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

func (a *ApeiroRuntime) execute(pid string) error {
	row := a.db.QueryRow("SELECT src FROM mount RIGHT JOIN process ON process.mid = mount.mid WHERE process.pid = ?", strings.TrimPrefix(pid, "pid_"))

	var src string

	switch err := row.Scan(&src); err {
	case sql.ErrNoRows:
		return fmt.Errorf("no process with pid %s", pid)
	case nil:
		err := a.stepProcess(pid, src)
		if err != nil {
			a.triggerWatchers(pid)
			return err
		}
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
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS process (pid INTEGER PRIMARY KEY, mid INTEGER, val BLOB)")
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

	var watcher chan *WatchEvent
	if watch {
		watcher, err = a.Watch(pid)
		if err != nil {
			return "", nil, err
		}
	}

	a.scheduleForExecution <- pid

	return pid, watcher, nil
}

func (a *ApeiroRuntime) GetProcessValue(pid string) (string, error) {
	row := a.db.QueryRow("SELECT val FROM process WHERE pid = ?", strings.TrimPrefix(pid, "pid_"))
	var res []byte

	switch err := row.Scan(&res); err {
	case sql.ErrNoRows:
		return "", fmt.Errorf("no process with pid %s", pid)
	case nil:
		return string(res), nil
	default:
		panic(err)
	}
}

func (a *ApeiroRuntime) Send(pid string, msg map[string]interface{}) error {
	msgBytes, err := json.Marshal(msg)
	if err != nil {
		return err
	}
	_, err = a.db.Exec("INSERT INTO mbox (pid, msg) VALUES (?, ?)", pid, msgBytes)
	if err != nil {
		return err
	}
	a.scheduleForExecution <- pid
	return nil
}

type EventProcessMeta struct {
	log string
}

/*
Returns a new context at has:
* the PristineRuntime at $apeiro
* the process at $fn
*/
func (a *ApeiroRuntime) newProcessContext(iso *v8go.Isolate, src string) (*v8go.Context, chan *EventProcessMeta, error) {
	metaChan := make(chan *EventProcessMeta, 1)

	printfn := v8go.NewFunctionTemplate(iso, func(info *v8go.FunctionCallbackInfo) *v8go.Value {

		// metaChan <- &EventProcessMeta{
		// 	log: info.Args()[0].String(),
		// }

		return nil
	})

	global := v8go.NewObjectTemplate(iso)
	global.Set("print", printfn)

	ctx := v8go.NewContext(iso, global)

	_, err := ctx.RunScript(ecmatime.ECMATIME, "pristine_runner.js")
	if err != nil {
		return nil, nil, err
	}

	_, err = ctx.RunScript(src, "pristine_runner.js")
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

func (a *ApeiroRuntime) stepProcess(pid string, src string) error {
	iso := a.isolates.Get().(*v8go.Isolate)
	defer a.isolates.Put(iso)

	ctx, _, err := a.newProcessContext(iso, src)
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

	apeiroRunResultChan := make(chan *v8go.Value, 1)
	apeiroRunErrorChan := make(chan *v8go.JSError, 1)

	go func() {
		val, err := apeiroStep.Call(v8go.Null(iso), function)
		if err != nil {
			apeiroRunErrorChan <- err.(*v8go.JSError)
			return
		}
		apeiroRunResultChan <- val
	}()

	// TODO: add timer
	for {
		select {
		// case meta := <-meta:
		// fmt.Printf("meta: %v\n", meta)
		case err := <-apeiroRunErrorChan:
			// fmt.Printf("error: %v\n", err)
			// fmt.Printf("error: %v\n", err.Location)
			// fmt.Printf("error: %v\n", err.StackTrace)
			return err
		case result := <-apeiroRunResultChan:
			res, err := result.Object().Get("res")
			if err != nil {
				panic(err)
			}
			resJson, err := res.MarshalJSON()
			if err != nil {
				panic(err)
			}
			update, err := a.db.Exec("UPDATE process SET val = $1 WHERE pid = $2", resJson, strings.TrimPrefix(pid, "pid_"))
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
