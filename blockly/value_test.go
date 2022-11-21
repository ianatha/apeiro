/**
 * Go Interpreter for Blockly
 *
 * Copyright 2015 Mark T. Tomczak
 * https://github.com/fixermark/blockly
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// Test for Blockly values

package blockly

import (
	"testing"
)

var i *Interpreter = &Interpreter{}

type coercionTest struct {
	name          string
	conversion    func() interface{}
	expectedValue interface{}
	shouldFail    bool
}

func runCoercionTest(t *testing.T, idx int, test coercionTest) {
	defer func() {
		if r := recover(); r != nil {
			if test.shouldFail {
				return
			} else {
				t.Errorf(
					"%s: expected %v to fail, but conversion failed instead.",
					test.name,
					test.expectedValue)
			}
		}
	}()
	result := test.conversion()
	if result != test.expectedValue {
		t.Errorf(
			"%s: expected %v to be %v, but was %v instead.",
			test.name,
			result,
			test.expectedValue,
			result)
	}
}

// Test all value-to-value coercions.
func TestCoercions(t *testing.T) {
	nilValue := NilValue{}
	numberValue := NumberValue(7.0)
	floatNumberValue := NumberValue(7.5)
	zeroNumberValue := NumberValue(0)
	stringValue := StringValue("hello")
	numberStringValue := StringValue("10")
	emptyStringValue := StringValue("")
	boolValue := BoolValue(true)
	colourValue := Colour{10, 20, 30}
	vslice := make([]Value, 3)
	listValue := List{
		Values: &vslice,
	}
	vslice[0] = NumberValue(10)
	vslice[1] = NumberValue(20)
	vslice[2] = NumberValue(30)

	tests := []coercionTest{
		// Nil
		{
			name: "nil to string",
			conversion: func() interface{} {
				return nilValue.AsString(i)
			},
			shouldFail: true,
		},
		{
			name: "nil to number",
			conversion: func() interface{} {
				return nilValue.AsNumber(i)
			},
			shouldFail: true,
		},
		{
			name: "nil to boolean",
			conversion: func() interface{} {
				return nilValue.AsBoolean(i)
			},
			shouldFail: true,
		},
		{
			name: "nil to colour",
			conversion: func() interface{} {
				return nilValue.AsColour(i)
			},
			shouldFail: true,
		},
		{
			name: "nil to list",
			conversion: func() interface{} {
				return nilValue.AsList(i)
			},
			shouldFail: true,
		},
		// Number
		{
			name: "whole number to string",
			conversion: func() interface{} {
				return numberValue.AsString(i)
			},
			expectedValue: "7",
		},
		{
			name: "float number to string",
			conversion: func() interface{} {
				return floatNumberValue.AsString(i)
			},
			expectedValue: "7.500000",
		},
		{
			name: "number to number",
			conversion: func() interface{} {
				return numberValue.AsNumber(i)
			},
			expectedValue: 7.0,
		},
		{
			name: "number to boolean",
			conversion: func() interface{} {
				return numberValue.AsBoolean(i)
			},
			expectedValue: true,
		},
		{
			name: "zero number to boolean",
			conversion: func() interface{} {
				return zeroNumberValue.AsBoolean(i)
			},
			expectedValue: false,
		},
		{
			name: "number to colour",
			conversion: func() interface{} {
				return numberValue.AsColour(i)
			},
			shouldFail: true,
		},
		{
			name: "number to list",
			conversion: func() interface{} {
				return numberValue.AsList(i)
			},
			shouldFail: true,
		},

		// String
		{
			name: "string to string",
			conversion: func() interface{} {
				return stringValue.AsString(i)
			},
			expectedValue: "hello",
		},
		{
			name: "string to number",
			conversion: func() interface{} {
				return stringValue.AsNumber(i)
			},
			shouldFail: true,
		},
		{
			name: "numeric string to number",
			conversion: func() interface{} {
				return numberStringValue.AsNumber(i)
			},
			expectedValue: 10.0,
		},
		{
			name: "string to boolean",
			conversion: func() interface{} {
				return stringValue.AsBoolean(i)
			},
			expectedValue: true,
		},
		{
			name: "empty string to boolean",
			conversion: func() interface{} {
				return emptyStringValue.AsBoolean(i)
			},
			expectedValue: false,
		},
		{
			name: "string to colour",
			conversion: func() interface{} {
				return stringValue.AsColour(i)
			},
			shouldFail: true,
		},
		{
			name: "string to list",
			conversion: func() interface{} {
				return stringValue.AsList(i)
			},
			shouldFail: true,
		},

		// Boolean
		{
			name: "bool to string",
			conversion: func() interface{} {
				return boolValue.AsString(i)
			},
			expectedValue: "true",
		},
		{
			name: "bool to number",
			conversion: func() interface{} {
				return boolValue.AsNumber(i)
			},
			shouldFail: true,
		},
		{
			name: "bool to boolean",
			conversion: func() interface{} {
				return boolValue.AsBoolean(i)
			},
			expectedValue: true,
		},
		{
			name: "bool to colour",
			conversion: func() interface{} {
				return boolValue.AsColour(i)
			},
			shouldFail: true,
		},
		{
			name: "bool to list",
			conversion: func() interface{} {
				return boolValue.AsList(i)
			},
			shouldFail: true,
		},
		// Colour
		{
			name: "colour to string",
			conversion: func() interface{} {
				return colourValue.AsString(i)
			},
			expectedValue: "#0a141e",
		},
		{
			name: "colour to number",
			conversion: func() interface{} {
				return colourValue.AsNumber(i)
			},
			shouldFail: true,
		},
		{
			name: "colour to boolean",
			conversion: func() interface{} {
				return colourValue.AsBoolean(i)
			},
			shouldFail: true,
		},
		{
			name: "colour to colour",
			conversion: func() interface{} {
				return colourValue.AsColour(i)
			},
			expectedValue: colourValue,
		},
		{
			name: "colour to list",
			conversion: func() interface{} {
				return colourValue.AsList(i)
			},
			shouldFail: true,
		},
		// List
		{
			name: "list to string",
			conversion: func() interface{} {
				return listValue.AsString(i)
			},
			expectedValue: "10,20,30",
		},
		{
			name: "list to number",
			conversion: func() interface{} {
				return listValue.AsNumber(i)
			},
			shouldFail: true,
		},
		{
			name: "list to boolean",
			conversion: func() interface{} {
				return listValue.AsBoolean(i)
			},
			shouldFail: true,
		},
		{
			name: "list to colour",
			conversion: func() interface{} {
				return listValue.AsColour(i)
			},
			shouldFail: true,
		},
		{
			name: "list to list",
			conversion: func() interface{} {
				return listValue.AsList(i)
			},
			expectedValue: listValue,
		},
	}

	for idx, test := range tests {
		runCoercionTest(t, idx, test)
	}
}

// Test equality (across type and within lists)
func TestEquality(t *testing.T) {
	values := []Value{
		NilValue{},
		NumberValue(7.0),
		StringValue("hello"),
		BoolValue(true),
		Colour{10, 20, 30},
		List{
			Values: &[]Value{
				NumberValue(1),
				NumberValue(2),
				NumberValue(3),
			},
		},
	}

	equality := [][]bool{
		{true, false, false, false, false, false},
		{false, true, false, false, false, false},
		{false, false, true, false, false, false},
		{false, false, false, true, false, false},
		{false, false, false, false, true, false},
		{false, false, false, false, false, true},
	}

	for idx := 0; idx < len(values); idx++ {
		for j := idx; j < len(values); j++ {
			equal := values[idx].Equals(i, values[j])
			if equal != equality[idx][j] {
				t.Errorf("Expected equality of %v and %v to be %v; was %v",
					values[idx],
					values[j],
					equality[idx][j],
					equal)
			}
		}
	}

	l1 := List{
		Values: &[]Value{
			NumberValue(1),
			NumberValue(2),
			StringValue("hi"),
		},
	}
	l2 := List{
		Values: &[]Value{
			NumberValue(1),
			NumberValue(2),
			NumberValue(3),
		},
	}
	// list refers to same list as l2
	l3 := List{
		Values: l2.Values,
	}
	// List refers to dfferent list from l2 but is same values
	l4 := List{
		Values: &[]Value{
			NumberValue(1),
			NumberValue(2),
			NumberValue(3),
		},
	}

	if l1.Equals(i, l2) {
		t.Errorf("%v should not equal %v, but they are equal.", l1, l2)
	}
	if !l2.Equals(i, l3) {
		t.Errorf("%v should equal %v, but they are not equal.", l2, l3)
	}
	if !l2.Equals(i, l4) {
		t.Errorf("%v should equal %v, but they are not equal.", l2, l4)
	}
	if !l3.Equals(i, l4) {
		t.Errorf("%v should equal %v, but they are not equal.", l3, l4)
	}

}

// Test less-than
//
// Interesting caveats of less-than in Blockly:
//
// NilValue is an artificial value, so its comparison is strange; LHS, it's less
// than everything; RHS, it fails interpretation.
//
// Blockly forbids comparison of non-equal types syntactically, so we
// extrapolate that it's generally a runtime error if two unequal types end up
// being compared (by, say, untyped variables being used to match them up in a
// compare block).
//
// Two exceptions to this are string and bool; many types have string and bool
// coercions defined, and we allow the coercion if comparison occurs.
func TestLessThan(t *testing.T) {

	nilValue := NilValue{}
	numberValue := NumberValue(7.0)
	numberValue2 := NumberValue(10.0)
	stringValue := StringValue("hello")
	numberStringValue := StringValue("10")
	emptyStringValue := StringValue("")
	boolValue := BoolValue(true)
	falseBoolValue := BoolValue(false)
	colourValue := Colour{10, 20, 30}
	vslice := make([]Value, 3)
	listValue := List{
		Values: &vslice,
	}
	vslice[0] = NumberValue(10)
	vslice[1] = NumberValue(20)
	vslice[2] = NumberValue(30)

	type lessThanTest struct {
		a, b       Value
		aLessThanB bool
		shouldFail bool
	}

	tests := []lessThanTest{
		// nilValue
		{nilValue, nilValue, false, false},
		{nilValue, numberValue, true, false},
		{nilValue, stringValue, true, false},
		{nilValue, boolValue, true, false},
		{nilValue, colourValue, true, false},
		{nilValue, listValue, true, false},

		// numberValue
		{numberValue, nilValue, false, true},
		{numberValue, numberValue2, true, false},
		{numberValue, numberValue, false, false},
		{numberValue2, numberValue, false, false},
		{numberValue, stringValue, false, true},
		{numberValue, boolValue, false, true},
		{numberValue, colourValue, false, true},
		{numberValue, listValue, false, true},

		// stringValue
		{stringValue, nilValue, false, true},
		{stringValue, numberValue, false, false},
		{stringValue, stringValue, false, false},
		{stringValue, numberStringValue, false, false},
		{numberStringValue, stringValue, true, false},
		{stringValue, emptyStringValue, false, false},
		{emptyStringValue, stringValue, true, false},
		{stringValue, boolValue, true, false},
		{stringValue, colourValue, false, false},
		{stringValue, listValue, false, false},

		// boolValue
		{boolValue, nilValue, false, true},
		{boolValue, numberValue, false, false},
		{boolValue, stringValue, false, false},
		{boolValue, emptyStringValue, false, false},
		{boolValue, boolValue, false, false},
		{boolValue, falseBoolValue, false, false},
		{falseBoolValue, boolValue, true, false},
		{boolValue, colourValue, false, true},
		{boolValue, listValue, false, true},

		// colourValue
		{colourValue, nilValue, false, true},
		{colourValue, numberValue, false, true},
		{colourValue, stringValue, false, true},
		{colourValue, boolValue, false, true},
		{colourValue, colourValue, false, false},
		{colourValue, listValue, false, true},

		// listValue
		{listValue, nilValue, false, true},
		{listValue, numberValue, false, true},
		{listValue, stringValue, false, true},
		{listValue, boolValue, false, true},
		{listValue, colourValue, false, true},
		// List comparison not well-defined by Blockly unit tests.
		// For now, we interpret lists as not comparable.
		{listValue, listValue, false, true},
	}

	for idx, test := range tests {
		func() {
			defer func() {
				if r := recover(); r != nil {

					if !test.shouldFail {
						t.Errorf(
							"%d: expected %v < %v to be %v, "+
								"but conversion failed instead.",
							idx,
							test.a,
							test.b,
							test.aLessThanB)

					}
					return
				}
			}()

			result := test.a.IsLessThan(i, test.b)

			if test.shouldFail {
				t.Errorf("%d: Expected %v < %v to fail, was %v",
					idx,
					test.a,
					test.b,
					result)
			}

			if result != test.aLessThanB {
				t.Errorf("%d: Expected %v < %v to be %v, was %v",
					idx,
					test.a,
					test.b,
					test.aLessThanB,
					result)
			}

		}()
	}
}

// Test colour initialization from hex code string
func TestColourFromHex(t *testing.T) {
	var c Colour

	i := &Interpreter{}

	c.FromHex(i, "0a141e")
	expectedColour := Colour{10, 20, 30}

	if c != expectedColour {
		t.Errorf("Expected colour to be %v, but was %v",
			expectedColour, c)
	}

	checkFailInterpreter(t, func() {
		c.FromHex(i, "not a hex code")
	})
	checkFailInterpreter(t, func() {
		c.FromHex(i, "aabb")
	})
}

// Test list removal and reflection across copies of list
func TestRemoveElement(t *testing.T) {
	elem1 := NumberValue(10)
	elem2 := NumberValue(20)
	elem3 := NumberValue(30)

	testList := List{
		Values: &([]Value{
			elem1, elem2, elem3,
		}),
	}

	testList2 := List{
		Values: testList.Values,
	}

	testList.RemoveElementAtIndex(i, 0)
	if testList.AsString(i) != "20,30" {
		t.Errorf("Removing first element failed; result was " +
			testList.AsString(i))
	}
	testList.RemoveElementAtIndex(i, 1)
	if testList.AsString(i) != "20" {
		t.Errorf("Removing last element failed; result was " +
			testList.AsString(i))
	}

	checkFailInterpreter(t, func() {
		testList.RemoveElementAtIndex(i, 1)
	})

	if testList.AsString(i) != testList2.AsString(i) {
		t.Errorf("Changes to test list not reflected in copy; "+
			"testList is %s, copy is %s",
			testList.AsString(i), testList2.AsString(i))
	}

}

// Test list insertion and reflection across copies of list
func TestInsertElement(t *testing.T) {
	testList := List{
		Values: &([]Value{}),
	}

	testList.InsertElementAtIndex(i, 0, NumberValue(20))
	if testList.AsString(i) != "20" {
		t.Errorf("Expected list of '20', was %s",
			testList.AsString(i))
	}

	testList.InsertElementAtIndex(i, 0, NumberValue(10))
	if testList.AsString(i) != "10,20" {
		t.Errorf("Expected list of '10,20', was %s",
			testList.AsString(i))
	}
	testList.InsertElementAtIndex(i, 2, NumberValue(30))
	if testList.AsString(i) != "10,20,30" {
		t.Errorf("Expected list of '10,20,30', was %s",
			testList.AsString(i))
	}
	testList.InsertElementAtIndex(i, 1, NumberValue(15))
	if testList.AsString(i) != "10,15,20,30" {
		t.Errorf("Expected list of '10,15,20,30', was %s",
			testList.AsString(i))
	}
	checkFailInterpreter(t, func() {
		testList.InsertElementAtIndex(i, -1, StringValue("no"))
	})
	checkFailInterpreter(t, func() {
		testList.InsertElementAtIndex(i, 5, StringValue("no"))
	})

}
