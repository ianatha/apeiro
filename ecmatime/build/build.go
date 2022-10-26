package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/apeiromont/apeiro/compiler"
	"github.com/apeiromont/apeiro/ecmatime"
	"github.com/evanw/esbuild/pkg/api"
)

const REMOTE_NAMESPACE = "web"

func main() {
	inputFile := flag.String("in", "", "input file")
	outputFile := flag.String("out", "", "output file")
	flag.Parse()

	if *inputFile == "" || *outputFile == "" {
		fmt.Println("Missing required flag: --in")
		os.Exit(1)
	}

	// inputScript, err := os.ReadFile(*inputFile)
	// if err != nil {
	// 	panic(err)
	// }

	buildResult := api.Build(api.BuildOptions{
		EntryPoints:       []string{*inputFile},
		Format:            api.FormatIIFE,
		Bundle:            true,
		MinifyWhitespace:  false,
		MinifyIdentifiers: false,
		MinifySyntax:      false,
		GlobalName:        ecmatime.OBJECT_NAME,
		Plugins: []api.Plugin{
			compiler.ModuleLoaderPlugin(),
		},
	})

	if buildResult.Errors != nil {
		for _, err := range buildResult.Errors {
			fmt.Printf("build error: %s at %s@%d\n", err.Text, err.Location.File, err.Location.Line)
		}
		os.Exit(1)
	}
	if len(buildResult.OutputFiles) == 1 {
		os.WriteFile(*outputFile, buildResult.OutputFiles[0].Contents, 0644)
	} else {
		panic("Expected exactly one output file")
	}

	// outputScript, err := compiler.CompileTypescriptWithFlags(inputScript, compiler.CompileOptions{
	// 	ApeiroCompilation: false,
	// 	Minify:            true,
	// 	GlobalName:        ecmatime.OBJECT_NAME,
	// })
	// if err != nil {
	// 	fmt.Printf("CompileTypescriptWithFlags: %+v\n", err)
	// 	os.Exit(1)
	// }

	// os.WriteFile(*outputFile, outputScript, 0644)

	fmt.Printf("OK (%s)->(%s)\n", *inputFile, *outputFile)
}
