package ecmatime

//go:generate go run ./build --in index.ts --out ecmatime.js

//deno bundle --no-check index.ts -- ecmatime.js

import _ "embed"

//go:embed ecmatime.js
var ECMATIME string

var OBJECT_NAME = "$apeiro"
