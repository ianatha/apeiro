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
	"encoding/xml"
	"fmt"
	"io/ioutil"
	"strings"
	"testing"
)

// unittestMainEvaluator evaluates a main unit-test block (which just means it
// evaluates all the statements in the block).
func unittestMainEvaluator(i *Interpreter, b *Block) Value {
	tests := b.SingleBlockStatementWithName(i, "DO")
	return i.Evaluate(tests)
}

// unittestAssertEqualsEvaluator checks the values in assertion match. If not,
// it outputs to Console an explanation as to why the tests were not equal
// prefixed with "FAIL:"
func unittestAssertEqualsEvaluator(i *Interpreter, b *Block) Value {
	actual := i.Evaluate(b.SingleBlockValueWithName(i, "ACTUAL"))
	expected := i.Evaluate(b.SingleBlockValueWithName(i, "EXPECTED"))
	if !expected.Equals(i, actual) {
		msg := b.SingleFieldWithName(i, "MESSAGE")
		_, err := fmt.Fprintf(i.Console, "FAIL: %s: Expected %s, got %s\n",
			msg, expected.AsString(i), actual.AsString(i))
		if err != nil {
			panic(err)
		}
	}
	return nilValue
}

// unittestAssertValueEvaluator asserts the specified value is true, false, or
// null. If not, it outputs to Console an explanation as to why the tests were
// not equal prefixed with "FAIL:"
func unittestAssertValueEvaluator(i *Interpreter, b *Block) Value {
	actual := i.Evaluate(b.SingleBlockValueWithName(i, "ACTUAL"))
	expected := b.SingleFieldWithName(i, "EXPECTED")
	var matched bool
	switch expected {
	case "TRUE":
		matched = actual.AsBoolean(i)
	case "FALSE":
		matched = !actual.AsBoolean(i)
	case "NULL":
		_, ok := actual.(NilValue)
		matched = ok
	default:
		i.Fail("Unknown value assert expected: '" + expected + "'")
	}
	if !matched {
		msg := b.SingleFieldWithName(i, "MESSAGE")
		_, err := fmt.Fprintf(i.Console, "FAIL: %s: Expected %s, got %s\n",
			msg, expected, actual.AsString(i))
		if err != nil {
			panic(err)
		}
	}
	return nilValue
}

// unittestFailEvaluator logs a failure by outputting to Console a message
// prefixed with "FAIL:"
func unittestFailEvaluator(i *Interpreter, b *Block) Value {
	msg := b.SingleFieldWithName(i, "MESSAGE")
	_, err := fmt.Fprintf(i.Console, "FAIL: %s\n", msg)
	if err != nil {
		panic(err)
	}
	return nilValue
}

// Run all of the tests in the xmltests directory, which verify the behavior of
// the Blockly interpreter relative to expectations outlined in the Blockly
// project (https://github.com/google/blockly)
func TestBlocklyGenerators(t *testing.T) {
	var i Interpreter

	PrepareEvaluators()

	i.PrefixHandlers = make(map[string]Evaluator)
	i.PrefixHandlers["unittest_main"] = unittestMainEvaluator
	i.PrefixHandlers["unittest_assertequals"] = unittestAssertEqualsEvaluator
	i.PrefixHandlers["unittest_assertvalue"] = unittestAssertValueEvaluator
	i.PrefixHandlers["unittest_fail"] = unittestFailEvaluator

	fileInfos, err := ioutil.ReadDir("xmltests")
	if err != nil {
		panic(err)
	}
	for _, info := range fileInfos {
		if strings.HasSuffix(info.Name(), ".xml") {
			runTestsInFile(t, &i, "xmltests/"+info.Name())
		}
	}
}

// runTestsInFile evaluates all the XML in the file and generates an Errorf
// result if any tests fail.
func runTestsInFile(t *testing.T, i *Interpreter, fname string) {
	t.Logf("Testing %s", fname)
	xmldata, err := ioutil.ReadFile(fname)
	if err != nil {
		t.Errorf("Unable to read %s: %v\n", fname, err)
		return
	}
	var blocks BlockXml
	err = xml.Unmarshal(xmldata, &blocks)
	if err != nil {
		t.Errorf("Unable to unmarshal %s: %v\n", fname, err)
		return
	}
	var b bytes.Buffer
	i.Console = &b
	i.FailHandler = func(reason string) {
		t.Errorf("%s: Evaluation failed: %s\n", fname, reason)
	}

	i.Run(blocks.Blocks)
	result := b.String()
	if strings.Contains(result, "FAIL:") {
		t.Errorf("%s: Test failed: %s\n", fname, result)
	}
}
