package main

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/sing3demons/go-service/client"
	"github.com/sing3demons/go-service/constants"
	"github.com/sing3demons/go-service/ms"
)

func init() {
	if os.Getenv("SERVICE_NAME") == "" {
		os.Setenv("SERVICE_NAME", "go_service")
	}
	if os.Getenv("PORT") == "" {
		os.Setenv("PORT", "8080")
	}

	if os.Getenv("APP_ENV") == "" {
		os.Setenv("APP_ENV", "local")
	}

	if os.Getenv("USER_SERVICE_URL") == "" {
		os.Setenv("USER_SERVICE_URL", "http://localhost:3000")
	}

}

func main() {
	app := ms.NewApplication(ms.Config{
		Addr: os.Getenv("PORT"),
		Env:  os.Getenv("APP_ENV"),
	})

	authHandler := AuthHandler{
		BaseURL: os.Getenv("USER_SERVICE_URL"),
		Name:    os.Getenv("SERVICE_NAME"),
		System:  "x-go-service",
	}

	servers := os.Getenv("KAFKA_SERVERS")
	if servers == "" {
		servers = "localhost:9092"
	}

	fmt.Println("Kafka servers: ", servers)

	topic := "client"
	prod := ms.NewProducer(servers, app)

	app.GET("/api/v1/health", func(c ms.HTTPContext) {
		initInvoked := "init_invoked"
		scenario := "curl -X GET 'http://localhost:8080/api/v1/health'"
		detailLog := c.DetailLog(initInvoked, scenario, "client")
		q := c.Req.URL.Query()

		cmd := "get-health"

		data := map[string]string{"status": "ok"}
		detailLog.AddInputRequest("client", cmd, initInvoked, nil, q)

		detailLog.AddOutputRequest("client", cmd, initInvoked, "", data)

		go prod.SendMessage(topic, "", data)
		prod.SendMessage("test", "", data)

		c.JSON(http.StatusOK, data)
	})

	app.POST("/api/v1/auth/login", authHandler.Login)
	app.POST("/api/v1/auth/register", authHandler.Register)
	app.POST("/api/v1/auth/verify", authHandler.Verify)

	app.Consume(servers, topic, "group_id", func(c *ms.ConsumerContext) {
		// c.Log("Consumer:: -> " + c.ReadInput())
		log.Println("Consumer:: -> ", c.Payload())
	})

	app.Consume(servers, "test", "group_id", func(c *ms.ConsumerContext) {
		log.Println("Consumer:: -> ", c.Payload())
	})

	app.Run()
}

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type VerifyRequest struct {
	AccessToken string `json:"access_token"`
}

type AuthHandler struct {
	BaseURL string
	Name    string
	System  string
}

func (h AuthHandler) Login(c ms.HTTPContext) {
	result := c.L()
	_ = result

	httpClient := client.NewHttp(&client.ServiceConfig{
		Name:   h.Name,
		Method: http.MethodPost,
		Url:    h.BaseURL + "/api/v1/users/login",
		System: h.System,
	})

	var body LoginRequest
	err := json.NewDecoder(c.Req.Body).Decode(&body)
	if err != nil {
		c.Error(http.StatusBadRequest, err)
		return
	}

	if body.Email == "" || body.Password == "" {
		c.Error(http.StatusBadRequest, errors.New("email and password is required"))
		return
	}

	c.AddInputLogClient(map[string]interface{}{
		"header": c.Req.Header,
		"body":   body,
	})

	// r = r.WithContext(context.WithValue(r.Context(), constant.Session, session))
	resp, err := httpClient.Call(c.Req.Context(), client.Option{
		Body: map[string]string{
			"email":    body.Email,
			"password": body.Password,
		},
		Header: map[string]string{
			constants.ContentType:     constants.ContentTypeJSON,
			string(constants.Session): c.GetSession(),
		},
	})
	if err != nil {
		c.Error(http.StatusInternalServerError, err)
		return
	}

	data := map[string]interface{}{}
	json.Unmarshal(resp.Body, &data)
	c.AddLogClient(data)
	c.JSON(resp.StatusCode, data)
}

func (h AuthHandler) Register(c ms.HTTPContext) {
	result := c.L()
	_ = result

	httpClient := client.NewHttp(&client.ServiceConfig{
		Name:   h.Name,
		Method: http.MethodPost,
		Url:    h.BaseURL + "/api/v1/users/register",
		System: h.System,
	})

	var body LoginRequest
	err := json.NewDecoder(c.Req.Body).Decode(&body)
	if err != nil {
		c.Error(http.StatusBadRequest, err)
		return
	}

	if body.Email == "" || body.Password == "" {
		c.Error(http.StatusBadRequest, errors.New("email and password is required"))
		return
	}

	c.AddInputLogClient(map[string]interface{}{
		"header": c.Req.Header,
		"body":   body,
	})

	resp, err := httpClient.Call(c.Req.Context(), client.Option{
		Body: map[string]string{
			"email":    body.Email,
			"password": body.Password,
		}, Header: map[string]string{
			constants.ContentType:     constants.ContentTypeJSON,
			string(constants.Session): c.GetSession()},
	})
	if err != nil {
		c.Error(http.StatusInternalServerError, err)
		return
	}

	data := map[string]interface{}{}
	json.Unmarshal(resp.Body, &data)
	c.AddLogClient(data)
	c.JSON(resp.StatusCode, data)
}

func (h AuthHandler) Verify(c ms.HTTPContext) {
	l := c.L()

	httpClient := client.NewHttp(&client.ServiceConfig{
		Name:   h.Name,
		Method: http.MethodPost,
		Url:    h.BaseURL + "/api/v1/users/verify",
		System: h.System,
	})

	var body VerifyRequest
	err := json.NewDecoder(c.Req.Body).Decode(&body)
	if err != nil {
		c.Error(http.StatusBadRequest, err)
		return
	}

	if body.AccessToken == "" {
		c.Error(http.StatusBadRequest, errors.New("access token is required"))
		return
	}

	l.AddEvent("client.input", map[string]interface{}{
		"header": c.Req.Header,
		"body":   body,
	})

	resp, err := httpClient.Call(c.Req.Context(), client.Option{
		Body: map[string]string{
			"access_token": body.AccessToken,
		},
		Header: map[string]string{
			constants.ContentType:     constants.ContentTypeJSON,
			string(constants.Session): c.GetSession(),
		},
	})

	if err != nil {
		c.Error(http.StatusInternalServerError, err)
		return
	}

	data := map[string]interface{}{}
	json.Unmarshal(resp.Body, &data)

	l.AddEvent("client.output", data)
	c.JSON(resp.StatusCode, data)
}
