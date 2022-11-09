package aia

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

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

type OAIEditRequest struct {
	Model       string `json:"model"`
	Input       string `json:"input"`
	Instruction string `json:"instruction"`
	N           int    `json:"n"`
	Temperature int    `json:"temperature"`
}

type OAIEditResponse struct {
	Object  string      `json:"object"`
	Created int         `json:"created"`
	Choices []OAIChoice `json:"choices"`
}

func CodeEdit(ctx context.Context, existing_code string, prompt string) (string, error) {
	body, err := json.Marshal(&OAIEditRequest{
		Model:       "code-davinci-edit-001",
		Input:       existing_code,
		Instruction: prompt,
		N:           2,
		Temperature: 0,
	})
	if err != nil {
		return "", err
	}

	fmt.Printf("%s\n", string(body))

	bodyReader := bytes.NewBuffer(body)
	req, err := http.NewRequest("POST", "https://api.openai.com/v1/edits", bodyReader)
	if err != nil {
		return "", err
	}

	req.Header.Add("Content-Type", "application/json")
	req.Header.Add("Authorization", "Bearer "+OAI_KEY)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}

	respBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}

	fmt.Printf("%s\n", string(respBytes))

	var response OAIEditResponse
	err = json.Unmarshal(respBytes, &response)
	if err != nil {
		return "", err
	}

	return response.Choices[0].Text, nil
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

/*
more content
// a function that calls an API that needs an access key and emails me
import { sendEmail } from "apeiro://$/emailbox";
import { secret } from "apeiro://$";

	export default function random_api_example() {
		let api_response = fetchjson("https://api.example.com/v1/api_call?token=" + secret("EXAMPLE_COM_TOKEN"));
		sendEmail("you@example.com", "API Response", JSON.stringify(api_response));
	}
*/

func CodeCompletionWithKnowledge(ctx context.Context, prompt string) (chan string, error) {
	return CodeCompletion(ctx, `// a function that asks for a number and displays it
import { io } from "pristine://$";

export default function sum_of_two_numbers() {
		const n = io.input({
			number1: io.number(),
			number2: io.number(),
		});

		return n.number1 + n.number2;
}

// a function that responds with a random quote everytime I message it
import { recvMessage, respondToMessage } from "pristine://$/slack";

export default function main() {
	while (true) {
		const msg = recvMessage();
		const quoteResponse = fetchjson("https://zenquotes.io/api/random");
		const quote = quoteResponse[0].q;
		const author = quoteResponse[0].a;
		respondToMessage(msg, "You say " + msg.text + ", but " + author + " said " + quote);
	}
	return "Hello, world!";
}

// a function that emails me a random quote every morning
import { sendEmail } from "pristine://$/emailbox";
import { nextMorning, waitUntil } from "pristine://$/time";

export default function send_me_good_morning_every_morning() {
	let me = "you@example.com";
	while (true) {
		sendEmail(me, "Good Morning", "Just wanted to say good morning!);
		waitUntil(time.NextMorning());
	}
}

// To query Yahoo Finance for SYMB you must call https://query1.finance.yahoo.com/v7/finance/quote?symbols=SYMB
// let price = response.quoteResponse.result[0].regularMarketPrice

// a function that responds with a random quote when it gets an email
import { recvEmail, sendEmail } from "pristine://$/emailbox"

export default function respond_to_email_with_quote() {
	while (true) {
		let new_email = recvEmail();

		let subject = new_email.commonHeaders.subject;
		let sender = new_email.commonHeaders.from[0];

		let quote = fetchjson("https://api.random_quote_api.com");
		
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
