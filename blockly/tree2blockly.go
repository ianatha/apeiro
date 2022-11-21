package blockly

import (
	"encoding/xml"
	"fmt"
	"strings"

	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/javascript"
)

// type TreeVisitor interface {
// 	VisitRoot(*sitter.Node)
// 	visitFunction(*sitter.Node)
// }

type BlocklyGeneratingVisitor struct {
	content     []byte
	depth       int
	out         strings.Builder
	in_function bool
}

type TreeElement struct {
	Node *sitter.Node
	Idx  uint32
	Name string
}

func TreeIterator(node *sitter.Node) chan *TreeElement {
	count := node.ChildCount()
	// namedCount := node.NamedChildCount()
	ch := make(chan *TreeElement, 1)
	go func() {
		for i := uint32(0); i < count; i++ {
			ch <- &TreeElement{
				Node: node.Child(int(i)),
				Idx:  i,
				Name: node.FieldNameForChild(int(i)),
			}
		}
		close(ch)
	}()
	return ch
}

func (v *BlocklyGeneratingVisitor) visitChildren(node *sitter.Node) {
	v.depth += 1
	for child := range TreeIterator(node) {
		v.visit(child.Node, child.Name)
	}
	v.depth += -1
}

func (v *BlocklyGeneratingVisitor) VisitRoot(node *sitter.Node) string {
	if v.out.Len() != 0 {
		panic("VisitRoot called twice")
	}
	v.visit(node, "")
	return v.out.String()
}

// Visit implements TreeVisitor
func (v *BlocklyGeneratingVisitor) visit(node *sitter.Node, name string) {
	if node.Type() == "identifier" {
		v.visitIdentifier(node)
	} else if node.Type() == "program" {
		v.visitProgram(node)
	} else if node.Type() == "function" && node.ChildCount() > 0 {
		v.visitFunction(node)
	} else {
		fmt.Printf("%s%s (%s)\n", strings.Repeat(" ", v.depth), node.Type(), name)
		v.visitChildren(node)
	}

}

func (v *BlocklyGeneratingVisitor) visitProgram(node *sitter.Node) {
	v.out.WriteString(`<xml xmlns="http://www.w3.org/1999/xhtml">`)
	v.visitChildren(node)
	v.out.WriteString(`</xml>`)
}

// visitFunction implements TreeVisitor
func (v *BlocklyGeneratingVisitor) visitFunction(node *sitter.Node) {
	v.out.WriteString(`<block type="controls_if">`)
	v.in_function = true
	v.visitChildren(node)
	v.in_function = false
	v.out.WriteString(`</block>`)
}

func (v *BlocklyGeneratingVisitor) visitIdentifier(node *sitter.Node) {
	v.out.WriteString(`<identifier>`)
	v.out.WriteString(node.Content(v.content))
	v.visitChildren(node)
	v.out.WriteString(`</identifier>`)
}

// var _ TreeVisitor = (*BlocklyGeneratingVisitor)(nil)

func WithEachCapture(query string, node *sitter.Node, fn func(string, *sitter.Node)) error {
	q, err := sitter.NewQuery([]byte(query), javascript.GetLanguage())
	if err != nil {
		return err
	}
	defer q.Close()

	c := sitter.NewQueryCursor()
	defer c.Close()

	c.Exec(q, node)
	for match, next := c.NextMatch(); next; match, next = c.NextMatch() {
		for _, capture := range match.Captures {
			field := q.CaptureNameForId(capture.Index)
			fn(field, capture.Node)
		}
	}
	return nil
}

var root = BlockXml{}
var lastBlock *Block

func appendBlock(newBlock Block) {
	if lastBlock == nil {
		root.Blocks = append(root.Blocks, newBlock)
		lastBlock = &root.Blocks[len(root.Blocks)-1]
	} else {
		lastBlock.Next = &newBlock
		lastBlock = &newBlock
	}
}

var js []byte

func node2Blockly(node *sitter.Node) Block {
	switch node.Type() {
	case "call_expression":
		fmt.Printf("%s\n", node.Content(js))
	}
	return Block{
		Type: "text_prompt_ext",
		Fields: []BlockField{
			{
				Name:  "TYPE",
				Value: "TEXT",
			},
		},
		Mutation: &BlockMutation{
			Type: "TEXT",
		},
		Values: []BlockValue{
			{
				Name: "TEXT",
				Blocks: []Block{
					{
						Type: "text",
						Fields: []BlockField{
							{
								Name:  "TEXT",
								Value: "abc",
							},
						},
					},
				},
			},
		},
	}
}

func visitExpressionStatement(node *sitter.Node) {
	WithEachCapture(`
		(expression_statement
			[
				(assignment_expression) @assign
				(if_statement) @ifstmt
			]+
		)
	`, node, func(field string, node *sitter.Node) {
		if field == "assign" {
			left := node.ChildByFieldName("left").Content(js)
			appendBlock(Block{
				Type: "variables_set",
				Fields: []BlockField{
					{
						Name:  "VAR",
						Value: left,
					},
				},
				Values: []BlockValue{
					{
						Name: "VALUE",
						Blocks: []Block{
							node2Blockly(node.ChildByFieldName("right")),
						},
					},
				},
			})
		}
	})
}

func JSToBlockly(jss string) string {
	parser := sitter.NewParser()
	parser.SetLanguage(javascript.GetLanguage())
	js = []byte(jss)
	tree := parser.Parse(nil, js)

	fmt.Printf("\n\nroot_node: %v\n\n", tree.RootNode().String())

	// generator := &BlocklyGeneratingVisitor{
	// 	content: []byte(js),
	// }
	// generated := generator.VisitRoot(tree.RootNode())

	err := WithEachCapture(`(export_statement
		value: (function
			name: (identifier) @function_name
			parameters: (formal_parameters)
			body: (statement_block
[
	(expression_statement
		(assignment_expression)
	)
	(if_statement)
]+ @stmt
			) @whole_func
		)
)`, tree.RootNode(), func(field string, captured *sitter.Node) {
		fmt.Printf("field: %s, node: %s\n", field, captured.String())
		if field == "stmt" {
			capturedSrc := captured.Content([]byte(js))
			fmt.Printf("%s: %s = %s\n", field, captured.Type(), capturedSrc)
			if captured.Type() == "expression_statement" {
				visitExpressionStatement(captured)
			} else if captured.Type() == "if_statement" {
				condition := captured.ChildByFieldName("condition")
				// consequence := captured.ChildByFieldName("consequence")
				appendBlock(Block{
					Type: "controls_if",
					Values: []BlockValue{
						{
							Name: "IF0",
							Blocks: []Block{
								node2Blockly(condition),
							},
						},
					},
					Fields: []BlockField{
						{
							Name:  "DO0",
							Value: "item",
						},
						{
							Name: "ELSE",
						},
					},
				})
			}

			// 	if captured.Child(0).Type() == "assignment_expression" {
			// 		captured = captured.Child(0)
			// 		appendBlock(Block{
			// 			Type: "variables_set",
			// 			Fields: []BlockField{
			// 				{
			// 					Name:  "VAR",
			// 					Value: "item",
			// 				},
			// 			},
			// 		})
			// 	}
			// } else if captured.Type() == "if_statement" {
			// 	appendBlock(Block{
			// 		Type: "controls_if",
			// 	})
			// }
		}
	})
	if err != nil {
		panic(err)
	}

	out, err := xml.MarshalIndent(&root, "", "  ")
	if err != nil {
		panic(err)
	}
	fmt.Printf("\n\n%s\n\n", out)
	// fmt.Printf("\n\ngenerated: %s\n", generated)

	// if !tree.RootNode().HasError() && TreeContainsFunction(tree.RootNode()) {
	// 	return js
	// }
	return jss
}
