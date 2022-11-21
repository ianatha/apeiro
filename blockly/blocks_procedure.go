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
)

// Note: procedures_defnoreturn and procedures_defreturn blocks are handled
// specially by Interpreter, since they are only valid as top-level blocks.

// ProceduresFunctionCallEvaluator calls a function, passing arguments and
// returning any return value from the function. Arguments shadow the global
// variable values in the context of the evaluation of the function.evaluates a
// function.
func ProceduresFunctionCallEvaluator(i *Interpreter, b *Block) Value {
	if b.Mutation == nil {
		i.Fail("Missing mutation in procedure call.")
		return nilValue
	}
	function, ok := i.Functions[b.Mutation.Name]
	if !ok {
		i.Fail("Unknown function name '" + b.Mutation.Name + "'")
		return nilValue
	}
	argMap := make(map[string]Value)
	for idx, arg := range b.Mutation.Args {
		bv := b.BlockValueWithName(fmt.Sprintf("ARG%d", idx))
		if bv == nil {
			i.Fail(fmt.Sprintf("calling '%s': No value specified for argument '%s'",
				b.Mutation.Name,
				arg))
			return nilValue
		}
		if len(bv.Blocks) != 1 {
			i.Fail(fmt.Sprintf("calling '%s': Missing block for argument '%s'",
				b.Mutation.Name,
				arg))
			return nilValue
		}
		argMap[arg.Name] = i.Evaluate(&bv.Blocks[0])
	}

	shadowedVariables := ShadowVariables(i, argMap)
	defer UnshadowVariables(i, argMap, shadowedVariables)

	var retval Value
	if function.Body != nil {

		func() {
			defer i.CheckReturn(&retval)
			i.Evaluate(function.Body)
		}()
	}
	if retval == nil {
		// No early return; process return expression if it exists to
		// get retval.

		retval = nilValue
		if function.Return != nil {
			retval = i.Evaluate(function.Return)
		}
	}
	return retval
}

// ShadowVariables builds a backup copy of variables in the Interpreter context,
// then sets those variables to the shadow values. It returns a map of the shadowed variables.
func ShadowVariables(i *Interpreter, newVariables map[string]Value) map[string]Value {
	shadowedValues := make(map[string]Value)
	for k, v := range newVariables {
		oldValue, ok := i.Context[k]
		if ok {
			shadowedValues[k] = oldValue
		}
		i.Context[k] = v
	}
	return shadowedValues
}

// UnshadowVariables restores the variables in the Interpreter to their
// pre-shadow values.
func UnshadowVariables(i *Interpreter, newVariables map[string]Value, preShadow map[string]Value) {
	for k, _ := range newVariables {
		delete(i.Context, k)
		if oldValue, ok := preShadow[k]; ok {
			i.Context[k] = oldValue
		}
	}
}

// ProceduresIfReturnEvaluator evaluates the procedures_ifreturn block, which
// returns (either early or with a different value) if a conditional evaluates
// to true.
func ProceduresIfReturnEvaluator(i *Interpreter, b *Block) Value {
	condition := b.SingleBlockValueWithName(i, "CONDITION")
	if i.Evaluate(condition).AsBoolean(i) {
		bv := b.BlockValueWithName("VALUE")
		if bv == nil || len(bv.Blocks) == 0 {
			panic(BreakEvent{Then: ThenReturn, ReturnValue: nilValue})
		}
		if len(bv.Blocks) != 1 {
			i.Fail(fmt.Sprintf(
				"Expected 1 Value block in procedures if-return; got %d",
				len(bv.Blocks)))
			return nilValue
		}
		panic(BreakEvent{Then: ThenReturn, ReturnValue: i.Evaluate(&bv.Blocks[0])})
	}
	return nilValue
}
