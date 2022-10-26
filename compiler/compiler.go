package compiler

import (
	"bytes"
	_ "embed"
	"errors"
	"os"
	"os/exec"
	"path/filepath"

	"github.com/evanw/esbuild/pkg/api"
	"github.com/k0kubun/pp"
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

// func bundle(input []byte) ([]byte, error) {
// 	buildResult := api.Build(api.BuildOptions{
// 		EntryPoints:       []string{"ENTRYPOINT"},
// 		Format:            api.FormatIIFE,
// 		Bundle:            true,
// 		MinifyWhitespace:  false,
// 		MinifyIdentifiers: false,
// 		MinifySyntax:      false,
// 		GlobalName:        ecmatime.OBJECT_NAME,
// 		Plugins: []api.Plugin{
// 			StaticEntryPointPlugin(input),
// 			ModuleLoaderPlugin(),
// 		},
// 	})

// 	if buildResult.Errors != nil {
// 		return nil, errors.New("while bundling: " + buildResult.Errors[0].Text)
// 	}

// 	return buildResult.OutputFiles[0].Contents, nil
// }

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

	finalResults := api.Build(api.BuildOptions{
		// Loader:            api.LoaderTS,
		EntryPoints:       []string{"ENTRYPOINT"},
		Format:            api.FormatIIFE,
		Bundle:            true,
		MinifySyntax:      flags.Minify,
		MinifyWhitespace:  flags.Minify,
		MinifyIdentifiers: flags.Minify,
		GlobalName:        flags.GlobalName,
		Target:            api.ES2016,
		Plugins: []api.Plugin{
			StaticEntryPointPlugin(secondStep),
			ModuleLoaderPlugin(),
		},
	})
	if finalResults.Errors != nil {
		pp.Print(finalResults.Errors)
		return nil, errors.New("while converting js to IFFE: " + finalResults.Errors[0].Text)
	}
	finalResult := finalResults.OutputFiles[0].Contents

	return finalResult, nil
}

func CompileTypescript(input []byte) ([]byte, error) {
	return CompileTypescriptWithFlags(input, CompileOptions{
		ApeiroCompilation: true,
		GlobalName:        "$fn",
		Minify:            true,
	})
}
