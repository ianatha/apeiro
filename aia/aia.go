package aia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"

	"github.com/r3labs/sse/v2"
	sitter "github.com/smacker/go-tree-sitter"
	"github.com/smacker/go-tree-sitter/javascript"
)

const OAI_KEY = "***REMOVED***"

type OAICompletionRequest struct {
	Model       string `json:"model"`
	Prompt      string `json:"prompt"`
	N           int    `json:"n"`
	MaxToken    int    `json:"max_tokens"`
	Stream      bool   `json:"stream"`
	Temperature int    `json:"temperature"`
}

type OAIChoice struct {
	Text         string      `json:"text"`
	Index        int         `json:"index"`
	LogProbs     interface{} `json:"logprobs"`
	FinishReason string      `json:"finish_reason"`
}

type OAICompletionResponse struct {
	ID      string      `json:"id"`
	Object  string      `json:"object"`
	Created int         `json:"created"`
	Choices []OAIChoice `json:"choices"`
	Model   string      `json:"model"`
}

func TreeContainsFunction(node *sitter.Node) bool {
	if node.Type() == "function" {
		return true
	} else {
		count := node.ChildCount()
		for i := uint32(0); i < count; i++ {
			if TreeContainsFunction(node.Child(int(i))) {
				return true
			}
		}
	}
	return false
}

func CodeCompletion(ctx context.Context, prompt string) (chan string, error) {
	jsonbytes, err := json.Marshal(&OAICompletionRequest{
		Model:       "code-davinci-002",
		Prompt:      prompt,
		N:           1,
		MaxToken:    512,
		Stream:      true,
		Temperature: 0,
	})
	if err != nil {
		return nil, err
	}

	b := bytes.NewBuffer(jsonbytes)
	// new SSE client with Content-Type header
	client := sse.NewClient("https://api.openai.com/v1/completions", func(c *sse.Client) {
		c.Headers["Content-Type"] = "application/json"
		c.Headers["Authorization"] = "Bearer " + OAI_KEY
		c.Method = "POST"
		c.Body = b
	})

	client.ReconnectStrategy = nil

	parser := sitter.NewParser()
	parser.SetLanguage(javascript.GetLanguage())
	src := bytes.NewBufferString("import ")

	ctx, cancelCtx := context.WithCancel(context.Background())
	receiveEvents := make(chan *sse.Event)
	result := make(chan string)
	client.SubscribeChanRawWithContext(ctx, receiveEvents)

	go func() {
		for {
			msg := <-receiveEvents
			r := &OAICompletionResponse{}
			err := json.Unmarshal(msg.Data, r)
			if err != nil {
				panic(err)

			}
			newWord := r.Choices[0].Text
			src.Write([]byte(newWord))
			tree := parser.Parse(nil, src.Bytes())

			result <- newWord

			if !tree.RootNode().HasError() && TreeContainsFunction(tree.RootNode()) {
				cancelCtx()
				fmt.Println(src.String())
				close(result)
				return
			}
		}
	}()

	return result, nil
}

func CodeCompletionWithKnowledge(ctx context.Context, prompt string) (chan string, error) {
	return CodeCompletion(ctx, `// a function that asks for a number and displays it
import { io } from "apeiro://$";

export default function number_input_example() {
		const n = io.input({
			val: io.number(),
		});

		io.display("The number you inputed is " + n.val);
		return n.val;
}

// a function that emails me a random quote every morning
import { sendEmail } from "apeiro://$/emailbox"

export default function daily_good_morning_with_quote() {
	let me = "you@example.com";
	while (true) {
		let quote = fetchjson("https://api.quotable.io/random");
		sendEmail(me, "Good Morning", quote.content);
		time.waitUntil(time.NextMorning());
	}
}

// a function that responds with a random quote when it gets an email
import { recvEmail, sendEmail } from "apeiro://$/emailbox"

export default function respond_to_email_with_quote() {
	while (true) {
		let new_email = recvEmail();

		let subject = new_email.commonHeaders.subject;
		let sender = new_email.commonHeaders.from[0];

		let quote = fetchjson("https://api.quotable.io/random");
		
		sendEmail(
			sender,
			`+"`"+`Re: ${subject}`+"`"+`,
			quote.content
		);
	}
}

// a javascript function that `+prompt+`
import `)
}

// when you get an email, get the price of the cryptocurrency
// in the subject from coindesk, and respond with the price of the cryptocurrency in USD
