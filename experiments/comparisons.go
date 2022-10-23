package main

import (
	"testing"

	"rogchap.com/v8go"
)

func TestFunctionHttpBinding(t *testing.T) {
	// mount a simple function with http bindings
	// $fnid = POST /mount {src:""}
	// spawn that function
	// POST /spawn {fn: $fnid}
	// send it three numberr
	// POST /$fn/send {msg: 1}
	// POST /$fn/send {msg: 2}
	// POST /$fn/send {msg: 3}
	// GET /$fn/val == 6
}
func TestSimpleScript(t *testing.T) {
	source := "const multiply = (a, b) => a * b"
	iso1 := v8go.NewIsolate()                                                         // creates a new JavaScript VM
	ctx1 := v8go.NewContext(iso1)                                                     // new context within the VM
	script1, _ := iso1.CompileUnboundScript(source, "math.js", v8go.CompileOptions{}) // compile script to get cached data
	script1.Run(ctx1)

	cachedData := script1.CreateCodeCache()

	iso2 := v8go.NewIsolate()                                                                               // create a new JavaScript VM
	ctx2 := v8go.NewContext(iso2)                                                                           // new context within the VM
	script2, _ := iso2.CompileUnboundScript(source, "math.js", v8go.CompileOptions{CachedData: cachedData}) // compile script in new isolate with cached data
	script2.Run(ctx2)

	val, _ := ctx2.RunScript("multiply(3, 4)", "main.js") // execute script in new context
	if val.Number() != 12 {
		t.Fail()
	}
}

func BenchmarkUncompiledScript(b *testing.B) {
	source := "const multiply = (a, b) => a * b"

	for i := 0; i < b.N; i++ {
		iso1 := v8go.NewIsolate()     // creates a new JavaScript VM
		ctx1 := v8go.NewContext(iso1) // new context within the VM
		ctx1.RunScript(source, "math.js")
		val, _ := ctx1.RunScript("multiply(3, 4)", "main.js")
		if val.Number() != 12 {
			b.Fail()
		}
		ctx1.Close()
		iso1.Dispose()
	}
}

func BenchmarkCompiledScript(b *testing.B) {
	source := "const multiply = (a, b) => a * b"
	iso1 := v8go.NewIsolate()                                                         // creates a new JavaScript VM
	ctx1 := v8go.NewContext(iso1)                                                     // new context within the VM
	script1, _ := iso1.CompileUnboundScript(source, "math.js", v8go.CompileOptions{}) // compile script to get cached data
	script1.Run(ctx1)

	cachedData := script1.CreateCodeCache()

	ctx1.Close()
	iso1.Dispose()

	for i := 0; i < b.N; i++ {
		iso2 := v8go.NewIsolate()                                                                               // create a new JavaScript VM
		ctx2 := v8go.NewContext(iso2)                                                                           // new context within the VM
		script2, _ := iso2.CompileUnboundScript(source, "math.js", v8go.CompileOptions{CachedData: cachedData}) // compile script in new isolate with cached data
		script2.Run(ctx2)

		val, _ := ctx2.RunScript("multiply(3, 4)", "main.js") // execute script in new context
		if val.Number() != 12 {
			b.Fail()
		}
		ctx2.Close()
		iso2.Dispose()
	}
}
