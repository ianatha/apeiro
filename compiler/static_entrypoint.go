package compiler

import (
	"github.com/evanw/esbuild/pkg/api"
)

const ENTRYPOINT_NAMESPACE = "ENTRYPOINT"

func StaticEntryPointPlugin(codeBytes []byte) api.Plugin {
	code := string(codeBytes)
	return api.Plugin{
		Name: "static-entrypoing",
		Setup: func(build api.PluginBuild) {
			build.OnResolve(api.OnResolveOptions{Filter: "ENTRYPOINT"}, func(args api.OnResolveArgs) (api.OnResolveResult, error) {
				return api.OnResolveResult{
					Path:      "ENTRYPOINT",
					Namespace: ENTRYPOINT_NAMESPACE,
				}, nil
			})
			build.OnLoad(api.OnLoadOptions{Filter: ENTRYPOINT_NAMESPACE, Namespace: ENTRYPOINT_NAMESPACE}, func(args api.OnLoadArgs) (api.OnLoadResult, error) {
				return api.OnLoadResult{
					Contents: &code,
					Loader:   api.LoaderTS,
				}, nil
			})
		},
	}
}
