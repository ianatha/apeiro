package compiler

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestApeiroTransformSimple(t *testing.T) {
	FixtureTest(t, "simple")
}

func TestApeiroMultipleFunctions(t *testing.T) {
	FixtureTest(t, "multiple_functions")
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
	FixtureTest(t, "import")
}

func TestImportZod(t *testing.T) {
	FixtureTest(t, "zod")
}

func TestCompileYield(t *testing.T) {
	FixtureTest(t, "yield")
}
