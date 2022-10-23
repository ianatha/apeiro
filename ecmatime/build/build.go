package main

import (
	"flag"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/apeiromont/apeiro/ecmatime"
	"github.com/evanw/esbuild/pkg/api"
)

const REMOTE_NAMESPACE = "web"

func DenoModuleLoaderPlugin() api.Plugin {
	return api.Plugin{
		Name: "deno-module-loader",
		Setup: func(build api.PluginBuild) {
			build.OnResolve(api.OnResolveOptions{Filter: ".*", Namespace: REMOTE_NAMESPACE}, func(args api.OnResolveArgs) (api.OnResolveResult, error) {
				fmt.Printf("resolve2: %+v\n", args)
				url, err := url.Parse(args.Path)

				if err != nil {
					fmt.Printf("invalid url: %+v\n", args.Path)
					return api.OnResolveResult{}, err
				}
				base, err := url.Parse(args.Importer)
				if err != nil {
					fmt.Printf("invalid url: %+v\n", args.Path)
					return api.OnResolveResult{}, err
				}

				return api.OnResolveResult{
					Path:      base.ResolveReference(url).String(),
					Namespace: REMOTE_NAMESPACE,
				}, nil
			})
			build.OnResolve(api.OnResolveOptions{Filter: "https?://.*"}, func(args api.OnResolveArgs) (api.OnResolveResult, error) {
				fmt.Printf("resolve: %+v\n", args)
				if strings.HasPrefix(args.Path, "https://") || strings.HasPrefix(args.Path, "http://") {
					return api.OnResolveResult{
						Path:      args.Path,
						Namespace: REMOTE_NAMESPACE,
					}, nil
				} else if args.Namespace == REMOTE_NAMESPACE {
					return api.OnResolveResult{
						Path:      args.Path,
						Namespace: REMOTE_NAMESPACE,
					}, nil
				} else {
					return api.OnResolveResult{
						Path: args.Path,
					}, nil
					return api.OnResolveResult{
						Errors: []api.Message{{
							Text: fmt.Sprintf("Cannot resolve module %q imported from %q", args.Path, args.Importer),
						}},
					}, nil
				}
			})
			build.OnLoad(api.OnLoadOptions{Filter: "https?://.*", Namespace: REMOTE_NAMESPACE}, func(args api.OnLoadArgs) (api.OnLoadResult, error) {
				fmt.Printf("load: %+v\n", args)
				resp, err := http.Get(args.Path)
				if err != nil {
					return api.OnLoadResult{}, err
				}

				defer resp.Body.Close()
				body, err := io.ReadAll(resp.Body)
				if err != nil {
					return api.OnLoadResult{}, err
				}
				bodyStr := string(body)

				return api.OnLoadResult{
					Contents: &bodyStr,
					Loader:   api.LoaderTS,
				}, nil
			})
		},
	}
}

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
			DenoModuleLoaderPlugin(),
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
