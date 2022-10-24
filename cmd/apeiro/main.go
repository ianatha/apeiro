package main

import (
	"github.com/apeiromont/apeiro"
	"github.com/rs/zerolog"
)

func main() {
	zerolog.SetGlobalLevel(zerolog.TraceLevel)

	a, err := apeiro.NewApeiroRuntime("world.db")
	if err != nil {
		panic(err)
	}

	r := apeiro.RESTRouter(a)
	a.Start()

	r.Run()
}
