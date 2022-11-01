package restengine

import (
	"io"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/rs/zerolog/log"
)

type SpawnRequest struct {
	Mid     string `json:"mid" xml:"mid"  binding:"required"`
	FromAIA bool   `json:"fromAIA"`
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

		if msg.Err != nil {
			if req.FromAIA {
				// TODO
				log.Info().Str("pid", pid).Msg("attempting to fix")
				c.JSON(http.StatusOK, gin.H{
					"status":               "attempting_to_fix",
					"mid":                  req.Mid,
					"last_fetch_req":       msg.Err.LastFetchReq,
					"last_fetch_resp_json": msg.Err.LastFetchRespJson,
				})
				return
			} else {
				c.JSON(http.StatusOK, gin.H{
					"status": "error",
				})
				return
			}
		} else {
			val, err := api.a.GetProcessValue(pid)
			if err != nil {
				c.JSON(http.StatusInternalServerError, gin.H{
					"error": err.Error(),
				})
			}

			c.JSON(http.StatusOK, val)
			return
		}
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

func (api *ApeiroRestAPI) procWatchHandler(c *gin.Context) {
	pid := c.Param("pid")
	events, err := api.a.Watch(c.Request.Context(), pid)
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
