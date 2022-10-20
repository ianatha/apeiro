package main

import (
	"fmt"
	"os"

	"github.com/apeiromont/apeiro/v8persistence"
	"github.com/evanw/esbuild/pkg/api"
	"rogchap.com/v8go"
)

func main_compile() {
	source := "const multiply = (a, b) => a * b"
	iso1 := v8go.NewIsolate()                                                         // creates a new JavaScript VM
	ctx1 := v8go.NewContext(iso1)                                                     // new context within the VM
	script1, _ := iso1.CompileUnboundScript(source, "math.js", v8go.CompileOptions{}) // compile script to get cached data
	script1.Run(ctx1)

	cachedData := script1.CreateCodeCache()

	iso2 := v8go.NewIsolate()     // create a new JavaScript VM
	ctx2 := v8go.NewContext(iso2) // new context within the VM

	script2, _ := iso2.CompileUnboundScript(source, "math.js", v8go.CompileOptions{CachedData: cachedData}) // compile script in new isolate with cached data
	script2.Run(ctx2)

	val, _ := ctx2.RunScript("multiply(3, 4)", "main.js") // execute script in new context
	fmt.Printf("%v\n", val)
	fmt.Printf("%v\n", cachedData)
}

func main_exmp() {
	script := "import test from 'test'; export function add(a: number, b: number): number { return a + b; };"
	result := api.Transform(script, api.TransformOptions{
		Loader:            api.LoaderTS,
		Format:            api.FormatIIFE,
		MinifySyntax:      true,
		MinifyWhitespace:  true,
		MinifyIdentifiers: true,
	})
	os.Stdout.Write(result.Code)
	fmt.Printf("%d errors and %d warnings\n",
		len(result.Errors), len(result.Warnings))

	ctx := v8go.NewContext()
	val, err := ctx.RunScript(string(result.Code), "math.mjs")
	if err != nil {
		fmt.Printf("err: %v (%s)\n", err, err)
	} else {
		fmt.Printf("val: %v\n", val)
	}
	objval, err := val.AsObject()
	if err != nil {
		fmt.Printf("err: %v (%s)\n", err, err)
	} else {
		math, _ := objval.Get("math")
		fmt.Printf("valcount: %d\n", math)
	}

	// global, _ := ctx.Global().Get("global")
	// globalObj, _ := global.AsObject()
	// fmt.Println(globalObj.Get("math"))
	val, err = ctx.RunScript("{ class XX { magic() { return 314 } }  class X { b = 100; c = new XX(); up(x) { this.b = x; } a() { return this.b } }; global.b = new X();} var xxx = 123; let x = { a: 123, b: \"test\" }; global.b.up(11); global.b", "main.js")
	if err != nil {
		fmt.Printf("err: %v (%s)\n", err, err)
	} else {
		json, _ := val.MarshalJSON()
		keys := val.Object().GetPropertyNames()
		for _, key := range keys {
			vvv, _ := val.Object().Get(key)
			fmt.Printf("key: %s %v\n", key, vvv)
			fv, _ := vvv.AsObject()
			if fv != nil {
				fmt.Printf("key: %s is object, internalFieldCount: %v\n", key, fv.InternalFieldCount())
			}
		}

		val2, _ := val.Object().Get("__proto__")
		keys2 := val2.Object().GetPropertyNames()
		for _, key := range keys2 {
			vvv, _ := val2.Object().Get(key)
			fmt.Printf("ke222y: %s %v\n", key, vvv)

		}

		internalFieldCount := val.Object().InternalFieldCount()
		fmt.Printf("internal field count: %v\n", internalFieldCount)
		b, err := v8persistence.EncodeValue(val)
		if err != nil {
			panic(err)
		}
		fmt.Printf("msgpack: %v\n", b)
		fmt.Printf("json: %v\n", string(json))

		constructor, err := ctx.RunScript("Object.getPrototypeOf(global.b)", "")
		constructor_real, err := ctx.RunScript("global.b.constructor", "")
		fmt.Printf("constructor: %v - err: %v\n", constructor_real.DetailString(), err)
		fmt.Printf("constructor: %v - err: %v\n", constructor.DetailString(), err)
		// fmt.Printf("last statement has prototype: %v\n", val.Object().GetPrototype() != nil)
		// fmt.Printf("last statement has prototype: %v\n", val.Object().GetPrototype().DetailString())
		// fmt.Printf("last statement has contrstructor: %v\n", val.Object().GetPrototype().DetailString())
		// className := strings.TrimRight(strings.TrimLeft(val.Object().GetPrototype().DetailString(), "#<"), ">")
		classdef := api.Transform("export "+constructor_real.DetailString(), api.TransformOptions{
			Loader:            api.LoaderTS,
			Format:            api.FormatIIFE,
			MinifySyntax:      true,
			MinifyWhitespace:  true,
			MinifyIdentifiers: true,
			GlobalName:        "g",
		})

		fmt.Println(string(classdef.Code))
		code := string(classdef.Code) + "; var c = JSON.parse('" + string(json) + "'); Object.setPrototypeOf(c, g.X.prototype); c"
		fmt.Print(code)
		_, err = ctx.RunScript(code, "")
		if err != nil {
			panic(err)
		}

		v2, err := ctx.RunScript("c.a()", "")
		if err != nil {
			panic(err)
		}
		fmt.Printf("v2= %v", v2)

		// get_test, _ := ctx.Global().Get("xxx")
		// fmt.Printf("global.Test exists? %v\n", get_test)

		// fmt.Printf("val2: %v %v, %s\n", json.IsObject(), string(json2.DetailString()), val.DetailString())
	}

}

// print hello world
func main1() {
	iso := v8go.NewIsolate()
	// global := v8.NewObjectTemplate(iso)

	ctx := v8go.NewContext(iso) // creates a new V8 context with a new Isolate aka VM

	ctx.RunScript("const add = (a, b) => a + b", "math.js") // executes a script on the global context
	ctx.RunScript("const result = add(3, 4)", "main.js")    // any functions previously added to the context can be called
	val, err := ctx.RunScript("result", "value.js")         // return a value in JavaScript back to Go
	if err != nil {
		fmt.Printf("err: %v\n", err)
	} else {
		fmt.Printf("addition result: %s\n", val)
	}
	val, err = ctx.RunScript("Object.keys(console)", "log.js") // execute a script that uses the console.log function
	if err != nil {
		fmt.Printf("err: %v (%s)\n", err, err)
	} else {
		fmt.Printf("res: %v\n", val)
	}
	val, err = ctx.RunScript("import a from 'test'", "log.js") // execute a script that uses the console.log function
	if err != nil {
		fmt.Printf("err: %v (%s)\n", err, err)
	} else {
		fmt.Printf("res: %v\n", val)
	}
}
