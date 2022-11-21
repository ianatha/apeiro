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
	"fmt"
	"math"
)

// ControlIfEvaluator evaluates if / elseif / else blocks.
func ControlIfEvaluator(i *Interpreter, b *Block) Value {
	var elseIfs int
	var elses int
	if b.Mutation != nil {
		elseIfs = b.Mutation.ElseIf
		elses = b.Mutation.Else
	}

	for idx := 0; idx <= elseIfs; idx++ {
		ifBlock := b.SingleBlockValueWithName(i, fmt.Sprintf("IF%d", idx))
		doBlock := b.SingleBlockStatementWithName(i, fmt.Sprintf("DO%d", idx))
		if i.Evaluate(ifBlock).AsBoolean(i) {
			return i.Evaluate(doBlock)
		}
	}

	if elses > 0 {
		return i.Evaluate(b.SingleBlockStatementWithName(i, "ELSE"))
	}

	return nilValue
}

func ControlRepeatExtEvaluator(i *Interpreter, b *Block) Value {
	repeatedBlock := b.SingleBlockStatementWithName(i, "DO")
	var result Value
	continuing := true
	for repeats := int(i.Evaluate(
		b.SingleBlockValueWithName(i, "TIMES")).AsNumber(i)); repeats > 0 && continuing; repeats-- {
		func() {
			defer i.CheckBreak(&continuing)
			result = i.Evaluate(repeatedBlock)
		}()
	}
	return result
}

func ControlWhileUntil(i *Interpreter, b *Block) Value {
	modeField := b.FieldWithName("MODE")
	if modeField == nil {
		i.Fail("No MODE field in controls_whileUntil")
		return nilValue
	}
	predicate := b.SingleBlockValueWithName(i, "BOOL")
	body := b.SingleBlockStatementWithName(i, "DO")

	running := true
	var v Value
	v = nilValue
	for running {
		switch modeField.Value {
		case "WHILE":
			running = i.Evaluate(predicate).AsBoolean(i)
		case "UNTIL":
			running = !(i.Evaluate(predicate).AsBoolean(i))
		}

		if running {
			func() {
				defer i.CheckBreak(&running)
				v = i.Evaluate(body)
			}()
		}
	}
	return v
}

// ControlForEvaluator evaluates a Blockly for (from-value, to-value, by-value) block.
//
// Note that Blockly includes a couple idiosynchrasies in its for manipulation
// (see
// https://github.com/google/blockly/blob/master/generators/javascript/loops.js
// for details):
//
// # FROM, TO, and BY are auto-populated with 0, 0, 1 (respectively) if not specified
//
// BY is always considered to be positive (absolute value taken). If FROM <= TO,
// BY is used to count up; if FROM > TO, BY is used to count down.
func ControlForEvaluator(i *Interpreter, b *Block) Value {
	varName := b.FieldWithName("VAR")
	if varName == nil {
		i.Fail("No VAR field in controls_for")
		return nilValue
	}
	// As copied from Blockly's Javascript generator
	// ,
	// FROM, TO, and BY are auto-populated with 0, 0, 1 (respectively) if
	// not specified.
	valueOrDefault := func(valueName string, defaultValue float64) float64 {
		if b.BlockValueWithName(valueName) == nil {
			return defaultValue
		}
		return i.Evaluate(b.SingleBlockValueWithName(i, valueName)).AsNumber(i)
	}
	fromValue := valueOrDefault("FROM", 0)
	toValue := valueOrDefault("TO", 0)
	byValue := math.Abs(valueOrDefault("BY", 1))
	body := b.SingleBlockStatementWithName(i, "DO")
	running := true
	var v Value
	v = nilValue

	var comparator func(a, b float64) bool
	if fromValue <= toValue {
		comparator = func(a, b float64) bool {
			return a <= b
		}
	} else {
		comparator = func(a, b float64) bool {
			return a >= b
		}
		byValue = -byValue
	}

	for ; comparator(fromValue, toValue) && running; fromValue += byValue {
		i.Context[varName.Value] = NumberValue(fromValue)
		func() {
			defer i.CheckBreak(&running)
			v = i.Evaluate(body)
		}()
	}

	return v
}

// ControlForEachEvaluator runs the body of the control with the index variable
// set to each element of a list.
func ControlForEachEvaluator(i *Interpreter, b *Block) Value {
	varName := b.SingleFieldWithName(i, "VAR")
	list := i.Evaluate(b.SingleBlockValueWithName(i, "LIST")).AsList(i)
	body := b.SingleBlockStatementWithName(i, "DO")

	running := true

	for idx := 0; idx < len(*list.Values) && running; idx += 1 {
		i.Context[varName] = (*list.Values)[idx]
		func() {
			defer i.CheckBreak(&running)
			i.Evaluate(body)
		}()
	}

	return nilValue
}

func ControlFlowStatements(i *Interpreter, b *Block) Value {
	breakType := b.FieldWithName("FLOW")
	if breakType == nil {
		i.Fail("No FLOW field in controls_flow_statements")
		return nilValue
	}
	switch breakType.Value {
	case "BREAK":
		panic(BreakEvent{Then: ThenBreak})
	case "CONTINUE":
		panic(BreakEvent{Then: ThenContinue})
	}
	return nilValue
}
