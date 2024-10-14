package logger

import (
	"encoding/json"
	"time"
)

// type SummaryLogKey struct{}

type Summary struct {
	LogTime    time.Time `json:"log_time"`
	Hostname   string    `json:"hostname"`
	Appname    string    `json:"appname"`
	Instance   string    `json:"instance"`
	LogName    string    `json:"log_name"`
	Intime     string    `json:"in_time"`
	Outtime    string    `json:"out_time"`
	DiffTime   int64     `json:"diff_time"`
	Ssid       string    `json:"ssid"`
	Invoke     string    `json:"invoke"`
	AuditLogId string    `json:"audit_log_id"`
	MobileNo   string    `json:"mobile_no"`
	Input      string    `json:"input"`
	Output     string    `json:"output"`
	Status     int       `json:"status"`
	ResultCode string    `json:"result_code"`
	Command    string    `json:"command"`
	MenuId     string    `json:"menu_id"`
	Channel    string    `json:"channel"`
}

func ToSummaryLog(newSummaryLog Summary) {
	startDate, _ := time.Parse(time.RFC3339, newSummaryLog.Intime)
	endTime := time.Now()
	newSummaryLog.LogName = "SUMMARY"
	newSummaryLog.LogTime = time.Now()
	newSummaryLog.Outtime = endTime.Format(time.RFC3339)
	newSummaryLog.DiffTime = endTime.Sub(startDate).Milliseconds()

	if len(newSummaryLog.Input) > 2000 {
		newSummaryLog.Input = newSummaryLog.Input[0:2000]
	}
	if len(newSummaryLog.Output) > 2000 {
		newSummaryLog.Output = newSummaryLog.Output[0:2000]
	}
	jsonBytes, _ := json.Marshal(newSummaryLog)

	summaryString := string(jsonBytes)

	Logger.Info(summaryString)
}
