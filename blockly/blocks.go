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
	"encoding/xml"
)

// Top-level blockly XML container
type BlockXml struct {
	XMLName xml.Name `xml:"xml"`
	Blocks  []Block  `xml:"block"`
}

// A single Blockly block
type Block struct {
	XMLName    xml.Name         `xml:"block"`
	Type       string           `xml:"type,attr"`
	X          string           `xml:"x,attr"`
	Y          string           `xml:"y,attr"`
	Values     []BlockValue     `xml:"value"`
	Fields     []BlockField     `xml:"field"`
	Statements []BlockStatement `xml:"statement"`
	Next       *Block           `xml:"next>block"`
	Mutation   *BlockMutation   `xml:"mutation"`
}

// A value in a Blockly block. Values are blocks that will evaluate to a value.
type BlockValue struct {
	Name   string  `xml:"name,attr"`
	Blocks []Block `xml:"block"`
}

// A field attached to a Blockly block
type BlockField struct {
	Name  string `xml:"name,attr"`
	Value string `xml:",chardata"`
}

// A statement in a Blockly block. Statements are (usually stacks of) Blockly
// blocks with an ignorable return value.
type BlockStatement struct {
	XMLName xml.Name `xml:"statement"`
	Name    string   `xml:"name,attr"`
	Blocks  []Block  `xml:"block"`
}

// Modifiers on Blockly blocks. Indicates if a block has special encoding (such
// as the "elseif" / "elses" mutations on if blocks).
type BlockMutation struct {
	At         bool               `xml:"at,attr,omitempty"`
	At1        bool               `xml:"at1,attr,omitempty"`
	At2        bool               `xml:"at2,attr,omitempty"`
	ElseIf     int                `xml:"elseif,attr,omitempty"`
	Else       int                `xml:"else,attr,omitempty"`
	Items      int                `xml:"items,attr,omitempty"`
	Mode       string             `xml:"mode,attr,omitempty"`
	Statement  bool               `xml:"statement,attr,omitempty"`
	Statements bool               `xml:"statements,attr,omitempty"`
	Name       string             `xml:"name,attr,omitempty"`
	Type       string             `xml:"type,attr,omitempty"`
	Args       []BlockMutationArg `xml:"arg,omitempty"`
}

// An argument mutation. Used with function blocks to indicate arguments to the
// function.
type BlockMutationArg struct {
	Name string `xml:"name,attr"`
}

// FieldWithName fetches the field with a given name, or returns nil if the
// field doesn't exist.
func (b *Block) FieldWithName(name string) *BlockField {
	for _, v := range b.Fields {
		if v.Name == name {
			return &v
		}
	}
	return nil
}

// SingleFieldWithName fetches the value of the field with the given name, or
// "". Fails interpretation if the field doesn't exist.
func (b *Block) SingleFieldWithName(i *Interpreter, name string) string {
	fv := b.FieldWithName(name)
	if fv == nil {
		i.Fail("No field named " + name)
		return ""
	}
	return fv.Value

}

// BlockValueWithName retrieves the block value with the specified name, or
// returns nil if the block value doesn't exist.
func (b *Block) BlockValueWithName(name string) *BlockValue {
	for _, v := range b.Values {
		if v.Name == name {
			return &v
		}
	}
	return nil
}

// SingleBlockValueWithName retrieves the single block in the block value with
// the specified name, or nil. Fails interpretation if there is not exactly one
// single block for the specified value.
func (b *Block) SingleBlockValueWithName(i *Interpreter, name string) *Block {
	bv := b.BlockValueWithName(name)
	if bv == nil {
		i.Fail("No block with value " + name)
		return nil
	}
	if len(bv.Blocks) != 1 {
		i.Fail("Block socket does not have exactly one block attached to it.")
		return nil
	}
	return &bv.Blocks[0]
}

// BlockStatementWithName retrieves the statement with the specified name, or
// returns nil if the statement doesn't exist.
func (b *Block) BlockStatementWithName(i *Interpreter, name string) *Block {
	for _, v := range b.Statements {
		if v.Name == name {
			if len(v.Blocks) != 1 {
				i.Fail("Block socket does not have exactly one block attached to it.")
				return nil
			}
			return &v.Blocks[0]
		}
	}
	return nil
}

// SingleBlockStatementWIthName retrieves the single block in the block
// statement with the specified name, or nil. Fails interpretation if there is
// not a single block in the specified statement.
func (b *Block) SingleBlockStatementWithName(i *Interpreter, name string) *Block {
	result := b.BlockStatementWithName(i, name)
	if result == nil {
		i.Fail("No statement with name " + name)
	}
	return result
}
