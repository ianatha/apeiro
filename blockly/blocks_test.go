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

// Test for Blockly block XML

package blockly

import (
	"encoding/xml"
	"runtime"
	"testing"
)

var interp *Interpreter = &Interpreter{}

func stringsEqual(t *testing.T, a, b string) {
	if a != b {
		_, file, line, ok := runtime.Caller(1)
		if !ok {
			file = "UNKNOWN"
			line = 0
		}
		t.Errorf("%s:%d - Expected %s to equal %s", file, line, a, b)
	}
}

func intsEqual(t *testing.T, a, b int) {
	if a != b {
		_, file, line, ok := runtime.Caller(1)
		if !ok {
			file = "UNKNOWN"
			line = 0
		}
		t.Errorf("%s:%d - Expected %d to equal %d", file, line, a, b)
	}
}

func TestDeserializeBlock(t *testing.T) {
	blocks := `
<xml xmlns="http://www.w3.org/1999/xhtml">
  <block type="controls_for" x="76" y="-1861">
    <field name="VAR">i</field>
    <value name="FROM">
      <block type="math_number">
	<field name="NUM">0</field>
      </block>
    </value>
    <value name="TO">
      <block type="math_number">
	<field name="NUM">10</field>
      </block>
    </value>
    <value name="BY">
      <block type="math_number">
	<field name="NUM">2</field>
      </block>
    </value>
    <statement name="DO">
      <block type="text_print">
	<value name="TEXT">
	  <block type="variables_get">
	    <field name="VAR">i</field>
	  </block>
	</value>
	<next>
	  <block type="controls_flow_statements">
	    <field name="FLOW">CONTINUE</field>
	  </block>
	</next>
      </block>
    </statement>
    <next>
      <block type="controls_if">
	<mutation else="1">
	</mutation>
	<value name="IF0">
	  <block type="logic_compare">
	    <field name="OP">GT</field>
	    <value name="A">
	      <block type="variables_get">
		<field name="VAR">i</field>
	      </block>
	    </value>
	    <value name="B">
	      <block type="math_number">
		<field name="NUM">5</field>
	      </block>
	    </value>
	  </block>
	</value>
	<statement name="DO0">
	  <block type="text_print">
	    <value name="TEXT">
	      <block type="text">
		<field name="TEXT">hi</field>
	      </block>
	    </value>
	  </block>
	</statement>
	<statement name="ELSE">
	  <block type="text_print">
	    <value name="TEXT">
	      <block type="text">
		<field name="TEXT">hello</field>
	      </block>
	    </value>
	  </block>
	</statement>
      </block>
    </next>
  </block>
</xml>
`
	var unmarshaled BlockXml
	err := xml.Unmarshal([]byte(blocks), &unmarshaled)

	if err != nil {
		t.Fatal("Could not deserialize block: ", err)
	}

	stringsEqual(t, unmarshaled.XMLName.Space, "http://www.w3.org/1999/xhtml")
	stringsEqual(t, unmarshaled.XMLName.Local, "xml")
	intsEqual(t, len(unmarshaled.Blocks), 1)
	loopBlock := unmarshaled.Blocks[0]
	stringsEqual(t, loopBlock.Type, "controls_for")
	stringsEqual(t, loopBlock.X, "76")
	stringsEqual(t, loopBlock.Y, "-1861")

	varField := unmarshaled.Blocks[0].SingleFieldWithName(interp, "VAR")
	stringsEqual(t, varField, "i")

	fromBlock := unmarshaled.Blocks[0].SingleBlockValueWithName(interp, "FROM")
	stringsEqual(t, fromBlock.Type, "math_number")
	stringsEqual(t, fromBlock.SingleFieldWithName(interp, "NUM"), "0")

	body := loopBlock.SingleBlockStatementWithName(interp, "DO")
	stringsEqual(t, body.Type, "text_print")
	body2 := body.Next
	stringsEqual(t, body2.Type, "controls_flow_statements")

	ifBlock := loopBlock.Next
	intsEqual(t, ifBlock.Mutation.Else, 1)
	ifBlock.SingleBlockValueWithName(interp, "IF0")

}

func TestFailToInterpretBlock(t *testing.T) {
	block := Block{
		Type: "test",
		Values: []BlockValue{
			{
				Name:   "empty",
				Blocks: nil,
			},
			{
				Name: "foo",
				Blocks: []Block{
					{
						Type: "found",
					},
				},
			},
		},
		Fields: []BlockField{
			{
				Name:  "bar",
				Value: "barvalue",
			},
		},
		Statements: []BlockStatement{
			{
				Name:   "empty",
				Blocks: nil,
			},
			{
				Name: "baz",
				Blocks: []Block{
					{
						Type: "foundStatement",
					},
				},
			},
		},
	}

	val := block.SingleFieldWithName(interp, "bar")
	stringsEqual(t, val, "barvalue")

	checkFailInterpreter(t, func() {
		block.SingleFieldWithName(interp, "does_not_exist")
	})

	val2 := block.SingleBlockValueWithName(interp, "foo")
	stringsEqual(t, val2.Type, "found")

	checkFailInterpreter(t, func() {
		block.SingleBlockValueWithName(interp, "empty")
	})

	checkFailInterpreter(t, func() {
		block.SingleBlockValueWithName(interp, "does_not_exist")
	})

	val3 := block.SingleBlockStatementWithName(interp, "baz")
	stringsEqual(t, val3.Type, "foundStatement")

	checkFailInterpreter(t, func() {
		block.SingleBlockStatementWithName(interp, "empty")
	})

	checkFailInterpreter(t, func() {
		block.SingleBlockStatementWithName(interp, "does_not_exist")
	})

}
