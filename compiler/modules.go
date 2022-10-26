package compiler

import (
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/evanw/esbuild/pkg/api"
)

const REMOTE_NAMESPACE = "web"

func ModuleLoaderPlugin() api.Plugin {
	return api.Plugin{
		Name: "module-loader",
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
