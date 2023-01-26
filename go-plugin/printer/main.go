package main

import (
	"fmt"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"github.com/hashicorp/go-hclog"
	"github.com/hashicorp/go-plugin"
	"github.com/hashicorp/yamux"
)

// Here is a real implementation of Greeter
type GreeterHello struct {
	logger hclog.Logger
}

func (g *GreeterHello) Greet() string {
	g.logger.Debug("message from GreeterHello.Greet")
	return "Hello!"
}

// handshakeConfigs are used to just do a basic handshake between
// a plugin and host. If the handshake fails, a user friendly error is shown.
// This prevents users from executing bad plugins or executing a plugin
// directory. It is a UX feature, not a security feature.
var handshakeConfig = plugin.HandshakeConfig{
	ProtocolVersion:  1,
	MagicCookieKey:   "BASIC_PLUGIN",
	MagicCookieValue: "hello",
}

func main() {

	logger := hclog.New(&hclog.LoggerOptions{
		Level:      hclog.Trace,
		Output:     os.Stderr,
		JSONFormat: true,
	})

	// Create a Unix domain socket and listen for incoming connections.
	socket, err := net.Listen("unix", "/tmp/echo.sock")
	if err != nil {
		log.Fatal(err)
	}

	// Cleanup the sockfile.
	c := make(chan os.Signal, 1)
	signal.Notify(c, os.Interrupt, syscall.SIGTERM)
	// go func() {
	// }()

	go func() {
		for {
			// Accept an incoming connection.
			conn, err := socket.Accept()
			if err != nil {
				log.Fatal(err)
			}

			logger.Debug("accepted socket")
			// Handle the connection in a separate goroutine.
			go func(conn net.Conn) {
				logger.Debug("handle connection")
				defer conn.Close()

				// Setup server side of yamux
				session, err := yamux.Server(conn, nil)
				if err != nil {
					panic(err)
				}

				// Accept a stream
				stream, err := session.Accept()
				logger.Debug("session accept")
				if err != nil {
					panic(err)
				}

				// Listen for a message
				buf := make([]byte, 4096)
				n, err := stream.Read(buf)
				if err != nil {
					log.Fatal(err)
				}

				logger.Debug(fmt.Sprintf("%v", buf[:n]))
				logger.Debug(string(buf[:n]))

				stream.Write([]byte("hello world"))

				// Echo the data back to the connection.
				// _, err = conn.Write(buf[:n])
				// if err != nil {
				// 	log.Fatal(err)
				// }
			}(conn)
		}
	}()

	// greeter := &GreeterHello{
	// 	logger: logger,
	// }
	// // pluginMap is the map of plugins we can dispense.
	// var pluginMap = map[string]plugin.Plugin{
	// 	"greeter": &shared.GreeterPlugin{Impl: greeter},
	// }

	logger.Debug("message from plugin", "foo", "bar")

	fmt.Println("1|1|unix|/tmp/echo.sock|netrpc|")

	<-c
	os.Remove("/tmp/echo.sock")
	os.Exit(1)

	// plugin.Serve(&plugin.ServeConfig{
	// 	HandshakeConfig: handshakeConfig,
	// 	Plugins:         pluginMap,
	// })
}
