package debugging

import "rogchap.com/v8go"

//go:generate go run ./build/value_types_generator

type ValueTypeCase struct {
	name         string
	testFunction func(*v8go.Value) bool
}

func ValueType(v *v8go.Value) []string {
	if v == nil {
		return []string{"v8go_nil"}
	}
	var s []string
	for _, valueTypeCase := range VALUE_TYPES {
		if valueTypeCase.testFunction(v) {
			s = append(s, valueTypeCase.name)
		}
	}
	return s
}
