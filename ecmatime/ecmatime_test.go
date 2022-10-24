package ecmatime

import (
	"fmt"
	"testing"

	_ "embed"

	"github.com/stretchr/testify/assert"
	"rogchap.com/v8go"
)

func arrayDiff(a, b []string) []string {
	mb := make(map[string]struct{}, len(b))
	for _, x := range b {
		mb[x] = struct{}{}
	}
	var diff []string
	for _, x := range a {
		if _, found := mb[x]; !found {
			diff = append(diff, x)
		}
	}
	return diff
}

func WithEcmatime(t *testing.T, fn func(ctx *v8go.Context)) {
	iso := v8go.NewIsolate()
	defer iso.Dispose()
	ctx := NewEcmatime(iso, "test_"+t.Name())
	defer ctx.Close()

	fn(ctx)
}

func JSErrorString(err error) string {
	if jserr, ok := (err).(*v8go.JSError); ok {
		return fmt.Sprintf("%s at %s\n%s", jserr.Message, jserr.Location, jserr.StackTrace)
	}
	return err.Error()
}

func TestEcmatimeExports(t *testing.T) {
	iso := v8go.NewIsolate()
	ctx := NewEcmatimeWithOptionalEcmatime(iso, "test_"+t.Name(), false)

	propertyNamesBefore := ctx.Global().GetOwnPropertyNames()

	_, err := ctx.RunScript(ECMATIME, "<ecmatime>")
	if err != nil {
		t.Error(JSErrorString(err))
	}

	global := ctx.Global()
	propertyNamesAfter := global.GetOwnPropertyNames()

	delta := arrayDiff(propertyNamesAfter, propertyNamesBefore)
	assert.Equal(t, []string{OBJECT_NAME}, delta)

	apeiroModuleVal, err := global.Get(OBJECT_NAME)
	if err != nil {
		t.Error(JSErrorString(err))
	}

	apeiroModule, err := apeiroModuleVal.AsObject()
	if err != nil {
		t.Error(JSErrorString(err))
	}
	assert.Equal(t, []string{"__esModule", "Decoder", "Encoder", "importFunction", "step"}, apeiroModule.GetOwnPropertyNames())

	ctx.Close()
	ctx.Isolate().Dispose()
}

func SerializeState(t *testing.T, script string) string {
	var serialized string
	WithEcmatime(t, func(ctx *v8go.Context) {
		val, err := ctx.RunScript(script, "<SerializeState.script>")
		if err != nil {
			t.Errorf("%+v", err.(*v8go.JSError))
		}
		serialized = val.String()
	})
	return serialized
}

func TestSerializationSimpleObject(t *testing.T) {
	serialized := SerializeState(t, `(new $apeiro.Encoder()).encode({
		str_a: "a", str_b: "b", num_0: 0, bool_true: true
	})`)

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript("var state = (new $apeiro.Decoder()).decode(serialized); state", "<test>")
		if err != nil {
			t.Error(JSErrorString(err))
		}

		a, err := val.Object().Get("str_a")
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, "a", a.String())

		b, err := val.Object().Get("str_b")
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, "b", b.String())

		zero, err := val.Object().Get("num_0")
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, int64(0), zero.Integer())

		bool, err := val.Object().Get("bool_true")
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, true, bool.Boolean())
	})
}

func TestSerializationArray(t *testing.T) {
	serialized := SerializeState(t, `(new $apeiro.Encoder()).encode({
		arr: [0, 1, 2, 3, 4]
	})`)

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript("var state = (new $apeiro.Decoder()).decode(serialized); state", "<test>")
		if err != nil {
			t.Error(JSErrorString(err))
		}

		stateJson, err := val.Object().MarshalJSON()
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, `{"arr":[0,1,2,3,4]}`, string(stateJson))
	})
}

func TestSerializationReferencedObject(t *testing.T) {
	serialized := SerializeState(t, `var referenced = { a: 10, b: 1 };
	var referencee_1 = { referenced: referenced };
	var referencee_2 = { referenced };
	var state = {
		referencee_1,
		referencee_2,
	};
	(new $apeiro.Encoder()).encode(state)`)

	// (new $apeiro.Encoder()).encode(state);`)

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript(`
var state = (new $apeiro.Decoder()).decode(serialized);
state.referencee_1.referenced.a = 20;
state.referencee_1.referenced.a + state.referencee_2.referenced.a`, "<test>")
		if err != nil {
			t.Error(err)
		}
		assert.Equal(t, int64(40), val.Integer())
	})
}

func TestSerializationClassInstance(t *testing.T) {
	serialized := SerializeState(t, `class Summer { constructor(a, b) { this.a = a; this.b = b; } sum() { return this.a + this.b; } }
	var state = {
		instance: new Summer(10, 1),
	};
	(new $apeiro.Encoder()).encode(state)`)

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript(`
var state = (new $apeiro.Decoder()).decode(serialized);
state.instance.sum()
`, "<test>")
		if err != nil {
			v := err.(*v8go.JSError)
			fmt.Printf("loc: %s\n", v.Location)
			fmt.Printf("trace: %s\n", v.StackTrace)
			t.Error(err)
		}
		assert.Equal(t, int64(11), val.Integer())
	})
}

func TestSerializationBoundFunction(t *testing.T) {
	serialized := SerializeState(t, `function add(a, b) { return a + b; }
	const addTen = add.bind(null, 10);
	var state = {
		addTen,
	};
	(new $apeiro.Encoder()).encode(state)`)

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript(`
var state = (new $apeiro.Decoder()).decode(serialized);
state.addTen(1)
`, "<test>")
		if err != nil {
			t.Error(JSErrorString(err))
		}
		assert.Equal(t, int64(11), val.Integer())
	})
}

func TestDoubleSerializationBoundFunction(t *testing.T) {
	serialized := SerializeState(t, `function add(a, b) { return a + b; }
	const addTen = add.bind(null, 10);
	var state = {
		addTen,
	};
	(new $apeiro.Encoder()).encode(state)`)

	var serialized2 string
	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized", serialized)
		val, err := ctx.RunScript(`
var state = (new $apeiro.Decoder()).decode(serialized);
(new $apeiro.Encoder()).encode(state)
`, "<test>")
		if err != nil {
			t.Error(JSErrorString(err))
		}
		serialized2 = val.String()
	})

	WithEcmatime(t, func(ctx *v8go.Context) {
		ctx.Global().Set("serialized2", serialized2)
		val, err := ctx.RunScript(`
var state = (new $apeiro.Decoder()).decode(serialized2);
state.addTen(11)
`, "<test>")
		if err != nil {
			t.Error(JSErrorString(err))
		}
		assert.Equal(t, int64(21), val.Integer())
	})
}
