package ecmatime

import (
	"fmt"

	"github.com/rs/zerolog/log"
)

type WriterToZerolog struct {
	pid string
}

func (w WriterToZerolog) Write(p []byte) (n int, err error) {
	fmt.Printf("%s\n", string(p))
	log.Info().Str("origin", "console.log").Str("pid", w.pid).Msg(string(p))
	return len(p), nil
}
