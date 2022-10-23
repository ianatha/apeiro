package apeiro

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
)

type SpawnRequest struct {
	Mid  string `json:"mid" xml:"mid"  binding:"required"`
	Wait bool   `json:"wait"`
}

func RESTRouter(a *ApeiroRuntime) *gin.Engine {
	r := gin.Default()

	r.GET("/ping", func(c *gin.Context) {
		c.JSON(http.StatusOK, gin.H{
			"message": "pong",
		})
	})

	r.POST("/mount", func(c *gin.Context) {
		src, err := io.ReadAll(c.Request.Body)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		mid, err := a.Mount(src)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.JSON(http.StatusOK, gin.H{
			"mid": mid,
		})
	})

	r.POST("/spawn", func(c *gin.Context) {
		var req SpawnRequest
		if err := c.ShouldBindJSON(&req); err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}

		if req.Wait {
			pid, watcher, err := a.SpawnAndWatch(req.Mid)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{
					"error": err.Error(),
				})
				return
			}

			<-watcher

			val, err := a.GetProcessValue(pid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": err.Error(),
				})
			}

			c.JSON(http.StatusOK, gin.H{
				"pid": pid,
				"val": val,
			})
		} else {
			pid, err := a.Spawn(req.Mid)
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
	})

	r.GET("/process/:pid", func(c *gin.Context) {
		pid := c.Param("pid")
		val, err := a.GetProcessValue(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Render(http.StatusOK, CustomResponse{val})
		// c.JSON(http.StatusOK, val)
	})

	r.GET("/process/:pid/watch", SSEHeadersMiddleware(), func(c *gin.Context) {
		pid := c.Param("pid")
		events, err := a.Watch(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
		}
		c.Stream(func(w io.Writer) bool {
			if _, ok := <-events; ok {
				val, _ := a.GetProcessValue(pid)
				c.SSEvent("message", val)
				return true
			}
			return false
		})

		val, err := a.GetProcessValue(pid)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{
				"error": err.Error(),
			})
			return
		}

		c.Render(http.StatusOK, CustomResponse{val})
		// c.JSON(http.StatusOK, val)
	})

	return r
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
