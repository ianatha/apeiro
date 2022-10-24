package ecmatime

import "github.com/rs/zerolog/log"

type WriterToZerolog struct {
	pid string
}

func (w WriterToZerolog) Write(p []byte) (n int, err error) {
	log.Info().Str("origin", "console.log").Str("pid", w.pid).Msg(string(p))
	return len(p), nil
}
