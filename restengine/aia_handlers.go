package restengine

import (
	"context"
	"io"
	"net/http"
	"strings"

	"github.com/apeiromont/apeiro/aia"
	"github.com/gin-gonic/gin"
)

func (api *ApeiroRestAPI) codeGeneration(c *gin.Context) {
	prompt := c.Query("prompt")
	if prompt == "" {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing prompt",
		})
		return
	}

	events, err := aia.CodeCompletionWithKnowledge(c.Request.Context(), prompt)

	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
		return
	}
	c.Stream(func(w io.Writer) bool {
		if newWord, ok := <-events; ok {
			c.SSEvent("message", gin.H{
				"w": newWord,
			})
			return true
		}
		return false
	})

	c.JSON(http.StatusOK, gin.H{
		"ok": true,
	})
	return
}

type CodeEditRequest struct {
	Mid         string `json:"mid" xml:"mid"  binding:"required"`
	AccessError string `json:"last_fetch_resp_json"`
}

func (api *ApeiroRestAPI) codeGenerationFix(c *gin.Context) {
	var req CodeEditRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mount, err := api.a.GetMountOverview(req.Mid)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{
			"error": "mount not found",
		})
		return
	}

	edit, err := aia.CodeEdit(context.Background(), mount.Src, `Knowing that secret is imported from "apeiro://$", fix the following error using secret() to access any secrets, such as API keys or API tokens. `+req.AccessError)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": err.Error(),
		})
	}

	if strings.Index(edit, "secret(\"") > 0 {
		lines := strings.Split(edit, "\n")
		lines = append(lines[:2+1], lines[2:]...)
		lines[2] = "import { secret } from \"apeiro://$\";"
		edit = strings.Join(lines, "\n")
	}

	c.JSON(http.StatusOK, gin.H{
		"edit": edit,
	})
	return
}
