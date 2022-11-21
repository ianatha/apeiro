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
	"bytes"
	"os"
	"testing"
)

func TestMain(m *testing.M) {
	PrepareEvaluators()
	os.Exit(m.Run())
}

// TestConsoleOutputCatchesPrintBlocks verifies that print outputs to the
// console stored in the Interpreter.
func TestConsoleOutputCatchesPrintBlocks(t *testing.T) {
	var i Interpreter
	buffer := new(bytes.Buffer)
	i.Console = buffer

	b := Block{
		Type: "text_print",
		Values: []BlockValue{
			{
				Name: "TEXT",
				Blocks: []Block{
					{
						Type: "text",
						Fields: []BlockField{
							{
								Name:  "TEXT",
								Value: "hello, test",
							},
						},
					},
				},
			},
		},
	}

	i.Run([]Block{b})

	if result := buffer.String(); result != "hello, test\n" {
		t.Errorf("Expected result to be \"hello, test\n\", was %s",
			result)
	}
}

// TestFailHandlesPanics verifies that the interpreter handles panics.
func TestFailHandlesPanics(t *testing.T) {
	var i Interpreter
	var failResult string
	i.FailHandler = func(fMsg string) {
		failResult = fMsg
	}

	failingStatement := Block{
		Type: "lists_length",
		Values: []BlockValue{
			{
				Name: "VALUE",
				Blocks: []Block{
					{
						Type: "text",
						Fields: []BlockField{
							{
								Name:  "TEXT",
								Value: "hello, test",
							},
						},
					},
				},
			},
		},
	}

	i.Run([]Block{failingStatement})

	if failResult != "String 'hello, test' is not a list." {
		t.Errorf("Expected failResult to be "+
			"\"String 'hello, test' is not a list.\", was %s", failResult)
	}
}

// TestAddingPrefixHandlers verifies that prefix handlers catch for all prefixes
// they are associated with.
func TestAddingPrefixHandlers(t *testing.T) {
	var i Interpreter
	var failMsg string

	calledPrefixes := make(map[string]int)

	i.PrefixHandlers = make(map[string]Evaluator)

	i.PrefixHandlers["test_"] = func(i *Interpreter, b *Block) Value {
		calledPrefixes[b.Type] += 1
		return nilValue
	}

	i.FailHandler = func(fMsg string) {
		failMsg = fMsg
	}

	testBlocks := Block{
		Type: "test_foo",
		Next: &Block{
			Type: "test_bar",
			Next: &Block{
				Type: "nope",
			},
		},
	}

	i.Run([]Block{testBlocks})

	if len(calledPrefixes) != 2 {
		t.Errorf("Expected 2 called prefixes, got %d", len(calledPrefixes))
	}

	if calledPrefixes["test_foo"] != 1 {
		t.Errorf("Expected test_foo called 1 time, was called %d times.",
			calledPrefixes["test_foo"])
	}
	if calledPrefixes["test_bar"] != 1 {
		t.Errorf("Expected test_bar called 1 time, was called %d times.",
			calledPrefixes["test_bar"])
	}
	if failMsg != "No evaluator for block 'nope'" {
		t.Errorf("Expected failMsg to be \"No evaluator for block "+
			"'nope'\", was %s", failMsg)
	}
}
