package restengine

import (
	"net/http"
	"time"

	"github.com/apeiromont/apeiro/runtime"
	ginzerolog "github.com/dn365/gin-zerolog"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

type ApeiroRestAPI struct {
	a *runtime.ApeiroRuntime
	r *gin.Engine
}

func NewApeiroRestAPI(a *runtime.ApeiroRuntime) *ApeiroRestAPI {
	r := gin.New()

	api := &ApeiroRestAPI{
		a: nil,
		r: nil,
	}

	r.Use(ginzerolog.Logger("gin"), gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Apeiro-Wait", "Content-Type", "Accept"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		MaxAge: 12 * time.Hour,
	}))

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	r.GET("/_dashboard", func(c *gin.Context) {
		c.JSON(http.StatusOK, a.GetOverview())
	})

	r.GET("/aia", SSEHeadersMiddleware(), api.codeGeneration)

	r.POST("/src", api.mountNewHandler)
	r.GET("/src", api.mountListHandler)
	r.GET("/src/:mid", api.mountGetHandler)
	r.PUT("/src/:mid", api.mountUpdateHandler)

	r.POST("/proc", api.procNewHandler)
	r.GET("/proc", api.procListHandler)
	r.GET("/proc/:pid", api.procGetHandler)
	r.POST("/proc/:pid", api.procSendHandler)
	r.GET("/proc/:pid/watch", SSEHeadersMiddleware(), api.procWatchHandler)

	r.POST("/ext/aws/ses", api.externalAWSSESHandler)

	api.a = a
	api.r = r

	return api
}

func (api *ApeiroRestAPI) Run() error {
	return api.r.Run()
}
