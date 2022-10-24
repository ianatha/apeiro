package compiler

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
)

func ApeiroTransform(input string) (string, error) {
	transformer, err := newExternalTransformer()
	if err != nil {
		return "", err
	}
	defer transformer.Close()

	result, err := transformer.ApeiroTransform([]byte(input))
	if err != nil {
		return "", err
	}

	return strings.TrimSpace(string(result)), nil
}

func TestApeiroTransformSimple(t *testing.T) {
	result, err := ApeiroTransform(`function simple(a, b) {
let c = a + b;
let d = a * square(b);
return c + d;
}`)
	assert.Nil(t, err)
	assert.Equal(t, `function simple($ctx, a, b) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      $f0.s.c = a + b;
      $f0.pc++;

    case 1:
      $f0.s._square = $ctx.call(square, b);
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
}

simple.$apeiro_func = true;`, result)
}

func TestApeiroMultipleFunctions(t *testing.T) {
	result, err := ApeiroTransform(`import { input } from "pristine://$";
function number() {
  return 100;
}

export default function simple(a, b) {
  let c = number() + b;
  let d = a * square(b) * input(10);
  let e = number();
  return c + d;
}`)
	assert.Nil(t, err)
	assert.Equal(t, `const input = $apeiro.importFunction("$", "input");

function number($ctx) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      return 100;
      $f0.pc++;
  }

  $f0.end();
}

number.$apeiro_func = true;
export default function simple($ctx, a, b) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      $f0.s._number = $ctx.call(number);
      $f0.pc++;

    case 1:
      $f0.s.c = $f0.s._number + b;
      $f0.pc++;

    case 2:
      delete $f0.s._number;
      $f0.pc++;

    case 3:
      $f0.s._square = $ctx.call(square, b);
      $f0.pc++;

    case 4:
      $f0.s._$ctxGetFunction = $ctx.call($ctx.getFunction(input), 10);
      $f0.pc++;

    case 5:
      $f0.s.d = a * $f0.s._square * $f0.s._$ctxGetFunction;
      $f0.pc++;

    case 6:
      delete $f0.s._$ctxGetFunction;
      $f0.pc++;

    case 7:
      delete $f0.s._square;
      $f0.pc++;

    case 8:
      $f0.s.e = $ctx.call(number);
      $f0.pc++;

    case 9:
      return $f0.s.c + $f0.s.d;
      $f0.pc++;
  }

  $f0.end();
}
simple.$apeiro_func = true;`, strings.TrimSpace(string(result)))
}

func TestCompileTypescript(t *testing.T) {
	input := `export default function simple(a: number, b: number): number {
	c = a + b;
	d = a * b
	return c + d;
}`
	_, err := CompileTypescript([]byte(input))
	assert.Nil(t, err)
}

func TestCompileImport(t *testing.T) {
	output, err := ApeiroTransform(`import { receive } from "pristine://$";

export default function simple(a, b) {
	let c = a + b;
	let d = a * b;
	let e = receive('specifier');
	return c + d + e;
}`)

	assert.Nil(t, err)

	assert.Equal(t, `const receive = $apeiro.importFunction("$", "receive");
export default function simple($ctx, a, b) {
  const $f0 = $ctx.frame();

  switch ($f0.pc) {
    case 0:
      $f0.s.c = a + b;
      $f0.pc++;

    case 1:
      $f0.s.d = a * b;
      $f0.pc++;

    case 2:
      $f0.s.e = $ctx.call($ctx.getFunction(receive), 'specifier');
      $f0.pc++;

    case 3:
      return $f0.s.c + $f0.s.d + $f0.s.e;
      $f0.pc++;
  }

  $f0.end();
}
simple.$apeiro_func = true;`, strings.TrimSpace(string(output)))
}
