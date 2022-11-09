package restengine

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/slack-go/slack"
	stripeWebhook "github.com/stripe/stripe-go/webhook"
)

var slackApi = slack.New("***REMOVED***")

const STRIPE_ENDPOINT_SECRET = "***REMOVED***"

func (a *ApeiroRestAPI) externalStripe(c *gin.Context) {
	body, err := io.ReadAll(c.Request.Body)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "could not read body",
		})
		return
	}

	sigHeaders, ok := c.Request.Header["Stripe-Signature"]
	if !ok {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "missing stripe signature",
		})
		return
	}
	event, err := stripeWebhook.ConstructEvent(body, sigHeaders[0], STRIPE_ENDPOINT_SECRET)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error": "incorrect stripe signature",
		})
		return
	}

	matchingPids, err := a.a.FilterProcsAwaiting("stripe")
	if err != nil {
		fmt.Printf("error: %v\n", err)
		c.JSON(http.StatusInternalServerError, gin.H{
			"error": "pid matcher failed",
		})
		return
	}

	eventJson := jsonStringify(event)
	for _, pid := range matchingPids {
		a.a.Supply(pid, eventJson)
	}

	c.Status(http.StatusOK)
}

func (a *ApeiroRestAPI) externalSlack(c *gin.Context) {
	var evt map[string]interface{}
	if err := c.ShouldBindJSON(&evt); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if evt["type"] == "url_verification" {
		c.String(http.StatusOK, evt["challenge"].(string))
		return
	}

	if evt["type"] == "event_callback" {
		event := evt["event"].(map[string]interface{})
		if eventType, ok := event["type"]; !ok || eventType != "message" {
			fmt.Printf("unhandled event: %v\n", evt)
			return
		}
		if _, ok := event["subtype"]; ok {
			fmt.Printf("unhandled event: %v\n", evt)
			return
		}

		if _, ok := event["app_id"]; ok {
			// ignore message from a bot (myself or other)
			return
		}

		fmt.Printf("event = %v\n", event)
		channel := event["channel"].(string)
		text := event["text"].(string)
		thread_ts := event["ts"].(string)

		fmt.Printf("%v\n", event["text"])
		fmt.Printf("%v\n", event["ts"])
		fmt.Printf("%v\n", event["type"])
		fmt.Printf("%v\n", event["channel"])

		parts := strings.Split(text, ":")
		if len(parts) >= 2 && strings.HasPrefix(parts[0], "pid_") {
			pid := strings.TrimPrefix(parts[0], "pid_")
			remainderText := strings.Join(parts[1:], "")

			a.a.Supply(pid, jsonStringify(map[string]string{
				"channel":   channel,
				"text":      remainderText,
				"thread_ts": thread_ts,
			}))
		}

		// slackApi.PostMessage(channel, slack.MsgOptionText("read you loud and clear", false), slack.MsgOptionTS(thread_ts))

		// a.a.Supply(pid, string(json))
		return
	}

	c.String(http.StatusOK, "")
	return
}

func jsonStringify(v interface{}) string {
	bytes, _ := json.Marshal(v)
	return string(bytes)
}

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
