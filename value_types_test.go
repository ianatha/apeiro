package apeiro

import (
	"testing"

	"github.com/stretchr/testify/assert"
	"rogchap.com/v8go"
)

func TestValueTypes(t *testing.T) {
	iso := v8go.NewIsolate()
	ctx := v8go.NewContext(iso)
	defer ctx.Close()
	defer iso.Dispose()

	v, _ := ctx.RunScript("let s = 'hello'; s", "script.js")
	assert.ElementsMatch(t, []string{"name", "string"}, ValueType(v))

	v, _ = ctx.RunScript("'hello'", "script.js")
	assert.ElementsMatch(t, []string{"name", "string"}, ValueType(v))

	v, _ = ctx.RunScript("123", "script.js")
	assert.ElementsMatch(t, []string{"int32", "uint32", "number"}, ValueType(v))

	v, _ = ctx.RunScript("function fn() { return 'test'; }; fn", "script.js")
	assert.ElementsMatch(t, []string{"function", "object"}, ValueType(v))

	v, _ = ctx.RunScript("[1, 2, 3, 4]", "script.js")
	assert.ElementsMatch(t, []string{"array", "object"}, ValueType(v))

	v, _ = ctx.RunScript("['abc', 'def']", "script.js")
	assert.ElementsMatch(t, []string{"array", "object"}, ValueType(v))

	ctx.Close()
	iso.Dispose()
}
