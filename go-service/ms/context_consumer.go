package ms

import "fmt"

type ConsumerContext struct {
	message kafkaMessage
	ms      *application
}

// NewConsumerContext is the constructor function for ConsumerContext
func NewConsumerContext(message kafkaMessage, ms *application) *ConsumerContext {
	return &ConsumerContext{
		message: message,
		ms:      ms,
	}
}

// Log will log a message
func (ctx *ConsumerContext) Log(message string) {
	fmt.Println("Consumer: ", message)
}

// Param return parameter by name (empty in case of Consumer)
func (ctx *ConsumerContext) Param(name string) string {
	return ""
}

// ReadInput return message
func (ctx *ConsumerContext) ReadInput() string {
	return ctx.message.value
}

type Msg struct {
	Topic     string `json:"topic"`
	Timestamp string `json:"timestamp"`
	Key       string `json:"key"`
	Value     string `json:"value"`
}

func (ctx *ConsumerContext) Payload() Msg {
	return Msg{
		Topic:     ctx.message.topic,
		Timestamp: ctx.message.timestamp.String(),
		Key:       ctx.message.key,
		Value:     ctx.message.value,
	}
}

// Response return response to client
func (ctx *ConsumerContext) Response(responseCode int, responseData interface{}) {
	return
}
