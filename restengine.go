package apeiro

import (
	"io"
	"net/http"
	"time"

	ginzerolog "github.com/dn365/gin-zerolog"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type SpawnRequest struct {
	Mid string `json:"mid" xml:"mid"  binding:"required"`
}

type MountNewReq struct {
	Src  string `json:"src" xml:"src"  binding:"required"`
	Name string `json:"name" xml:"name"  binding:"required"`
}

type MountNewResp struct {
	Mid   string `json:"mid" xml:"mid"`
	Error string `json:"error" xml:"error"`
}

func (api *ApeiroRestAPI) mountNewHandler(c *gin.Context) {
	var req MountNewReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mid, err := api.a.Mount([]byte(req.Src), req.Name)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mid": mid,
	})
}

func (api *ApeiroRestAPI) mountListHandler(c *gin.Context) {
	mounts, err := api.a.Mounts()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"mounts": mounts,
	})
}

func (api *ApeiroRestAPI) mountGetHandler(c *gin.Context) {
	mid := c.Param("mid")
	val, err := api.a.GetMountOverview(mid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, val)
}

func (api *ApeiroRestAPI) procNewHandler(c *gin.Context) {
	var req SpawnRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if c.Request.Header.Get("Apeiro-Wait") == "true" {
		pid, watcher, err := api.a.SpawnAndWatch(req.Mid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		msg := <-watcher
		log.Info().Str("pid", pid).Msgf("process response %v", msg)
		close(watcher)

		val, err := api.a.GetProcessValue(pid)
		if err != nil {
			c.JSON(http.StatusInternalServerError, gin.H{
				"error": err.Error(),
			})
		}

		c.JSON(http.StatusOK, val)
	} else {
		pid, err := api.a.Spawn(req.Mid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"pid": pid,
		})
	}
}

func (api *ApeiroRestAPI) procGetHandler(c *gin.Context) {
	pid := c.Param("pid")
	val, err := api.a.GetProcessValue(pid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, val)
}

func (api *ApeiroRestAPI) procListHandler(c *gin.Context) {
	processes, err := api.a.Processes()
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"processes": processes,
	})
}

func (api *ApeiroRestAPI) procSendHandler(c *gin.Context) {
	pid := c.Param("pid")

	supplyMsg, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	watcher, err := api.a.SupplyAndWatch(pid, string(supplyMsg))
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	resultMsg := <-watcher
	log.Info().Str("pid", pid).Msgf("process response %v", resultMsg)
	close(watcher)

	val, err := api.a.GetProcessValue(pid)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": err.Error(),
		})
	}

	c.JSON(http.StatusOK, val)
}

type ApeiroRestAPI struct {
	a *ApeiroRuntime
	r *gin.Engine
}

func (api *ApeiroRestAPI) procWatchHandler(c *gin.Context) {
	pid := c.Param("pid")
	events, err := api.a.Watch(pid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
	}
	c.Stream(func(w io.Writer) bool {
		if _, ok := <-events; ok {
			val, _ := api.a.GetProcessValue(pid)
			c.SSEvent("message", val)
			return true
		}
		return false
	})

	val, err := api.a.GetProcessValue(pid)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, val)
}

func (api *ApeiroRestAPI) Run() error {
	return api.r.Run()
}

func NewApeiroRestAPI(a *ApeiroRuntime) *ApeiroRestAPI {
	r := gin.New()

	api := &ApeiroRestAPI{
		a: nil,
		r: nil,
	}

	r.Use(ginzerolog.Logger("gin"), gin.Recovery())

	r.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000"},
		AllowMethods:     []string{"GET", "POST", "PUT", "PATCH"},
		AllowHeaders:     []string{"Origin", "Apeiro-Wait", "Content-Type"},
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

	r.GET("/", func(c *gin.Context) {
		c.JSON(http.StatusOK, a.GetOverview())
	})

	r.POST("/src", api.mountNewHandler)
	r.GET("/src", api.mountListHandler)
	r.GET("/src/:mid", api.mountGetHandler)

	r.POST("/proc", api.procNewHandler)
	r.GET("/proc", api.procListHandler)
	r.GET("/proc/:pid", api.procGetHandler)
	r.POST("/proc/:pid", api.procSendHandler)
	r.GET("/process/:pid/watch", SSEHeadersMiddleware(), api.procWatchHandler)

	api.a = a
	api.r = r

	return api
}

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

func SSEHeadersMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Writer.Header().Set("Content-Type", "text/event-stream")
		c.Writer.Header().Set("Cache-Control", "no-cache")
		c.Writer.Header().Set("Connection", "keep-alive")
		c.Writer.Header().Set("Transfer-Encoding", "chunked")
		c.Next()
	}
}
