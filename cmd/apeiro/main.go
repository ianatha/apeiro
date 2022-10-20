package main

import (
	"github.com/apeiromont/apeiro"
)

func main() {
	a, err := apeiro.NewApeiroRuntime("world.db")
	if err != nil {
		panic(err)
	}

	r := apeiro.RESTRouter(a)
	a.Start()

	r.Run()
}
