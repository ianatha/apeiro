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

// blockly Interpreter
//
// Interpreter for the Blockly programming language (https://developers.google.com/blockly).
//
// Blockly is a library for building visual programming editors. This
// interpreter is capable of digesting the output of Blockly.Xml.domToText (in
// the Blockly library) by interpreting the resulting XML as a program and
// running that program. It supports the basic block types that Blockly ships
// with.
//
// To use:
//
// Create a blockly.Interpreter.
//
// Populate the interpreter with a Console (io.Writer) as an output destination
// and a FailHandler to be run if the Blockly script cannot be interpreted.
//
// Parse the XML into a BlockXml using the tools in encoding/xml.
//
// Interpret the XML with
//
//	interpreter.Run(blockXml.Blocks)
package blockly

import (
	"fmt"
	"io"
	"strings"
)

type BreakType int

// Breaks can be 'break' (end the current loop), 'continue' (go to next step in
// the current loop), or 'return' (end the current function, possibly with a
// return value). These constants indicate which type of break occurred.
const (
	ThenBreak BreakType = iota
	ThenContinue
	ThenReturn
)

// BreakEvent is a special type sent via panic to indicate a break or continue
// occurred. Though Blockly's client-side editor will warn a user if they
// attempt to use a break block outside of a loop, Blockly will still allow the
// user to send a block in that form to the server, so we panic on breaks to
// allow the interpreter to handle this state.
//
// BreakEvents can also be used by procedures_ifreturn to bail early from a
// function; in that use case, the ReturnValue is non-nil and specifies what
// return value came out of the function.
type BreakEvent struct {
	Then        BreakType
	ReturnValue Value
}

// Error method for BreakEvents (which are panicked as errors).
func (evt BreakEvent) Error() string {
	switch evt.Then {
	case ThenBreak:
		return "Break outside of loop."
	case ThenContinue:
		return "Continue outside of loop."
	default:
		return "BreakEvent outside of loop."
	}
}

// A Function maps arguments to a body that is executed, and
// (optionally) a value that is returned.
//
// In Blockly, functions are not values.
type Function struct {
	// Names of inputs, which become variables defined within the function
	// while it is evaluated.
	Inputs []string
	// (optional) top-level block of the function body
	Body *Block
	// (optional) return statement
	Return *Block
}

// An Evaluator can evaluate a block, in the current context of the interpreter, into a value.
type Evaluator func(*Interpreter, *Block) Value

// The Interpreter maintains interpretation state for Blockly evaluation (such
// as where print operations should go, what to do if evaluation fails, and
// variable values).
type Interpreter struct {
	// The output console. All 'print' operations write to here.
	Console io.Writer
	// Function called if evaluation fails
	FailHandler func(string)
	// Variables in an execution cycle of the interpreter
	Context map[string]Value
	// Function mappings in an execution cycle of the interpreter
	Functions map[string]Function
	// Custom handlers for specific block prefixes. Inserting an evaluator
	// here will cause all blocks with type "prefix_<something>" to be
	// handled by the evaluator in key "prefix_". Blocks with a type not in
	// prefix get handled by the default evaluators or cause the interpreter
	// to Fail if there is no evaluator for the block type.
	PrefixHandlers map[string]Evaluator
}

// Table of default evaluators for block types.
var evaluators map[string]Evaluator

// PrepareEvaluators populates the default evaluator table. It must be called once before any calls to Interpreter.Run.
func PrepareEvaluators() {
	evaluators = map[string]Evaluator{
		"controls_if":              ControlIfEvaluator,
		"controls_repeat_ext":      ControlRepeatExtEvaluator,
		"controls_whileUntil":      ControlWhileUntil,
		"controls_for":             ControlForEvaluator,
		"controls_forEach":         ControlForEachEvaluator,
		"controls_flow_statements": ControlFlowStatements,

		"logic_compare": LogicCompareEvaluator,
		"logic_ternary": LogicTernaryEvaluator,

		"logic_boolean":   LogicBooleanEvaluator,
		"logic_operation": LogicOperationEvaluator,
		"logic_negate":    LogicNegateEvaluator,

		"math_number":          NumberEvaluator,
		"math_constant":        NumberConstantEvaluator,
		"math_random_int":      NumberRandomIntEvaluator,
		"math_random_float":    NumberRandomFloatEvaluator,
		"math_number_property": NumberPropertyEvaluator,
		"math_arithmetic":      NumberArithmeticEvaluator,
		"math_modulo":          NumberModuloEvaluator,
		"math_single":          NumberSingleEvaluator,
		"math_trig":            NumberSingleEvaluator,
		"math_round":           NumberSingleEvaluator,
		"math_on_list":         NumberOnListEvaluator,
		"math_constrain":       NumberConstrainEvaluator,
		"math_change":          NumberChangeEvaluator,

		"text":              TextEvaluator,
		"text_join":         TextJoinEvaluator,
		"text_print":        PrintEvaluator,
		"text_length":       TextLengthEvaluator,
		"text_isEmpty":      TextIsEmptyEvaluator,
		"text_charAt":       TextCharAtEvaluator,
		"text_indexOf":      TextIndexOfEvaluator,
		"text_append":       TextAppendEvaluator,
		"text_getSubstring": TextGetSubstringEvaluator,
		"text_trim":         TextTrimEvaluator,
		"text_changeCase":   TextChangeCaseEvaluator,

		"lists_create_empty": ListCreateEmptyEvaluator,
		"lists_create_with":  ListCreateWithEvaluator,
		"lists_repeat":       ListRepeatEvaluator,
		"lists_length":       ListLengthEvaluator,
		"lists_isEmpty":      ListIsEmptyEvaluator,
		"lists_indexOf":      ListIndexOfEvaluator,
		"lists_getIndex":     ListGetIndexEvaluator,
		"lists_setIndex":     ListSetIndexEvaluator,
		"lists_getSublist":   ListGetSublistEvaluator,
		"lists_split":        ListSplitEvaluator,

		"colour_picker": ColourPickerEvaluator,
		"colour_random": ColourRandomEvaluator,
		"colour_rgb":    ColourRgbEvaluator,
		"colour_blend":  ColourBlendEvaluator,

		"variables_set": VariableSetEvaluator,
		"variables_get": VariableGetEvaluator,

		"procedures_callreturn":   ProceduresFunctionCallEvaluator,
		"procedures_callnoreturn": ProceduresFunctionCallEvaluator,
		"procedures_ifreturn":     ProceduresIfReturnEvaluator,
	}
}

// Fail causes interpretation to panic. If Fail is called in the context of a
// Run, the Run will recover and call the interpreter's FailHandler function.
func (i *Interpreter) Fail(reason string) {
	panic(reason)
}

// WriteToConsole outputs a string to the interpreter's Console.
func (i *Interpreter) WriteToConsole(s string) {
	i.Console.Write([]byte(s + "\n"))
}

// Run evaluates a list of top-level blocks and handles Fail panics by
// recovering them into the interpreter's FailHandler. It also initializes the
// Interpreter's Context (i.e. clears all variables).
//
// Top-level blocks that are functions definitions (procedures_defnoreturn and
// procedures_defreturn) are stored as function mappings for calling; all other
// top-level blocks are evaluated in arbitrary order.
func (i *Interpreter) Run(b []Block) {
	defer func() {
		if r := recover(); r != nil {
			i.FailHandler(fmt.Sprint(r))
			return
		}
	}()

	i.Context = make(map[string]Value)
	i.Functions = make(map[string]Function)
	toEvaluate := make([]int, 0, 1)
	for idx, block := range b {
		if block.Type == "procedures_defnoreturn" ||
			block.Type == "procedures_defreturn" {
			i.DefineFunction(&block)
		} else {
			toEvaluate = append(toEvaluate, idx)
		}
	}
	for _, idx := range toEvaluate {
		i.Evaluate(&b[idx])
	}
}

// DefineFunction interprets a function block into a definition of a function.
func (i *Interpreter) DefineFunction(b *Block) {
	name := b.SingleFieldWithName(i, "NAME")
	if _, ok := i.Functions[name]; ok {
		i.Fail("Function named '" + name + "' is defined twice.")
		return
	}

	var newFunction Function

	if b.Mutation != nil {
		for _, arg := range b.Mutation.Args {
			newFunction.Inputs = append(newFunction.Inputs, arg.Name)
		}
	}
	newFunction.Body = b.BlockStatementWithName(i, "STACK")
	bv := b.BlockValueWithName("RETURN")
	if bv != nil && len(bv.Blocks) != 0 {
		if len(bv.Blocks) != 1 {
			i.Fail("Multiple STACK blocks in function definition for '" + name + "'")
			return
		}
		returnExpression := bv.Blocks[0]
		newFunction.Return = &returnExpression
	}

	i.Functions[name] = newFunction
}

// Evaluate evaluates a specific block by determining what evaluator can consume
// it. Generally, this is called by Run and by other evaluators; it should not
// need to be called directly.
//
// PrefixHandlers may call Evaluate directly if they are evaluating a type of
// block that itself has values or statements.
func (i *Interpreter) Evaluate(b *Block) Value {
	var evaluator Evaluator
	for k, v := range i.PrefixHandlers {
		if strings.HasPrefix(b.Type, k) {
			evaluator = v
			break
		}
	}
	if evaluator == nil {
		evaluator = evaluators[b.Type]
	}
	if evaluator == nil {
		i.Fail("No evaluator for block '" + b.Type + "'")
		return nilValue
	}
	value := evaluator(i, b)
	if b.Next == nil {
		return value
	} else {
		value = i.Evaluate(b.Next)
		return value
	}
}

// CheckBreak is a helper function that checks if a panic was due to breaking
// from a loop. If it was not, it re-panicks. If it was, it sets continuing to
// true if the enclosing loop should contiue with the next iteration, or false
// if the enclosing loop should break out.
func (i *Interpreter) CheckBreak(continuing *bool) {
	r := recover()

	if r != nil {
		if breakEvent, ok := r.(BreakEvent); ok && breakEvent.Then != ThenReturn {
			*continuing = breakEvent.Then == ThenContinue
		} else {
			panic(r)
		}
	}
}

// CheckReturn is a helper function that checks if a panic was due to a function
// returning early. If it was not, it re-panicks. If it was, it sets retval to
// the value returned.
func (i *Interpreter) CheckReturn(retval *Value) {
	r := recover()

	if r != nil {
		if breakEvent, ok := r.(BreakEvent); ok && breakEvent.Then == ThenReturn {
			*retval = breakEvent.ReturnValue
		} else {
			panic(r)
		}
	}
}
