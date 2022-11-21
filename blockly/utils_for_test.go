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

// Utilities for test evaluation

package blockly

import (
	"runtime"
	"testing"
)

// checkFailInterpreter is a testing utility to verify that the interpreter
// failed while running test. Interpreter failure is represented by a panic, so
// we're just catching panics here.
func checkFailInterpreter(t *testing.T, test func()) {
	defer func() {
		if r := recover(); r != nil {
			return
		}
	}()
	test()

	_, file, line, ok := runtime.Caller(1)
	if !ok {
		file = "UNKNOWN"
		line = 0
	}
	t.Errorf("%s:%d - Failure not called on interpreter.", file, line)
}
