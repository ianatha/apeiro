package ecmatime

//go:generate go run ./build --in index.ts --out ecmatime.js

import (
	_ "embed"

	"go.kuoruan.net/v8go-polyfills/base64"
	"go.kuoruan.net/v8go-polyfills/console"
	"go.kuoruan.net/v8go-polyfills/fetch"
	"go.kuoruan.net/v8go-polyfills/timers"
	"go.kuoruan.net/v8go-polyfills/url"
	"rogchap.com/v8go"
)

//go:embed ecmatime.js
var ECMATIME string

//go:embed polyfill.js
var polyfill string

var OBJECT_NAME = "$apeiro"

func NewEcmatimeWithOptionalEcmatime(iso *v8go.Isolate, pid string, includeEcmatime bool) *v8go.Context {
	global := v8go.NewObjectTemplate(iso)
	if err := base64.InjectTo(iso, global); err != nil {
		panic(err)
	}
	if err := fetch.InjectTo(iso, global); err != nil {
		panic(err)
	}
	if err := timers.InjectTo(iso, global); err != nil {
		panic(err)
	}

	ctx := v8go.NewContext(iso, global)
	if err := console.InjectTo(ctx, console.WithOutput(WriterToZerolog{
		pid: pid,
	})); err != nil {
		panic(err)
	}
	if err := url.InjectTo(ctx); err != nil {
		panic(err)
	}

	_, err := ctx.RunScript(polyfill, "<polyfill>")
	if err != nil {
		panic(err)
	}

	if includeEcmatime {
		_, err := ctx.RunScript(ECMATIME, "<ecmatime>")
		if err != nil {
			panic(err)
		}
	}

	return ctx
}

func NewEcmatime(iso *v8go.Isolate, pid string) *v8go.Context {
	return NewEcmatimeWithOptionalEcmatime(iso, pid, true)
}
