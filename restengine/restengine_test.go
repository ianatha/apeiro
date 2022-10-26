package restengine

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"reflect"
	"strings"
	"testing"
	"time"

	"github.com/apeiromont/apeiro/runtime"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func SetupApp() (*ApeiroRestAPI, *runtime.ApeiroRuntime) {
	gin.SetMode(gin.TestMode)
	zerolog.SetGlobalLevel(zerolog.TraceLevel)

	tmp, err := os.MkdirTemp("", "apeirotest*")
	if err != nil {
		panic(err)
	}

	a, err := runtime.NewApeiroRuntime(path.Join(tmp, "test.db"))
	if err != nil {
		panic(err)
	}

	return NewApeiroRestAPI(a), a
}

func TestPingHandler(t *testing.T) {
	mockResponse := `{"message":"pong"}`
	r, _ := SetupApp()

	req, _ := http.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()
	r.r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, mockResponse, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)
}

func (api *ApeiroRestAPI) testReq(method string, path string, val interface{}) *httptest.ResponseRecorder {
	return api.testReqWait(method, path, val, false)
}

func (api *ApeiroRestAPI) testReqWait(method string, path string, val interface{}, wait bool) *httptest.ResponseRecorder {
	var body []byte
	var err error

	if reflect.TypeOf(val) == reflect.TypeOf(body) {
		fmt.Printf("keeping as bytes\n")
		body = val.([]byte)
	} else {
		fmt.Printf("converting to json bytes\n")
		body, err = json.Marshal(val)
		fmt.Printf("json: %s\n", string(body))
		if err != nil {
			panic(err)
		}
	}

	req, err := http.NewRequest(method, path, bytes.NewBuffer(body))
	if err != nil {
		panic(err)
	}
	if wait {
		req.Header.Add("Apeiro-Wait", "true")
	}

	w := httptest.NewRecorder()

	api.r.ServeHTTP(w, req)

	return w
}

func TestSpawn(t *testing.T) {
	script := `export default function hello() { return "Hello, world!" }`
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	w := r.testReq("POST", "/src", MountNewReq{
		Src:  script,
		Name: "hello_world",
	})

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, `{"mid":"src_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	w = r.testReq("POST", "/proc", []byte(`{"mid":"src_1"}`))
	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	// TODO
	time.Sleep(100 * time.Millisecond)

	w = r.testReq("GET", "/proc/pid_1", nil)
	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","mid":"mid_1","val":"Hello, world!"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSpawnAndWait(t *testing.T) {
	script := `export default function hello() { return "Hello, world!" }`
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	w := r.testReq("POST", "/src", MountNewReq{
		Src:  script,
		Name: "hello_world_wait",
	})
	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, `{"mid":"src_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	w = r.testReqWait("POST", "/proc", []byte(`{"mid":"src_1"}`), true)
	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","mid":"mid_1","val":"Hello, world!"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	w = r.testReq("GET", "/proc/pid_1", []byte(`{"mid":"src_1"}`))
	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","mid":"mid_1","val":"Hello, world!"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSpawnAndSupplySimpleFunction(t *testing.T) {
	script := strings.TrimSpace(`
import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
import { inputRest } from "pristine://$"

export default function sum() {
	const x = inputRest(zodToJsonSchema(z.object({ val1: z.number() }), "$"));
	const y = inputRest(zodToJsonSchema(z.object({ val2: z.number() }), "$"));
	return x.val1 + y.val2;
}`)
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	w := r.testReq("POST", "/src", MountNewReq{
		Src:  script,
		Name: "sum",
	})

	responseData, _ := io.ReadAll(w.Body)
	require.Equal(t, `{"mid":"src_1"}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	w = r.testReqWait("POST", "/proc", []byte(`{"mid":"src_1"}`), true)

	const waitingSchema1 = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val1":{"type":"number"}},"required":["val1"],"type":"object"}}}}`
	const waitingSchema2 = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val2":{"type":"number"}},"required":["val2"],"type":"object"}}}}`

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","mid":"mid_1","waiting":`+waitingSchema1+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	w = r.testReqWait("POST", "/proc/pid_1", []byte(`{"val1":10}`), true)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","mid":"mid_1","waiting":`+waitingSchema2+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	w = r.testReqWait("POST", "/proc/pid_1", []byte(`{"val2":1}`), true)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","mid":"mid_1","val":11}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	w = r.testReq("GET", "/proc/pid_1", nil)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","mid":"mid_1","val":11}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)
}

// func TestSpawnAndSupplyGenerator(t *testing.T) {
// 	script := strings.TrimSpace(`
// import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
// import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
// import { inputRest } from "pristine://$"

// export default function *hello() {
// 	let sum = 0;
// 	while (true) {
// 		yield sum;
// 		const res = inputRest(zodToJsonSchema(z.object({ val: z.number() }), "$"));
// 		sum = sum + res.val;
// 	}
// 	throw new Error("Should not reach here");
// }`)
// 	r, a := SetupApp()
// 	a.Start()
// 	defer a.Stop()

// 	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
// 	w := httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ := io.ReadAll(w.Body)
// 	require.Equal(t, `{"mid":"src_1"}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"src_1"}`)))
// 	req.Header.Set("Apeiro-Wait", "true")
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	const waitingSchema = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val":{"type":"number"}},"required":["val"],"type":"object"}}}}`

// 	responseData, _ = io.ReadAll(w.Body)
// 	require.JSONEq(t, `{"pid":"pid_1","val":0,"waiting":`+waitingSchema+`}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":10}`)))
// 	req.Header.Set("Apeiro-Wait", "true")
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	require.JSONEq(t, `{"pid":"pid_1","val":10,"waiting":`+waitingSchema+`}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":1}`)))
// 	req.Header.Set("Apeiro-Wait", "true")
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":11}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":100}`)))
// 	req.Header.Set("Apeiro-Wait", "true")
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":111}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":111}`, string(responseData))
// 	require.Equal(t, http.StatusOK, w.Code)
// }
