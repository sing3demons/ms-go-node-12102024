package logger

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
	"gopkg.in/natefinch/lumberjack.v2"
)

var Logger *zap.Logger = zap.New(zapcore.NewNopCore())

const logDir = "./log/detail"

// Ensure the /log/detail directory exists
func ensureLogDirExists() error {
	if _, err := os.Stat(logDir); os.IsNotExist(err) {
		err := os.MkdirAll(logDir, os.ModePerm)
		if err != nil {
			return errors.New("failed to create log directory")
		}
	}
	return nil
}

// Function to generate log file name based on appName and timestamp (pattern: appName_YYYYMMDD_HHmmss.log)
func getLogFileName(t time.Time) string {
	appName := os.Getenv("SERVICE_NAME")
	if appName == "" {
		appName = "go-service"
	}
	year, month, day := t.Date()
	hour, minute, second := t.Clock()

	return fmt.Sprintf("%s_%04d%02d%02d_%02d%02d%02d.log", appName, year, month, day, hour, minute, second)
}

func NewLogger() *zap.Logger {
	// create a zapcore encoder config
	var encCfg zapcore.EncoderConfig
	encCfg.MessageKey = "msg"

	w := zapcore.AddSync(os.Stdout)
	core := zapcore.NewCore(zapcore.NewConsoleEncoder(encCfg), w, zap.InfoLevel)

	log := zap.New(core)

	return log
}

func NewLogFile() *zap.Logger {
	// Create log file with rotating mechanism
	logFile := filepath.Join(logDir, getLogFileName(time.Now()))
	if err := ensureLogDirExists(); err != nil {
		fmt.Println("Failed to create log directory", err)
	}

	// Create a zapcore encoder config
	encCfg := zapcore.EncoderConfig{
		MessageKey:   "msg",
		TimeKey:      "time",
		LevelKey:     "level",
		CallerKey:    "caller",
		EncodeCaller: zapcore.ShortCallerEncoder,
	}

	// File encoder using console format
	fileEncoder := zapcore.NewConsoleEncoder(encCfg)

	// Setting up lumberjack logger for log rotation
	writerSync := zapcore.AddSync(&lumberjack.Logger{
		Filename:   logFile,
		MaxSize:    500, // megabytes
		MaxBackups: 3,   // number of backups
		MaxAge:     1,   // days
		LocalTime:  true,
		Compress:   true, // compress the backups
	})

	// Create the core with InfoLevel logging
	core := zapcore.NewCore(fileEncoder, writerSync, zap.InfoLevel)

	// Create logger
	log := zap.New(core)

	return log
}

type InvokeKey struct{}

func SetInvoke(ctx context.Context, invoke string) context.Context {
	return context.WithValue(ctx, InvokeKey{}, invoke)
}

func GetInvoke(ctx context.Context) string {
	invoke, _ := ctx.Value(InvokeKey{}).(string)

	return invoke
}
