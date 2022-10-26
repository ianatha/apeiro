package restengine

import (
	"encoding/json"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
)

func (a *ApeiroRestAPI) externalAWSSESHandler(c *gin.Context) {
	var evt map[string]interface{}
	if err := c.ShouldBindJSON(&evt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if evt["Type"] == "SubscriptionConfirmation" {
		subscribeUrl := evt["SubscribeURL"].(string)
		_, err := http.Get(subscribeUrl)
		if err != nil {
			c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
			return
		}
		c.JSON(http.StatusOK, gin.H{"status": "subscribed"})
		return
	}

	if mail, ok := evt["mail"].(map[string]interface{}); ok {
		if destination, ok := mail["destination"].([]interface{}); ok {
			if len(destination) != 1 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid destination"})
				return
			}

			address := destination[0].(string)
			parts := strings.Split(address, "@")
			if len(parts) != 2 {
				c.JSON(http.StatusBadRequest, gin.H{"error": "invalid destination"})
				return
			}

			pid := parts[0]
			json, err := json.Marshal(evt)
			if err != nil {
				c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
				return
			}

			a.a.Supply(pid, string(json))
			c.JSON(http.StatusOK, gin.H{"status": "ok"})
			return
		} else {
			c.JSON(http.StatusBadRequest, gin.H{"error": "invalid destination"})
			return
		}
	} else {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid destination"})
		return
	}
}
