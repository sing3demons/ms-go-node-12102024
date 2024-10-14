package logger

import (
	"context"
	"os"

	"go.uber.org/zap"
	"go.uber.org/zap/zapcore"
)

var Logger *zap.Logger = nil

func NewLogger() *zap.Logger {

	var encCfg zapcore.EncoderConfig
	encCfg.MessageKey = "msg"

	// add the encoder config and rotator to create a new zap logger
	w := zapcore.AddSync(os.Stdout)
	core := zapcore.NewCore(zapcore.NewConsoleEncoder(encCfg), w, zap.InfoLevel)

	log := zap.New(core)
	Logger = log

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
