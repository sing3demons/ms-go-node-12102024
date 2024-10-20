package ms

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"runtime"
	"syscall"
	"time"

	"github.com/gorilla/mux"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
	"github.com/sing3demons/go-service/logger"
	"github.com/sing3demons/go-service/middleware"
	"go.uber.org/zap"
)

type application struct {
	config Config
	logger *zap.Logger
	router *mux.Router
}

type Config struct {
	Addr     string
	Db       DbConfig
	Env      string
	RedisCfg RedisConfig
}

type RedisConfig struct {
	Addr    string
	Pw      string
	Db      int
	Enabled bool
}

type DbConfig struct {
	Addr         string
	MaxOpenConns int
	MaxIdleConns int
	MaxIdleTime  string
}

func NewApplication(cfg Config) *application {
	prometheus.Register(totalRequests)
	prometheus.Register(responseStatus)
	prometheus.Register(httpDuration)

	r := mux.NewRouter()

	reg := prometheus.NewRegistry()
	// m := NewMetrics(reg)
	promHandler := promhttp.HandlerFor(reg, promhttp.HandlerOpts{})
	r.Handle("/metrics", promHandler)

	r.Use(middleware.Logger)
	return &application{
		config: cfg,
		logger: logger.NewLogger(),
		router: r,
	}
}

func (app *application) Run() error {

	srv := &http.Server{
		Addr:         fmt.Sprintf(":%s", app.config.Addr),
		Handler:      app.router,
		WriteTimeout: time.Second * 30,
		ReadTimeout:  time.Second * 10,
		IdleTimeout:  time.Minute,
	}

	shutdown := make(chan error)

	go func() {
		quit := make(chan os.Signal, 1)

		signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
		s := <-quit

		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()

		app.logger.Info("shutting down server", zap.String("signal", s.String()))

		shutdown <- srv.Shutdown(ctx)
	}()

	hostName, _ := os.Hostname()
	platform := runtime.GOOS
	arch := runtime.GOARCH
	cpus := runtime.NumCPU()
	totalMemory := runtime.NumGoroutine()
	freeMemory := runtime.NumGoroutine()
	uptime := time.Since(time.Now())
	pid := os.Getpid()

	detail := map[string]interface{}{
		"startTime":    time.Now().Format(time.RFC3339),
		"addr":         app.config.Addr,
		"env":          app.config.Env,
		"app_name":     os.Getenv("SERVICE_NAME"),
		"hostname":     hostName,
		"pid":          fmt.Sprintf("%d", os.Getpid()),
		"platform":     platform,
		"arch":         arch,
		"cpus":         cpus,
		"total_memory": totalMemory,
		"free_memory":  freeMemory,
		"uptime":       uptime,
		"service_pid":  fmt.Sprintf("%d", pid),
		"go_version":   runtime.Version(),
	}
	jsonDetail, _ := json.Marshal(detail)
	app.logger.Info(fmt.Sprintf("server is listening on port %s", app.config.Addr))
	app.logger.Info(string(jsonDetail))

	err := srv.ListenAndServe()
	if !errors.Is(err, http.ErrServerClosed) {
		return err
	}

	err = <-shutdown
	if err != nil {
		return err
	}

	app.logger.Info("server stopped")

	return nil
}

func (m *application) Log(tag string, msg string) {
	m.logger.Info(fmt.Sprintf("[%s]: %s", tag, msg))
}

func (m *application) Use(middleware func(http.Handler) http.Handler) {
	m.router.Use(middleware)
}

func (m *application) GET(path string, h ServiceHandleFunc) *mux.Route {
	return m.router.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		h(NewHTTPContext(w, r))
	}).Methods(http.MethodGet)
}

func (m *application) POST(path string, h ServiceHandleFunc) *mux.Route {
	return m.router.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		h(NewHTTPContext(w, r))
	}).Methods(http.MethodPost)
}

func (m *application) PUT(path string, h ServiceHandleFunc) *mux.Route {
	return m.router.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		h(NewHTTPContext(w, r))
	}).Methods(http.MethodPut)
}

func (m *application) DELETE(path string, h ServiceHandleFunc) *mux.Route {
	return m.router.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		h(NewHTTPContext(w, r))
	}).Methods(http.MethodDelete)
}

func (m *application) PATCH(path string, h ServiceHandleFunc) *mux.Route {
	return m.router.HandleFunc(path, func(w http.ResponseWriter, r *http.Request) {
		h(NewHTTPContext(w, r))
	}).Methods(http.MethodPatch)
}
