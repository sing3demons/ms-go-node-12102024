package client

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime/multipart"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/sing3demons/go-service/constants"
	"github.com/sing3demons/go-service/logger"
)

type ServiceConfig struct {
	Name       string
	Method     string
	Url        string
	System     string
	Timeout    int
	StatusCode string
}

type BasicAuth struct {
	Username string
	Password string
}

type HttpMap map[string]string

type Option struct {
	Body   HttpMap
	Query  HttpMap
	Param  HttpMap
	Header HttpMap
}

type HttpResponse struct {
	StatusCode int         `json:"status_code"`
	Body       []byte      `json:"body"`
	Header     http.Header `json:"header"`
	Host       string      `json:"host"`
}

type serviceConfig interface {
	Call(ctx context.Context, option Option) (HttpResponse, error)
	PostForm(ctx context.Context, opt OptionPostForm) (result HttpResponse, err error)
}

func NewHttp(config *ServiceConfig) serviceConfig {
	if config.Method != http.MethodGet && config.Method != http.MethodPost && config.Method != http.MethodPut && config.Method != http.MethodPatch && config.Method != http.MethodDelete {
		log.Fatalf("Invalid HTTP method: %s", config.Method)
		return nil
	}

	if config.Timeout == 0 || config.Timeout < 1000 {
		config.Timeout = 1000
	}

	if config.System == "" {
		config.System = os.Getenv("SERVICE_NAME")
	}

	if config.System == "" {
		config.System = "unknown"
	}

	if config.Name == "" {
		config.Name = config.System
	}

	return config
}

func (cfg *ServiceConfig) Call(ctx context.Context, option Option) (HttpResponse, error) {
	startTime := time.Now()
	invokeId := logger.GetInvoke(ctx)
	hostName, _ := os.Hostname()
	summaryLog := logger.Summary{
		Hostname: hostName,
		Appname:  cfg.Name,
		Ssid:     cfg.Url,
		Intime:   startTime.Format(time.RFC3339),
		Invoke:   invokeId,
	}

	client := &http.Client{
		Timeout: time.Duration(cfg.Timeout) * time.Millisecond,
	}

	if len(option.Query) > 0 {
		query := url.Values{}
		for k, v := range option.Query {
			query.Add(k, v)
		}
		cfg.Url = fmt.Sprintf("%s?%s", cfg.Url, query.Encode())
		summaryLog.Input = ParseString(query)
	}

	// Replace URL Parameters
	if len(option.Param) > 0 {
		for k, v := range option.Param {
			cfg.Url = strings.Replace(cfg.Url, k, v, 1)
		}
		summaryLog.Input = ParseString(option.Param)
	}

	// Build Request Body
	var bodyReader io.Reader
	if len(option.Body) > 0 {
		body, err := json.Marshal(option.Body)
		if err != nil {
			return HttpResponse{}, err
		}
		bodyReader = bytes.NewReader(body)
		summaryLog.Input = string(body)
	}

	// Create New HTTP Request
	req, err := http.NewRequestWithContext(ctx, cfg.Method, cfg.Url, bodyReader)
	if err != nil {
		return HttpResponse{}, err
	}

	// Add Headers
	req.Header.Add("x-api-service", cfg.Name)
	setHeaders(req, option.Header)

	// Channel for HTTP response and error
	ch := make(chan *http.Response, 1)
	serviceError := make(chan error, 1)

	// Perform HTTP call asynchronously
	go func() {
		res, err := client.Do(req)
		if err != nil {
			serviceError <- err
			return
		}
		ch <- res
	}()

	// Wait for result or timeout using context
	select {
	case result := <-ch:
		defer result.Body.Close()

		body, err := io.ReadAll(result.Body)
		if err != nil {
			return HttpResponse{}, err
		}
		cfg.StatusCode = ParseString(result.StatusCode)

		response := HttpResponse{
			StatusCode: result.StatusCode,
			Body:       body,
			Header:     result.Header,
			Host:       result.Request.Host,
		}

		summaryLog.Output = cleanedString(body)
		endTime := time.Now()
		summaryLog.Outtime = endTime.Format(time.RFC3339)
		summaryLog.DiffTime = endTime.Sub(startTime).Milliseconds()
		summaryLog.Status = result.StatusCode

		go logger.ToSummaryLog(summaryLog)
		return response, nil
	case err := <-serviceError:
		return HttpResponse{}, err
	case <-ctx.Done():
		return HttpResponse{}, fmt.Errorf("call %s:%s timeout %dms", cfg.System, cfg.Name, cfg.Timeout)
	}
}

func cleanedString(body []byte) string {
	cleanedString := strings.ReplaceAll(string(body), "  ", " ")
	cleanedString = regexp.MustCompile(`([a-zA-Z])([A-Z])`).ReplaceAllString(cleanedString, "$1 $2")
	return strings.ReplaceAll(cleanedString, "  ", " ")
}

func ParseString(data any) string {
	b, _ := json.Marshal(data)
	return string(b)
}

type FormFile struct {
	Name       string
	File       multipart.File
	FileHeader *multipart.FileHeader
}

type FormFields map[string]string

type OptionPostForm struct {
	URL       string
	Timeout   time.Duration
	FormFiles []FormFile
	Fields    FormFields
	Headers   map[string]string
}

func setHeaders(req *http.Request, headers map[string]string, defaultContentType ...string) {
	if len(defaultContentType) > 0 {
		req.Header.Set(constants.ContentType, defaultContentType[0])

	} else {
		req.Header.Set(constants.ContentType, constants.ContentJson)
	}

	for key, value := range headers {
		req.Header.Set(key, value)
	}

}

func (cfg *ServiceConfig) PostForm(ctx context.Context, opt OptionPostForm) (result HttpResponse, err error) {
	startTime := time.Now()
	invokeId := logger.GetInvoke(ctx)
	hostName, _ := os.Hostname()
	summaryLog := logger.Summary{
		Hostname: hostName,
		Appname:  cfg.Name,
		Ssid:     cfg.Url,
		Intime:   startTime.Format(time.RFC3339),
		Invoke:   invokeId,
	}
	payload, writer, err := createMultipartPayload(opt)
	if err != nil {
		log.Println("Error creating payload.", err)
		return HttpResponse{}, err
	}

	req, err := http.NewRequest(http.MethodPost, opt.URL, payload)
	if err != nil {
		log.Println("Error creating request.", err)
		return HttpResponse{}, err
	}

	setHeaders(req, opt.Headers, writer.FormDataContentType())

	if opt.Timeout == 0 {
		opt.Timeout = 60
	}
	client := &http.Client{Timeout: opt.Timeout * time.Second}
	resp, err := client.Do(req)
	if err != nil {
		log.Println("Error sending request.", err)
		return HttpResponse{}, err
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Println("Error reading response.", err)
		return HttpResponse{}, err
	}

	result = HttpResponse{
		StatusCode: resp.StatusCode,
		Body:       respBody,
		Header:     resp.Header,
		Host:       resp.Request.Host,
	}

	cleanedString := strings.ReplaceAll(string(respBody), "  ", " ")
	cleanedString = regexp.MustCompile(`([a-zA-Z])([A-Z])`).ReplaceAllString(cleanedString, "$1 $2")
	cleanedString = strings.ReplaceAll(cleanedString, "  ", " ")
	summaryLog.Output = cleanedString
	endTime := time.Now()
	summaryLog.Outtime = endTime.Format(time.RFC3339)
	duration := endTime.Sub(startTime)
	summaryLog.DiffTime = duration.Milliseconds()
	summaryLog.Status = resp.StatusCode

	go logger.ToSummaryLog(summaryLog)

	return result, nil
}

func createMultipartPayload(opt OptionPostForm) (*bytes.Buffer, *multipart.Writer, error) {
	payload := new(bytes.Buffer)
	writer := multipart.NewWriter(payload)
	for _, formFile := range opt.FormFiles {
		if formFile.Name == "" {
			formFile.Name = "file"
		}
		part, err := writer.CreateFormFile(formFile.Name, formFile.FileHeader.Filename)
		if err != nil {
			log.Println("Error creating form file.", err)
			return nil, nil, err
		}
		_, err = io.Copy(part, formFile.File)
		if err != nil {
			log.Println("Error copying file.", err)
			return nil, nil, err
		}
		defer formFile.File.Close()
	}
	for key, value := range opt.Fields {
		if err := writer.WriteField(key, value); err != nil {
			log.Println("Error writing field.", err)
			return nil, nil, err
		}
	}
	if err := writer.Close(); err != nil {
		log.Println("Error closing writer.", err)
		return nil, nil, err
	}
	return payload, writer, nil
}
