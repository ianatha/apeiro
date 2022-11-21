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

// Evaluators for variable blocks

package blockly

func VariableSetEvaluator(i *Interpreter, b *Block) Value {
	field := b.FieldWithName("VAR")
	if field == nil {
		i.Fail("No VAR field in variables_set")
		return nilValue
	}
	variableValue := b.SingleBlockValueWithName(i, "VALUE")
	i.Context[field.Value] = i.Evaluate(variableValue)
	return nilValue
}

func VariableGetEvaluator(i *Interpreter, b *Block) Value {
	field := b.FieldWithName("VAR")
	if field == nil {
		i.Fail("No VAR field in variables_get")
		return nilValue
	}
	variableValue, ok := i.Context[field.Value]
	if !ok {
		i.Fail("No variable named '" + field.Value + "'")
		return nilValue
	}
	return variableValue
}
