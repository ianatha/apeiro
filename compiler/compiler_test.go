package compiler

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestApeiroTransformSimple(t *testing.T) {
	transformer, err := newExternalTransformer()
	if err != nil {
		t.Error(err)
	}
	defer transformer.Close()

	assert.Nil(t, err)
	result, err := transformer.ApeiroTransform([]byte(`function simple(a, b) {
let c = a + b;
let d = a * square(b);
return c + d;
}`))
	assert.Nil(t, err)
	assert.Equal(t, `function simple($ctx, a, b) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      $f0.s.c = a + b;
      $f0.pc++;

    case 1:
      $f0.s._square = square(b);
      $f0.pc++;

    case 2:
      $f0.s.d = a * $f0.s._square;
      $f0.pc++;

    case 3:
      delete $f0.s._square;
      $f0.pc++;

    case 4:
      return $f0.s.c + $f0.s.d;
      $f0.pc++;
  }

  $f0.end();
}`, strings.TrimSpace(string(result)))
}

func TestCompileTypescript(t *testing.T) {
	input := `
export default function simple(a: number, b: number): number {
	c = a + b;
	d = a * b
	return c + d;
}`
	output, err := CompileTypescript([]byte(input))
	assert.Nil(t, err)

	assert.Equal(t, `var $fn=(()=>{var n=Object.defineProperty;var f=Object.getOwnPropertyDescriptor;var r=Object.getOwnPropertyNames;var i=Object.prototype.hasOwnProperty;var o=(s,e)=>{for(var t in e)n(s,t,{get:e[t],enumerable:!0})},u=(s,e,t,p)=>{if(e&&typeof e=="object"||typeof e=="function")for(let a of r(e))!i.call(s,a)&&a!==t&&n(s,a,{get:()=>e[a],enumerable:!(p=f(e,a))||p.enumerable});return s};var l=s=>u(n({},"__esModule",{value:!0}),s);var h={};o(h,{default:()=>m});function m(s,e,t){const p=s.frame();switch(p.pc){case 0:c=e+t,p.pc++;case 1:d=e*t,p.pc++;case 2:return c+d}p.end()}return l(h);})();`, strings.TrimSpace(string(output)))
}

func TestCompileImport(t *testing.T) {
	input := `import { receive } from "pristine://$";

export default function simple(a: number, b: number): number {
	c = a + b;
	d = a * b
	e = receive('specifier');
	return c + d + e;
}`

	output, err := CompileTypescriptWithFlags([]byte(input), CompileOptions{
		ApeiroCompilation: true,
		GlobalName:        "$fn",
		Minify:            false,
	})
	assert.Nil(t, err)

	assert.Equal(t, `// deno-fmt-ignore-file
// deno-lint-ignore-file
// This code was bundled using `+"`deno bundle`"+` and it's not recommended to edit it manually

const receive = $apeiro.importFunction("$", "receive");
function simple($ctx, a, b) {
    const $f0 = $ctx.frame();
    switch($f0.pc){
        case 0:
            c = a + b;
            $f0.pc++;
        case 1:
            d = a * b;
            $f0.pc++;
        case 2:
            e = $ctx.getFunction(receive)("specifier");
            $f0.pc++;
        case 3:
            return c + d + e;
            $f0.pc++;
    }
    $f0.end();
}
export { simple as default };`, strings.TrimSpace(string(output)))
}
