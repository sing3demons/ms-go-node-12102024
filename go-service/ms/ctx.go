package ms

import (
	"encoding/json"
	"net/http"

	"github.com/sing3demons/go-service/constants"
	"github.com/sing3demons/go-service/logger"
	"github.com/sing3demons/go-service/mlog"
)

type HTTPContext struct {
	Res http.ResponseWriter
	Req *http.Request
	l   *logger.DetailLog
	Log *mlog.DetailLog
}

type ServiceHandleFunc func(c HTTPContext)

func NewHTTPContext(res http.ResponseWriter, req *http.Request) HTTPContext {
	return HTTPContext{
		Res: res,
		Req: req,
	}
}

func (h *HTTPContext) L() *mlog.DetailLog {
	return mlog.NewDetailLog(h.Req)
}

func (h *HTTPContext) DetailLog(initInvoke string, scenario string, identity string) logger.DetailLog {
	l := logger.NewDetailLog(h.Req, initInvoke, scenario, identity)
	h.l = &l
	return l
}

func (h *HTTPContext) JSON(code int, data interface{}) {
	h.Res.Header().Set(constants.ContentType, constants.ContentTypeJSON)
	h.Res.WriteHeader(code)
	json.NewEncoder(h.Res).Encode(data)

	if h.l != nil {
		log := *h.l
		log.AutoEnd()
	}

	if h.Log != nil {
		h.Log.End()
	}
}

func (b *HTTPContext) Error(code int, err error) {
	data := map[string]interface{}{
		"message": err.Error(),
	}

	if b.Log != nil {
		b.Log.AddEvent("error", data)
	}

	b.JSON(code, data)
}

func (b *HTTPContext) AddLogClient(data map[string]any) {
	b.Log.AddEvent("client.output", data)
}

func (b *HTTPContext) AddInputLogClient(data any) {
	b.Log.AddEvent("client.input", data)
}

func (h *HTTPContext) GetSession() string {
	return h.Req.Context().Value(constants.Session).(string)
}
