package restengine

import "net/http"

type CustomResponse struct {
	Data string
}

func (c CustomResponse) Render(w http.ResponseWriter) error {
	_, err := w.Write([]byte(c.Data))
	return err
}

func writeContentType(w http.ResponseWriter, value []string) {
	header := w.Header()
	if val := header["Content-Type"]; len(val) == 0 {
		header["Content-Type"] = value
	}
}

func (CustomResponse) WriteContentType(w http.ResponseWriter) {
	writeContentType(w, []string{"application/json; charset=utf-8"})
}
