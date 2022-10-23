package ecmatime

//go:generate go run ./build --in index.ts --out ecmatime.js

//deno bundle --no-check index.ts -- ecmatime.js

import (
	_ "embed"

	"rogchap.com/v8go"
)

//go:embed ecmatime.js
var ECMATIME string

//go:embed polyfill.js
var polyfill string

var OBJECT_NAME = "$apeiro"

func NewEcmatime() *v8go.Context {
	iso := v8go.NewIsolate()
	ctx := v8go.NewContext(iso)

	_, err := ctx.RunScript(polyfill, "<polyfill>")
	if err != nil {
		panic(err)
	}

	return ctx
}
