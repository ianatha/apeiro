module github.com/apeiromont/apeiro

go 1.19

require (
	github.com/auth0/go-jwt-middleware/v2 v2.1.0
	github.com/dn365/gin-zerolog v0.0.0-20171227063204-b43714b00db1
	github.com/evanw/esbuild v0.15.11
	github.com/gin-contrib/cors v1.4.0
	github.com/gin-gonic/gin v1.8.1
	github.com/goccy/go-json v0.9.7
	github.com/gwatts/gin-adapter v1.0.0
	github.com/k0kubun/pp v3.0.1+incompatible
	github.com/mattn/go-sqlite3 v1.14.15
	github.com/r3labs/sse/v2 v2.8.1
	github.com/rs/zerolog v1.28.0
	github.com/slack-go/slack v0.11.3
	github.com/smacker/go-tree-sitter v0.0.0-20221031025734-03a9c97d8039
	github.com/stretchr/testify v1.8.0
	go.kuoruan.net/v8go-polyfills v0.5.0
	rogchap.com/v8go v0.7.0
)

require (
	github.com/davecgh/go-spew v1.1.1 // indirect
	github.com/gin-contrib/sse v0.1.0 // indirect
	github.com/go-playground/locales v0.14.0 // indirect
	github.com/go-playground/universal-translator v0.18.0 // indirect
	github.com/go-playground/validator/v10 v10.10.0 // indirect
	github.com/gorilla/websocket v1.4.2 // indirect
	github.com/json-iterator/go v1.1.12 // indirect
	github.com/k0kubun/colorstring v0.0.0-20150214042306-9440f1994b88 // indirect
	github.com/leodido/go-urn v1.2.1 // indirect
	github.com/mattn/go-colorable v0.1.12 // indirect
	github.com/mattn/go-isatty v0.0.14 // indirect
	github.com/modern-go/concurrent v0.0.0-20180228061459-e0a39a4cb421 // indirect
	github.com/modern-go/reflect2 v1.0.2 // indirect
	github.com/pelletier/go-toml/v2 v2.0.1 // indirect
	github.com/pmezard/go-difflib v1.0.0 // indirect
	github.com/ugorji/go/codec v1.2.7 // indirect
	golang.org/x/crypto v0.0.0-20210711020723-a769d52b0f97 // indirect
	golang.org/x/net v0.0.0-20210226172049-e18ecbb05110 // indirect
	golang.org/x/sys v0.1.0 // indirect
	golang.org/x/text v0.3.6 // indirect
	google.golang.org/protobuf v1.28.0 // indirect
	gopkg.in/cenkalti/backoff.v1 v1.1.0 // indirect
	gopkg.in/yaml.v2 v2.4.0 // indirect
	gopkg.in/yaml.v3 v3.0.1 // indirect
)

replace go.kuoruan.net/v8go-polyfills v0.5.0 => ../v8go-polyfills

replace rogchap.com/v8go v0.7.0 => github.com/ianatha/v8go v0.0.0-20221023183758-2e9fa851a5b2

replace github.com/r3labs/sse/v2 v2.8.1 => ../sse
