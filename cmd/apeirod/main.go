package main

import (
	"github.com/apeiromont/apeiro/restengine"
	"github.com/apeiromont/apeiro/runtime"
	"github.com/rs/zerolog"
)

func main() {
	zerolog.SetGlobalLevel(zerolog.TraceLevel)

	a, err := runtime.NewApeiroRuntime("world.db")
	if err != nil {
		panic(err)
	}

	r := restengine.NewApeiroRestAPI(a, true)
	a.Start()

	r.Run()
}
