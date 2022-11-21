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

package blockly

import (
	"encoding/hex"
	"fmt"
	"strconv"
	"strings"
)

// Value is the generic value type.
//
// Values support type coercion (with the ability to fail if a type can't
// coerce).
type Value interface {
	// Coerce the type to a string, or Interpreter.Fail if the coercion cannot be done.
	AsString(*Interpreter) string
	// Coerce the type to a float, or Interpreter.Fail if the coercion cannot be done.
	AsNumber(*Interpreter) float64
	// Coerce the type to a boolean, or Interpreter.Fail if the coercion cannot be done.
	AsBoolean(*Interpreter) bool
	// Coerce the type to a colour, or Interpreter.Fail if the coercion cannot be done.
	AsColour(*Interpreter) Colour
	// Coerce the type to a list, or Interpreter.Fail if the coercion cannot be done.
	AsList(*Interpreter) List
	// Return true if the second value equals this value.
	Equals(*Interpreter, Value) bool
	// Return true if this value is strictly less than the second value.
	IsLessThan(*Interpreter, Value) bool
}

// The NilValue is a valueless value, generally returned from statement blocks
// and as the necessary return value for interpreter failure.
type NilValue struct {
}

func (v NilValue) AsString(i *Interpreter) string {
	i.Fail("Nil is not a string.")
	return ""
}

func (v NilValue) AsNumber(i *Interpreter) float64 {
	i.Fail("Nil is not a number.")
	return 0
}

func (v NilValue) AsBoolean(i *Interpreter) bool {
	i.Fail("Nil is not a boolean.")
	return false
}

func (v NilValue) AsColour(i *Interpreter) Colour {
	i.Fail("Nil is not a colour.")
	return Colour{}
}

func (v NilValue) AsList(i *Interpreter) List {
	i.Fail("Nil is not a list.")
	return List{}
}

// Nil values are only equal to themselves.
func (v NilValue) Equals(i *Interpreter, v2 Value) bool {
	_, ok := v2.(NilValue)
	// All nil values are equal
	return ok
}

// Nil values always sort less than everything except other nil values.
func (v NilValue) IsLessThan(i *Interpreter, v2 Value) bool {
	_, ok := v2.(NilValue)
	// All nil values sort less than non-nil
	return !ok
}

// The canonical nil value, for convenience.
var nilValue NilValue

// All Blockly numbers are floating-point. We use float64 for Go. Equality
// comparison is done as a Go direct-value compare (so string "2" is not equal
// to number 2).
type NumberValue float64

func (v NumberValue) AsString(i *Interpreter) string {
	nv := float64(v)
	if nv-float64(int(nv)) == 0 {
		return fmt.Sprintf("%d", int(nv))
	} else {
		return fmt.Sprintf("%f", v)
	}
}

func (v NumberValue) AsNumber(i *Interpreter) float64 {
	return float64(v)
}

func (v NumberValue) AsBoolean(i *Interpreter) bool {
	return float64(v) != 0
}

func (v NumberValue) AsColour(i *Interpreter) Colour {
	i.Fail("Number is not a colour.")
	return Colour{}
}

func (v NumberValue) AsList(i *Interpreter) List {
	i.Fail("Number is not a List.")
	return List{}
}

func (v NumberValue) Equals(i *Interpreter, v2 Value) bool {
	return v == v2
}

// IsLessThan compares this value to another value (coerced to a number
// value). It returns true if this value is strictly less than the other value.
func (v NumberValue) IsLessThan(i *Interpreter, v2 Value) bool {
	v2val := v2.AsNumber(i)
	return float64(v) < v2val
}

// A value representing a string.
type StringValue string

func (v StringValue) AsString(i *Interpreter) string {
	return string(v)
}

func (v StringValue) AsNumber(i *Interpreter) float64 {
	f, err := strconv.ParseFloat(string(v), 64)
	if err != nil {
		i.Fail(err.Error())
		return 0
	}
	return f
}

func (v StringValue) AsBoolean(i *Interpreter) bool {
	return string(v) != ""
}

func (v StringValue) AsColour(i *Interpreter) Colour {
	i.Fail("String '" + string(v) + "' is not a colour.")
	return Colour{}
}

func (v StringValue) AsList(i *Interpreter) List {
	i.Fail("String '" + string(v) + "' is not a list.")
	return List{}
}

// Equals returns true if and only if v2 and this value are Go equal (meaning
// they must also be the same type, so number 2 != "2").
//
// Exception: As per the unit test in colour.xml, strings and colour are
// directly comparable.
func (v StringValue) Equals(i *Interpreter, v2 Value) bool {
	if vcolour, ok := v2.(Colour); ok {
		return string(v) == vcolour.AsString(i)
	}
	return v == v2
}

// IsLessThan returns true if the second value (coerced to a string) is
// lexically strictly less than this value.
func (v StringValue) IsLessThan(i *Interpreter, v2 Value) bool {
	v2val := v2.AsString(i)
	return string(v) < v2val
}

// A boolean value.
type BoolValue bool

func (v BoolValue) AsString(i *Interpreter) string {
	if bool(v) {
		return "true"
	} else {
		return "false"
	}
}

// AsNumber causes the interpreter to Fail, as booleans cannot be cast to numbers.
func (v BoolValue) AsNumber(i *Interpreter) float64 {
	i.Fail("Boolean cannot be cast to number.")
	return 0
}

func (v BoolValue) AsBoolean(i *Interpreter) bool {
	return bool(v)
}

func (v BoolValue) AsColour(i *Interpreter) Colour {
	i.Fail("boolean is not a colour.")
	return Colour{}
}

func (v BoolValue) AsList(i *Interpreter) List {
	i.Fail("boolean is not a list")
	return List{}
}

// Equals returns true if and only if v2 and v are Go equal (meaning they must
// also be the same type, so "true" != true).
func (v BoolValue) Equals(i *Interpreter, v2 Value) bool {
	return v == v2
}

// IsLessThan returns true if and only if this value is false and v2 (coerced to a boolean) is true.
func (v BoolValue) IsLessThan(i *Interpreter, v2 Value) bool {
	v1val := bool(v)
	v2val := v2.AsBoolean(i)
	// order false before true
	if v1val {
		return false
	} else {
		return v2val
	}
}

// The colour type
type Colour struct {
	// The RGB colour channels.
	Red, Green, Blue uint8
}

func (v Colour) AsString(*Interpreter) string {
	digits := make([]byte, 3)
	digits[0] = v.Red
	digits[1] = v.Green
	digits[2] = v.Blue

	return "#" + hex.EncodeToString(digits)
}

func (v Colour) AsNumber(i *Interpreter) float64 {
	i.Fail("Colour is not a number.")
	return 0.0
}

func (v Colour) AsBoolean(i *Interpreter) bool {
	i.Fail("Colour is not a boolean")
	return false
}

func (v Colour) AsColour(i *Interpreter) Colour {
	return v
}

func (v Colour) AsList(i *Interpreter) List {
	i.Fail("Colour is not a list.")
	return List{}
}

func (v Colour) Equals(i *Interpreter, value Value) bool {
	if vstring, ok := value.(StringValue); ok {
		return v.AsString(i) == string(vstring)
	}
	return v == value
}

func (v Colour) IsLessThan(i *Interpreter, value Value) bool {
	v2 := value.AsColour(i)

	if (v.Red == v2.Red) && (v.Green == v2.Green) {
		return v.Blue < v2.Blue
	}
	if v.Red == v2.Red {
		return v.Green < v2.Green
	}
	return v.Red < v2.Red
}

// FromHex Initializes a colour from a hex code string ('aabbcc').
func (v *Colour) FromHex(i *Interpreter, code string) {
	b, err := hex.DecodeString(code)
	if err != nil {
		i.Fail("Could not construct colour from hex code '" + code + "'")
		return
	}
	if len(b) < 3 {
		i.Fail("Too few hex codes in '" + code + "' to construct colour")
	}
	v.Red = uint8(b[0])
	v.Green = uint8(b[1])
	v.Blue = uint8(b[2])
}

// The List type, a heterogeneous list of values. Because lists are mutable in
// Blockly, we need a struct to keep a shared view of the value of the slice,
// not the slice itself.

type List struct {
	// Values in the list. This is a pointer to a slice because lists in
	// Blockly are mutable; changes to this list need to be reflected in
	// other references to the same list.
	Values *[]Value
}

func (v List) AsString(i *Interpreter) string {
	val := *v.Values
	stringValues := make([]string, len(val))
	for idx, elem := range val {
		stringValues[idx] = elem.AsString(i)
	}
	return strings.Join(stringValues, ",")
}

func (v List) AsNumber(i *Interpreter) float64 {
	i.Fail("List is not a number.")
	return 0
}

func (v List) AsBoolean(i *Interpreter) bool {
	i.Fail("List is not a boolean.")
	return false
}

func (v List) AsColour(i *Interpreter) Colour {
	i.Fail("List is not a colour.")
	return Colour{}
}

func (v List) AsList(i *Interpreter) List {
	return v
}

// Equals checks two lists for equality. The lists are Equal if they have the
// same length and for each index, every element in them satisfies the condition
// elemFromList1.Equals(elemFromList2) == true
func (v List) Equals(i *Interpreter, v2 Value) bool {
	list := *v.Values
	list2, ok := v2.(List)
	if !ok {
		return false
	}
	if len(list) != len(*list2.Values) {
		return false
	}
	for idx, elem := range list {
		if !elem.Equals(i, (*list2.Values)[idx]) {
			return false
		}
	}
	return true
}

// IsLessThan returns true if this list is strictly less than the other list.
func (v List) IsLessThan(i *Interpreter, v2 Value) bool {
	i.Fail("Lists cannot be compared for greater than or less than.")
	return false
}

// RemoveElementAtIndex removes the element at the specified (0-based) index
// from the list.
func (v *List) RemoveElementAtIndex(i *Interpreter, idx int) {
	if idx < 0 || idx > len(*v.Values) {
		i.Fail("Cannot remove element at index " + strconv.Itoa(idx))
		return
	}
	*v.Values = append((*v.Values)[:idx], (*v.Values)[idx+1:]...)
}

// InsertElementAtIndex adds an element to the list at the specified (0-based)
// index.
func (v *List) InsertElementAtIndex(i *Interpreter, idx int, element Value) {
	if idx < 0 || idx > len(*v.Values) {
		i.Fail("Cannot remove element at index " + strconv.Itoa(idx))
		return
	}
	*v.Values = append(*v.Values, nil)
	copy((*v.Values)[idx+1:], (*v.Values)[idx:])
	(*v.Values)[idx] = element
}
