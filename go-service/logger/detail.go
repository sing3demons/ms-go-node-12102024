package logger

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"runtime"
	"time"

	"github.com/sing3demons/go-service/constants"
)

type DetailLog interface {
	IsRawDataEnabled() bool
	AddInputRequest(node, cmd, invoke string, rawData, data interface{})
	AddOutputRequest(node, cmd, invoke string, rawData, data interface{})
	End()
	AddInputResponse(node, cmd, invoke string, rawData, data interface{}, protocol, protocolMethod string)
	AddOutputResponse(node, cmd, invoke string, rawData, data interface{})
}

type InputOutputLog struct {
	Invoke   string      `json:"Invoke"`
	Event    string      `json:"Event"`
	Protocol *string     `json:"Protocol,omitempty"`
	Type     string      `json:"Type"`
	RawData  interface{} `json:"RawData,omitempty"`
	Data     interface{} `json:"Data"`
	ResTime  *string     `json:"ResTime,omitempty"`
}

type DetailLogConfig struct {
	Detail struct {
		RawData    bool `json:"rawData"`
		LogFile    bool `json:"logFile"`
		LogConsole bool `json:"logConsole"`
	} `json:"detail"`
	ProjectName string `json:"projectName"`
}

type detailLog struct {
	LogType         string               `json:"LogType"`
	Host            string               `json:"Host"`
	AppName         string               `json:"AppName"`
	Instance        *string              `json:"Instance,omitempty"`
	Session         string               `json:"Session"`
	InitInvoke      string               `json:"InitInvoke"`
	Scenario        string               `json:"Scenario"`
	Identity        string               `json:"Identity"`
	InputTimeStamp  *string              `json:"InputTimeStamp,omitempty"`
	Input           []InputOutputLog     `json:"Input"`
	OutputTimeStamp *string              `json:"OutputTimeStamp,omitempty"`
	Output          []InputOutputLog     `json:"Output"`
	ProcessingTime  *string              `json:"ProcessingTime,omitempty"`
	conf            DetailLogConfig      `json:"-"`
	startTimeDate   time.Time            `json:"-"`
	inputTime       *time.Time           `json:"-"`
	outputTime      *time.Time           `json:"-"`
	timeCounter     map[string]time.Time `json:"-"`
	req             *http.Request
}

type logEvent struct {
	node           string
	cmd            string
	invoke         string
	logType        string
	rawData        interface{}
	data           interface{}
	resTime        string
	protocol       string
	protocolMethod string
}

var _log = NewLogFile()

func NewDetailLog(req *http.Request, initInvoke, scenario, identity string) DetailLog {
	conf := DetailLogConfig{}
	conf.Detail.RawData = true
	conf.Detail.LogFile = true
	conf.Detail.LogConsole = true
	conf.ProjectName = os.Getenv("APP_NAME")

	session := req.Context().Value(constants.Session)

	host, _ := os.Hostname()
	data := &detailLog{
		LogType:       "Detail",
		Host:          host,
		AppName:       conf.ProjectName,
		Instance:      getInstance(),
		Session:       fmt.Sprintf("%v", session),
		InitInvoke:    initInvoke,
		Scenario:      scenario,
		Identity:      identity,
		Input:         []InputOutputLog{},
		Output:        []InputOutputLog{},
		conf:          conf,
		startTimeDate: time.Now(),
		timeCounter:   make(map[string]time.Time),
		req:           req,
	}

	return data
}

func getInstance() *string {
	instance := os.Getenv("pm_id")
	if instance == "" {
		return nil
	}
	return &instance
}

func (dl *detailLog) IsRawDataEnabled() bool {
	return dl.conf.Detail.RawData
}

func (dl *detailLog) AddInputRequest(node, cmd, invoke string, rawData, data interface{}) {
	dl.addInput(&logEvent{
		node:           node,
		cmd:            cmd,
		invoke:         invoke,
		logType:        "req",
		rawData:        rawData,
		data:           data,
		protocol:       dl.req.Proto,
		protocolMethod: dl.req.Method,
	})
}

func (dl *detailLog) AddInputResponse(node, cmd, invoke string, rawData, data interface{}, protocol, protocolMethod string) {
	resTime := time.Now().Format(time.RFC3339)
	dl.addInput(&logEvent{
		node:           node,
		cmd:            cmd,
		invoke:         invoke,
		logType:        "res",
		rawData:        rawData,
		data:           data,
		resTime:        resTime,
		protocol:       protocol,
		protocolMethod: protocolMethod,
	})
}

func (dl *detailLog) AddOutputResponse(node, cmd, invoke string, rawData, data interface{}) {
	dl.AddOutput(logEvent{
		node:    node,
		cmd:     cmd,
		invoke:  invoke,
		logType: "res",
		rawData: rawData,
		data:    data,
	})
}

func (dl *detailLog) addInput(input *logEvent) {
	now := time.Now()
	if dl.startTimeDate.IsZero() {
		dl.startTimeDate = now
	}

	var resTimeString string
	if input.resTime != "" {
		resTimeString = input.resTime
	} else if input.logType == "res" {
		if startTime, exists := dl.timeCounter[input.invoke]; exists {
			duration := time.Since(startTime).Milliseconds()
			resTimeString = fmt.Sprintf("%d ms", duration)
			delete(dl.timeCounter, input.invoke)
		}
	}

	protocolValue := dl.buildValueProtocol(&input.protocol, &input.protocolMethod)
	inputLog := InputOutputLog{
		Invoke:   input.invoke,
		Event:    fmt.Sprintf("%s.%s", input.node, input.cmd),
		Protocol: protocolValue,
		Type:     input.logType,
		RawData:  dl.isRawDataEnabledIf(input.rawData),
		Data:     input.data,
		ResTime:  &resTimeString,
	}
	dl.Input = append(dl.Input, inputLog)
}

func (dl *detailLog) AddOutputRequest(node, cmd, invoke string, rawData, data interface{}) {
	dl.AddOutput(logEvent{
		node:           node,
		cmd:            cmd,
		invoke:         invoke,
		logType:        "rep",
		rawData:        rawData,
		data:           data,
		protocol:       dl.req.Proto,
		protocolMethod: dl.req.Method,
	})
}

func (dl *detailLog) AddOutput(out logEvent) {
	now := time.Now()
	if out.invoke != "" && out.logType != "res" {
		dl.timeCounter[out.invoke] = now
	}

	protocolValue := dl.buildValueProtocol(&out.protocol, &out.protocolMethod)
	outputLog := InputOutputLog{
		Invoke:   out.invoke,
		Event:    fmt.Sprintf("%s.%s", out.node, out.cmd),
		Protocol: protocolValue,
		Type:     out.logType,
		RawData:  dl.isRawDataEnabledIf(out.rawData),
		Data:     out.data,
	}
	dl.Output = append(dl.Output, outputLog)
}

func (dl *detailLog) End() {
	if dl.startTimeDate.IsZero() {
		log.Fatal("end() called without any input/output")
	}

	processingTime := fmt.Sprintf("%d ms", time.Since(dl.startTimeDate).Milliseconds())
	dl.ProcessingTime = &processingTime

	inputTimeStamp := dl.formatTime(dl.inputTime)
	dl.InputTimeStamp = inputTimeStamp

	outputTimeStamp := dl.formatTime(dl.outputTime)
	dl.OutputTimeStamp = outputTimeStamp

	logDetail, _ := json.Marshal(dl)
	if dl.conf.Detail.LogConsole {
		os.Stdout.Write(logDetail)
		os.Stdout.Write([]byte(endOfLine()))
	}

	if dl.conf.Detail.LogFile {
		writeLogToFile(logDetail)
	}

	dl.clear()
}

func (dl *detailLog) buildValueProtocol(protocol, method *string) *string {
	if protocol == nil {
		return nil
	}
	result := *protocol
	if method != nil {
		result += "." + *method
	}
	return &result
}

func (dl *detailLog) isRawDataEnabledIf(rawData interface{}) interface{} {
	if dl.conf.Detail.RawData {
		return rawData
	}
	return nil
}

func (dl *detailLog) formatTime(t *time.Time) *string {
	if t == nil {
		return nil
	}
	ts := t.Format(time.RFC3339)
	return &ts
}
func endOfLine() string {
	if runtime.GOOS == "windows" {
		return "\r\n"
	}
	return "\n"
}
func (dl *detailLog) clear() {
	dl.ProcessingTime = nil
	dl.InputTimeStamp = nil
	dl.OutputTimeStamp = nil
	dl.Input = []InputOutputLog{}
	dl.Output = []InputOutputLog{}
	dl.startTimeDate = time.Time{}
}

func writeLogToFile(logDetail []byte) {
	_log.Info(string(logDetail))

	// defer _log.Sync()
}
