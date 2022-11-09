package restengine

import (
	"fmt"
	"net/http"
	"time"

	"github.com/apeiromont/apeiro/runtime"
	ginzerolog "github.com/dn365/gin-zerolog"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	adapter "github.com/gwatts/gin-adapter"
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
		AllowOrigins:     []string{"*"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Apeiro-Wait", "Content-Type", "Accept", "Authorization"},
		ExposeHeaders:    []string{"Content-Length"},
		AllowCredentials: true,
		AllowOriginFunc: func(origin string) bool {
			return true
		},
		MaxAge: 12 * time.Hour,
	}))

	// jwtRequired := adapter.Wrap(EnsureValidToken())
	jwtRequired := adapter.Wrap(func(h http.Handler) http.Handler {
		return h
	})

	r.GET("/ping", jwtRequired, func(c *gin.Context) {
		token, err := GetValidatedToken(c)
		if err != nil {
			panic(err)
		}
		fmt.Printf("debug: %+v\n", token.CustomClaims)
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	r.GET("/_dashboard", jwtRequired, func(c *gin.Context) {
		c.JSON(http.StatusOK, a.GetOverview())
	})

	r.GET("/aia", SSEHeadersMiddleware(), api.codeGeneration)
	r.POST("/aia/fix", jwtRequired, api.codeGenerationFix)
	r.POST("/aia/fix_bug", jwtRequired, api.codeGenerationFixBug)

	r.POST("/src", jwtRequired, api.mountNewHandler)
	r.GET("/src", jwtRequired, api.mountListHandler)
	r.GET("/src/:mid", jwtRequired, api.mountGetHandler)
	r.PUT("/src/:mid", jwtRequired, api.mountUpdateHandler)

	r.POST("/proc", jwtRequired, api.procNewHandler)
	r.GET("/proc", jwtRequired, api.procListHandler)
	r.GET("/proc/:pid", jwtRequired, api.procGetHandler)
	r.POST("/proc/:pid", jwtRequired, api.procSendHandler)
	r.GET("/proc/:pid/watch", SSEHeadersMiddleware(), api.procWatchHandler)

	r.POST("/ext/slack", api.externalSlack)
	r.POST("/ext/stripe", api.externalStripe)
	r.POST("/ext/aws/ses", api.externalAWSSESHandler)

	api.a = a
	api.r = r

	return api
}

func (api *ApeiroRestAPI) Run() error {
	return api.r.Run()
}
