package main

import (
	"flag"
	"fmt"
	"os"

	"github.com/apeiromont/apeiro/compiler"
	"github.com/apeiromont/apeiro/ecmatime"
)

func main() {
	inputFile := flag.String("in", "", "input file")
	outputFile := flag.String("out", "", "output file")
	flag.Parse()

	if *inputFile == "" || *outputFile == "" {
		fmt.Println("Missing required flag: --in")
		os.Exit(1)
	}

	inputScript, err := os.ReadFile(*inputFile)
	if err != nil {
		panic(err)
	}

	outputScript, err := compiler.CompileTypescriptWithFlags(inputScript, compiler.CompileOptions{
		ApeiroCompilation: false,
		GlobalName:        ecmatime.OBJECT_NAME,
	})
	if err != nil {
		fmt.Printf("CompileTypescriptWithFlags: %+v\n", err)
		os.Exit(1)
	}

	os.WriteFile(*outputFile, outputScript, 0644)

	fmt.Printf("OK (%s)->(%s)\n", *inputFile, *outputFile)
}
