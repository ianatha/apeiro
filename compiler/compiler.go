package compiler

import (
	"bytes"
	_ "embed"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/evanw/esbuild/pkg/api"
)

const TEMPDIR_PATTERN = "apeiro_compiler"
const BABEL_TRANSFORMER_ENTRYPOINT = "index.ts"
const BABEL_TRANSFORMER_IMPORTMAP = "import_map.json"

//go:embed bundler_import_map.json
var babelTransformationImportMap string

//go:embed index.ts
var babelTransformationScript string

type externalTransformer struct {
	dir string
}

func newExternalTransformer() (*externalTransformer, error) {
	dir, err := os.MkdirTemp("", TEMPDIR_PATTERN)
	if err != nil {
		return nil, err
	}

	index_ts, err := os.Create(filepath.Join(dir, BABEL_TRANSFORMER_ENTRYPOINT))
	if err != nil {
		return nil, err
	}
	index_ts.WriteString(babelTransformationScript)
	index_ts.Close()

	import_map_json, err := os.Create(filepath.Join(dir, BABEL_TRANSFORMER_IMPORTMAP))
	if err != nil {
		return nil, err
	}
	index_ts.WriteString(babelTransformationImportMap)
	import_map_json.Close()

	return &externalTransformer{
		dir: dir,
	}, nil
}

func (t *externalTransformer) ApeiroTransform(input []byte) ([]byte, error) {
	babelTransformCmd := exec.Command("/usr/bin/env", "deno", "run", "--cached-only", "--no-check", "--allow-all", filepath.Join(t.dir, BABEL_TRANSFORMER_ENTRYPOINT))
	babelTransformCmd.Stdin = bytes.NewReader(input)
	babelTransformCmd.Stderr = os.Stderr
	result, err := babelTransformCmd.Output()
	if err != nil {
		return nil, err
	}
	return result, nil
}

func (t *externalTransformer) Close() error {
	return os.RemoveAll(t.dir)
}

func denoBundle(input []byte) ([]byte, error) {
	wd, err := os.Getwd()
	if err != nil {
		return nil, err
	}
	tmpfile, err := os.CreateTemp(wd, "*.js")
	if err != nil {
		return nil, err
	}
	defer os.Remove(tmpfile.Name())

	_, err = tmpfile.Write(input)
	if err != nil {
		return nil, err
	}

	err = tmpfile.Close()
	if err != nil {
		return nil, err
	}

	denoBundleOutput, err := exec.Command("/usr/bin/env", "deno", "bundle", "--no-check", tmpfile.Name()).Output()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			return nil, fmt.Errorf("deno bundle failed: %s", exitError.Stderr)
		} else {
			return nil, fmt.Errorf("deno bundle failed: %w", err)
		}
	}

	return denoBundleOutput, nil
}

type CompileOptions struct {
	ApeiroCompilation bool
	Minify            bool
	GlobalName        string
}

func CompileTypescriptWithFlags(input []byte, flags CompileOptions) ([]byte, error) {
	firstStep := api.Transform(string(input), api.TransformOptions{
		Loader:            api.LoaderTS,
		Format:            api.FormatDefault,
		MinifySyntax:      false,
		MinifyWhitespace:  false,
		MinifyIdentifiers: false,
	})
	if firstStep.Errors != nil {
		return nil, errors.New("while transforming TS: " + firstStep.Errors[0].Text)
	}

	var secondStep []byte
	if flags.ApeiroCompilation {
		transformer, err := newExternalTransformer()
		if err != nil {
			return nil, err
		}
		defer transformer.Close()

		secondStep, err = transformer.ApeiroTransform([]byte(firstStep.Code))
		if err != nil {
			return nil, err
		}
	} else {
		secondStep = firstStep.Code
	}

	thirdStep, err := denoBundle(secondStep)
	if err != nil {
		return nil, fmt.Errorf("while bundling: %w", err)
	}

	var finalResult []byte
	if flags.Minify {
		finalResults := api.Transform(string(thirdStep), api.TransformOptions{
			Loader:            api.LoaderTS,
			Format:            api.FormatIIFE,
			MinifySyntax:      false,
			MinifyWhitespace:  false,
			MinifyIdentifiers: false,
			GlobalName:        flags.GlobalName,
			Target:            api.ES2016,
		})
		if finalResults.Errors != nil {
			fmt.Printf("%s\n", thirdStep)
			return nil, errors.New("while converting js to IFFE: " + finalResults.Errors[0].Text)
		}
		finalResult = finalResults.Code
	} else {
		finalResult = thirdStep
	}

	return finalResult, nil
}

func CompileTypescript(input []byte) ([]byte, error) {
	return CompileTypescriptWithFlags(input, CompileOptions{
		ApeiroCompilation: true,
		GlobalName:        "$fn",
		Minify:            true,
	})
}
