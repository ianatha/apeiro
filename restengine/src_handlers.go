package restengine

import (
	"net/http"

	"github.com/gin-gonic/gin"
)

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

type MountUpdateReq struct {
	Src  *string `json:"src" xml:"src"`
	Name *string `json:"name" xml:"name"`
}

func (api *ApeiroRestAPI) mountUpdateHandler(c *gin.Context) {
	var req MountUpdateReq
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	mid, err := api.a.MountUpdate(c.Param("mid"), req.Src, req.Name)
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
