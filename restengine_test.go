package apeiro

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path"
	"testing"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
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

// func TestSpawnAndSupply(t *testing.T) {
// 	script := strings.TrimSpace(`
// import { z } from "https://deno.land/x/zod@v3.17.0/mod.ts";
// import { inputRest } from "pristine://$"
// export default function hello() {
// 	const schema = z.object({ val: z.number() });
// 	const x = inputRest(schema);
// 	const y = inputRest(schema);
// 	return x + y;
// }`)
// 	r, a := SetupApp()
// 	a.Start()
// 	defer a.Stop()

// 	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
// 	w := httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ := io.ReadAll(w.Body)
// 	assert.Equal(t, `{"mid":"fn_1"}`, string(responseData))
// 	assert.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
// 	req.Header.Set("Apeiro-Wait", "true")
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	assert.Equal(t, `{"pid":"pid_1","waiting":{"until_input":{"$ref":"#/definitions/$","$schema":"http://json-schema.org/draft-07/schema#","definitions":{"$":{"additionalProperties":false,"properties":{"val":{"type":"number"}},"required":["val"],"type":"object"}}}}}`, string(responseData))
// 	assert.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":10}`)))
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	assert.Equal(t, `{"pid":"pid_1","waiting":{}}`, string(responseData))
// 	assert.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("POST", "/process/pid_1", bytes.NewBuffer([]byte(`{"val":1}`)))
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	assert.Equal(t, `{"pid":"pid_1","result":11}`, string(responseData))
// 	assert.Equal(t, http.StatusOK, w.Code)

// 	req, _ = http.NewRequest("GET", "/process/pid_1", nil)
// 	w = httptest.NewRecorder()
// 	r.ServeHTTP(w, req)

// 	responseData, _ = io.ReadAll(w.Body)
// 	assert.Equal(t, `{"pid":"pid_1","waiting":{}}`, string(responseData))
// 	assert.Equal(t, http.StatusOK, w.Code)
// }

func BenchmarkSpawnHelloWrold(b *testing.B) {
	script := `export default function hello() { return "Hello, world!" }`
	r, a := SetupApp()
	a.Start()
	defer a.Stop()

	req, _ := http.NewRequest("POST", "/mount", bytes.NewBuffer([]byte(script)))
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)

	responseData, _ := io.ReadAll(w.Body)
	assert.Equal(b, `{"mid":"fn_1"}`, string(responseData))
	assert.Equal(b, http.StatusOK, w.Code)

	for i := 0; i < b.N; i++ {
		req, _ = http.NewRequest("POST", "/spawn", bytes.NewBuffer([]byte(`{"mid":"fn_1"}`)))
		req.Header.Set("Apeiro-Wait", "true")
		w = httptest.NewRecorder()
		r.ServeHTTP(w, req)

		responseData, _ = io.ReadAll(w.Body)
		assert.Contains(b, string(responseData), `,"val":"Hello, world!"}`)
		assert.Equal(b, http.StatusOK, w.Code)
	}
}
