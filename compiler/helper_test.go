package compiler

import (
	"fmt"
	"io/ioutil"
	"strings"
	"testing"

	"github.com/go-playground/assert/v2"
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

func LinesTrimSpace(s string) string {
	lines := strings.Split(s, "\n")
	for i, line := range lines {
		lines[i] = strings.TrimSpace(line)
	}
	return strings.Replace(strings.Join(lines, "\n"), "\n\n", "\n", -1)
}

func FixtureTest(t *testing.T, name string) {
	input, err := ioutil.ReadFile(fmt.Sprintf("test_fixtures/%s.in.js", name))
	if err != nil {
		panic(err)
	}

	expectedOutputBytes, err := ioutil.ReadFile(fmt.Sprintf("test_fixtures/%s.out.js", name))
	if err != nil {
		panic(err)
	}

	expectedOutput := LinesTrimSpace(string(expectedOutputBytes))

	output, err := ApeiroTransform(string(input))
	if err != nil {
		panic(err)
	}

	assert.Equal(t, expectedOutput, LinesTrimSpace(string(output)))
}
