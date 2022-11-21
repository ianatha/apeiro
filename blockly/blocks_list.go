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
	"math/rand"
	"strconv"
	"strings"
)

// ListCreateEmptyEvaluator creates an empty list.
func ListCreateEmptyEvaluator(i *Interpreter, b *Block) Value {
	var newList List
	v := make([]Value, 0)
	newList.Values = &v
	return newList
}

// ListCreateWithEvaluator creates a list with a set of values.
func ListCreateWithEvaluator(i *Interpreter, b *Block) Value {
	if b.Mutation == nil {
		i.Fail("lists_create_with block is missing its count of items.")
		return nilValue
	}
	items := b.Mutation.Items
	lv := make([]Value, items)

	for idx, _ := range lv {
		lv[idx] = i.Evaluate(b.SingleBlockValueWithName(i, "ADD"+strconv.Itoa(idx)))
	}
	return List{Values: &lv}
}

// ListRepeatEvaluator creates a list of length n by repeating one element n
// times.  Note that the repeated item is referenced, so if the item to repeat
// is a list, modifying that list will modify all copies of that list.
func ListRepeatEvaluator(i *Interpreter, b *Block) Value {
	itemToRepeat := i.Evaluate(b.SingleBlockValueWithName(i, "ITEM"))
	repeatTimes := int(i.Evaluate(b.SingleBlockValueWithName(i, "NUM")).AsNumber(i))

	lv := make([]Value, repeatTimes)
	for idx := 0; idx < repeatTimes; idx++ {
		lv[idx] = itemToRepeat
	}
	return List{Values: &lv}
}

// ListLengthEvaluator returns the number of elements in the list.
func ListLengthEvaluator(i *Interpreter, b *Block) Value {
	listToCount := i.Evaluate(b.SingleBlockValueWithName(i, "VALUE")).AsList(i)
	return NumberValue(len(*listToCount.Values))
}

// ListIsEmptyEvaluator returns true if the list's length is 0.
func ListIsEmptyEvaluator(i *Interpreter, b *Block) Value {
	nv := ListLengthEvaluator(i, b).AsNumber(i)
	return BoolValue(nv == 0.0)
}

// ListIndexOfEvaluator returns the first or last occurence of a specified
// element in a list, or 0 if the item cannot be found. Note that Blockly uses
// 1-offset indexing (if element is first element, it is index 1, etc.).
func ListIndexOfEvaluator(i *Interpreter, b *Block) Value {
	endField := b.FieldWithName("END")
	if endField == nil {
		i.Fail("lists_indexOf block missing its END field.")
		return nilValue
	}
	listToSearch := i.Evaluate(b.SingleBlockValueWithName(i, "VALUE")).AsList(i)
	if len(*listToSearch.Values) == 0 {
		return NumberValue(0.0)
	}
	itemToSearchFor := i.Evaluate(b.SingleBlockValueWithName(i, "FIND"))

	var startIdx, endIdx, stepIdx int
	switch endField.Value {
	case "FIRST":
		startIdx = 0
		endIdx = len(*listToSearch.Values)
		stepIdx = 1
	case "LAST":
		startIdx = len(*listToSearch.Values) - 1
		endIdx = -1
		stepIdx = -1
	default:
		i.Fail("lists_indexOf had unrecognized END field value '" + endField.Value + "'")
		return nilValue
	}
	for idx := startIdx; idx != endIdx; idx += stepIdx {
		if itemToSearchFor.Equals(i, (*listToSearch.Values)[idx]) {
			return NumberValue(idx + 1)
		}
	}
	return NumberValue(0)
}

// ListGetIndexEvaluator fetches an element from a list at a specific index, and
// optionally removes that element from the list (mutating the list).
func ListGetIndexEvaluator(i *Interpreter, b *Block) Value {
	if b.Mutation == nil {
		i.Fail("lists_getIndex block is missing mutation information.")
		return nilValue
	}
	hasAt := b.Mutation.At

	listToFetchFrom := i.Evaluate(b.SingleBlockValueWithName(i, "VALUE")).AsList(i)
	var source int
	if hasAt {
		source = int(i.Evaluate(b.SingleBlockValueWithName(i, "AT")).AsNumber(i))
	}
	fetchIdx := getListIndexValue(i,
		b.SingleFieldWithName(i, "WHERE"),
		source,
		len(*listToFetchFrom.Values))
	mode := b.SingleFieldWithName(i, "MODE")
	switch mode {
	case "GET":
		return (*listToFetchFrom.Values)[fetchIdx]
	case "GET_REMOVE":
		retval := (*listToFetchFrom.Values)[fetchIdx]
		listToFetchFrom.RemoveElementAtIndex(i, fetchIdx)
		return retval
	case "REMOVE":
		listToFetchFrom.RemoveElementAtIndex(i, fetchIdx)
		return nil

	default:
		i.Fail("Don't know how to '" + mode + "' on a list.")
		return nilValue
	}

}

// Helper function that evaluates a list reference value into a Go
// slice index.
func getListIndexValue(i *Interpreter, idxType string, idx int, slotCount int) int {
	switch idxType {
	case "FROM_START":
		if idx < 1 {
			i.Fail("Lists are indexed from 1, but I was given " +
				"index " + strconv.Itoa(idx))
			return 0
		}
		if idx > slotCount {
			i.Fail("Attempted to index to item " +
				strconv.Itoa(idx) + " from list, but list " +
				"length is " + strconv.Itoa(slotCount))
			return 0
		}
		return idx - 1
	case "FROM_END":
		if idx < 1 {
			i.Fail("Lists are indexed from 0 at end, but I was given " +
				"index " + strconv.Itoa(idx))
			return 0
		}
		if idx > slotCount {
			i.Fail("Attempted to index to item " +
				strconv.Itoa(idx) + " from end of list, " +
				"but list length is " +
				strconv.Itoa(slotCount))
			return 0
		}
		return slotCount - idx
	case "FIRST":
		if slotCount == 0 {
			i.Fail("List is empty; cannot access first element.")
			return 0
		}
		return 0
	case "LAST":
		if slotCount == 0 {
			i.Fail("List is empty; cannot access last element.")
			return 0
		}
		return slotCount - 1
	case "RANDOM":
		if slotCount == 0 {
			i.Fail("List is empty; cannot access random element.")
			return 0
		}
		return rand.Intn(slotCount)
	default:
		i.Fail("Don't know how to index a list using '" + idxType + "'")
		return 0
	}
}

// ListSetIndexEvaluator changes an element in a list at a specific index or
// inserts an element into the list (mutating the list).
func ListSetIndexEvaluator(i *Interpreter, b *Block) Value {
	if b.Mutation == nil {
		i.Fail("lists_setIndex block is missing mutation information.")
		return nilValue
	}
	hasAt := b.Mutation.At

	listToSetTo := i.Evaluate(b.SingleBlockValueWithName(i, "LIST")).AsList(i)
	var destination int
	if hasAt {
		destination = int(i.Evaluate(b.SingleBlockValueWithName(i, "AT")).AsNumber(i))
	}
	valueToInsert := i.Evaluate(b.SingleBlockValueWithName(i, "TO"))
	mode := b.SingleFieldWithName(i, "MODE")
	slots := len(*listToSetTo.Values)
	if mode == "INSERT" {
		slots += 1
	}
	where := b.SingleFieldWithName(i, "WHERE")

	setIdx := getListIndexValue(i,
		b.SingleFieldWithName(i, "WHERE"),
		destination,
		slots)
	switch mode {
	case "SET":
		(*listToSetTo.Values)[setIdx] = valueToInsert
	case "INSERT":
		if where == "FROM_END" {
			setIdx -= 1
		}
		listToSetTo.InsertElementAtIndex(i, setIdx, valueToInsert)
	default:
		i.Fail("Don't know how to '" + mode + "' on a list.")
	}
	return nilValue
}

// ListGetSublistEvaluator grabs a sub-list of a list.
func ListGetSublistEvaluator(i *Interpreter, b *Block) Value {
	if b.Mutation == nil {
		i.Fail("lists_getSublist block is missing mutation information.")
		return nilValue
	}
	hasAt1 := b.Mutation.At1
	hasAt2 := b.Mutation.At2

	listToSlice := i.Evaluate(b.SingleBlockValueWithName(i, "LIST")).AsList(i)

	if len(*listToSlice.Values) == 0 {
		v := make([]Value, 0)
		return List{Values: &v}
	}

	boundaryTypeBegin := b.SingleFieldWithName(i, "WHERE1")
	boundaryTypeEnd := b.SingleFieldWithName(i, "WHERE2")

	var beginBoundary, endBoundary int
	if hasAt1 {
		beginBoundary = int(
			i.Evaluate(b.SingleBlockValueWithName(
				i, "AT1")).AsNumber(i))
	}
	if hasAt2 {
		endBoundary = int(
			i.Evaluate(b.SingleBlockValueWithName(
				i, "AT2")).AsNumber(i))
	}

	beginIdx := getListIndexValue(
		i,
		boundaryTypeBegin,
		beginBoundary,
		len(*listToSlice.Values))
	endIdx := getListIndexValue(
		i,
		boundaryTypeEnd,
		endBoundary,
		len(*listToSlice.Values)) + 1

	if endIdx <= beginIdx {
		v := make([]Value, 0)
		return List{Values: &v}
	}
	nv := (*listToSlice.Values)[beginIdx:endIdx]
	return List{Values: &nv}
}

// ListSplitEvaluator splits a text string on a delimiter into a list, or joins
// a list of strings into a single string using the delimiter between
// concatenated strings. Return value for this interpreter is of either List or
// StringValue type.
func ListSplitEvaluator(i *Interpreter, b *Block) Value {
	// value INPUT
	// value DELIM
	mode := b.SingleFieldWithName(i, "MODE")
	inputValue := i.Evaluate(b.SingleBlockValueWithName(i, "INPUT"))
	delim := i.Evaluate(b.SingleBlockValueWithName(i, "DELIM")).AsString(i)

	switch mode {
	case "SPLIT":
		splitStrings := strings.Split(inputValue.AsString(i), delim)
		rv := make([]Value, len(splitStrings))
		for idx, v := range splitStrings {
			rv[idx] = StringValue(v)
		}
		return List{Values: &rv}
	case "JOIN":
		joinList := inputValue.AsList(i)
		joinStrings := make([]string, len(*joinList.Values))
		for idx, v := range *joinList.Values {
			joinStrings[idx] = v.AsString(i)
		}
		return StringValue(strings.Join(joinStrings, delim))
	default:
		i.Fail("Unknown mode '" + mode + "' for lists_split block.")
		return nilValue
	}
}
