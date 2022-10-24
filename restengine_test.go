package apeiro

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"strings"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func SetupApp() (*gin.Engine, *ApeiroRuntime) {
	gin.SetMode(gin.TestMode)
	zerolog.SetGlobalLevel(zerolog.TraceLevel)

	tmp, err := os.MkdirTemp("", "apeirotest*")
	if err != nil {
		panic(err)
	}

	a, err := NewApeiroRuntime(path.Join(tmp, "test.db"))
	if err != nil {
		panic(err)
	}

	return RESTRouter(a), a
}

func TestPingHandler(t *testing.T) {
	mockResponse := `{"message":"pong"}`
	r, _ := SetupApp()

	req, _ := http.NewRequest("GET", "/ping", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, mockResponse, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSpawn(t *testing.T) {
	script := `export default function hello() { return "Hello, world!" }`
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, `{"mid":"fn_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	// TODO
	time.Sleep(100 * time.Millisecond)

	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","val":"Hello, world!"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)
}

func TestSpawnAndWait(t *testing.T) {
	script := `export default function hello() { return "Hello, world!" }`
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(t, `{"mid":"fn_1"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","val":"Hello, world!"}`, string(responseData))
	assert.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	assert.Equal(t, `{"pid":"pid_1","val":"Hello, world!"}`, string(responseData))
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

	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	require.Equal(t, `{"mid":"fn_1"}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	const waitingSchema1 = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val1":{"type":"number"}},"required":["val1"],"type":"object"}}}}`
	const waitingSchema2 = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val2":{"type":"number"}},"required":["val2"],"type":"object"}}}}`

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","waiting":`+waitingSchema1+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val1":10}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","waiting":`+waitingSchema2+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val2":1}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","val":11}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.Equal(t, `{"pid":"pid_1","val":11}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)
}

func TestSpawnAndSupplyGenerator(t *testing.T) {
	script := strings.TrimSpace(`
import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
import zodToJsonSchema from "https://esm.sh/zod-to-json-schema@3.17.0";
import { inputRest } from "pristine://$"

export default function *hello() {
	let sum = 0;
	while (true) {
		yield sum;
		const res = inputRest(zodToJsonSchema(z.object({ val: z.number() }), "$"));
		sum = sum + res.val;
	}
	throw new Error("Should not reach here");
}`)
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	require.Equal(t, `{"mid":"fn_1"}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	const waitingSchema = `{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val":{"type":"number"}},"required":["val"],"type":"object"}}}}`

	responseData, _ = io.ReadAll(w.Body)
	require.JSONEq(t, `{"pid":"pid_1","val":0,"waiting":`+waitingSchema+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":10}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.JSONEq(t, `{"pid":"pid_1","val":10,"waiting":`+waitingSchema+`}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":1}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":11}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":100}`)))
	req.Header.Set("Apeiro-Wait", "true")
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":111}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)

	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
	w = httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ = io.ReadAll(w.Body)
	require.JSONEq(t, `{"pid":"pid_1","waiting":`+waitingSchema+`,"val":111}`, string(responseData))
	require.Equal(t, http.StatusOK, w.Code)
}
