package blockly

import (
	"fmt"
	"testing"
)

func TestBlocklyGeneration(t *testing.T) {
	js := `export default function main() {
var text;
text = window.prompt('abc');
if (text == 'hello') {
	window.alert('hello world');
}
}`
	fmt.Printf("%s\n", JSToBlockly(js))
}
