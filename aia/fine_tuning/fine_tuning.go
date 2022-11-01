package main

import (
	"bytes"
	"embed"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"log"
	"mime/multipart"
	"net/http"
	"strings"
)

type FineTuningEntry struct {
	Prompt string `json:"prompt"`
	Code   string `json:"completion"`
}

//go:embed *.ts
var content embed.FS

func FineTuningEntryFromFile(src string) *FineTuningEntry {
	lines := strings.Split(src, "\n")
	firstLine := lines[0]
	val := strings.Split(firstLine, "// Prompt: ")

	return &FineTuningEntry{
		Prompt: val[1],
		Code:   strings.Join(lines[1:], "\n"),
	}
}

func Entries() []FineTuningEntry {
	var result []FineTuningEntry

	files, err := content.ReadDir(".")
	if err != nil {
		log.Fatal(err)
	}

	for _, file := range files {
		fileContent, err := content.ReadFile(file.Name())
		if err != nil {
			panic(err)
		}

		result = append(result, *FineTuningEntryFromFile(string(fileContent)))
	}

	return result
}

const OAI_KEY = "***REMOVED***"

type OAIFile struct {
	Id      string `json:"id"`
	Purpose string `json:"purpose"`
}

type OAIFineTuneCreate struct {
	TrainingFileId string `json:"training_file"`
	Model          string `json:"model"`
}

func main() {
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	part, _ := writer.CreateFormFile("file", "file.jsonl")

	for _, entry := range Entries() {
		entryJsonLine, err := json.Marshal(entry)
		if err != nil {
			panic(err)
		}
		part.Write(entryJsonLine)
		part.Write([]byte("\n"))
	}

	purpose, _ := writer.CreateFormField("purpose")
	purpose.Write([]byte("fine-tune"))
	writer.Close()

	req, err := http.NewRequest("POST", "https://api.openai.com/v1/files", body)
	if err != nil {
		panic(err)
	}
	req.Header.Add("Authorization", "Bearer "+OAI_KEY)
	req.Header.Add("Content-Type", writer.FormDataContentType())

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		panic(err)
	}

	srcb, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		panic(err)
	}

	var respobj OAIFile
	err = json.Unmarshal(srcb, &respobj)
	if err != nil {
		panic(err)
	}

	fmt.Printf("%s\n", respobj.Id)

	createObj := OAIFineTuneCreate{
		TrainingFileId: respobj.Id,
		Model:          "davinci",
	}
	createObjBytes, err := json.Marshal(createObj)
	if err != nil {
		panic(err)
	}
	createObjBytesReader := bytes.NewBuffer(createObjBytes)
	createReq, err := http.NewRequest("POST", "https://api.openai.com/v1/fine-tunes", createObjBytesReader)
	if err != nil {
		panic(err)
	}
	createReq.Header.Add("Authorization", "Bearer "+OAI_KEY)
	createReq.Header.Add("Content-Type", "application/json")
	createResp, err := http.DefaultClient.Do(createReq)
	if err != nil {
		panic(err)
	}

	createRespBody, err := ioutil.ReadAll(createResp.Body)
	if err != nil {
		panic(err)
	}
	fmt.Printf("%v\n", string(createRespBody))
}
