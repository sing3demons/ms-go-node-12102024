package ms

import (
	"encoding/json"
	"net/http"

	"github.com/sing3demons/go-service/constants"
	"github.com/sing3demons/go-service/mlog"
)

type HTTPContext struct {
	Res http.ResponseWriter
	Req *http.Request
}

type ServiceHandleFunc func(c HTTPContext)

func NewHTTPContext(res http.ResponseWriter, req *http.Request) HTTPContext {
	return HTTPContext{
		Res: res,
		Req: req,
	}
}

type BaseResponse struct {
	Res http.ResponseWriter
	Log *mlog.DetailLog
}

func (h *HTTPContext) JSON(code int, data interface{}) {
	h.Res.Header().Set(constants.ContentType, constants.ContentTypeJSON)
	h.Res.WriteHeader(code)
	json.NewEncoder(h.Res).Encode(data)
}

func (h *HTTPContext) NewCtx() *BaseResponse {
	return &BaseResponse{
		Res: h.Res,
		Log: mlog.NewDetailLog(h.Req),
	}
}

func (b *BaseResponse) JSON(code int, data interface{}) {
	b.Res.Header().Set(constants.ContentType, constants.ContentTypeJSON)
	b.Res.WriteHeader(code)
	json.NewEncoder(b.Res).Encode(data)
	b.Log.End()
}

func (b *BaseResponse) Error(code int, err error) {
	data := map[string]interface{}{
		"message": err.Error(),
	}

	b.AddLogClient(data)
	b.JSON(code, data)
}

func (b *BaseResponse) AddLogClient(data map[string]any) {
	b.Log.AddEvent("client.output", data)
}

func (b *BaseResponse) AddInputLogClient(data any) {
	b.Log.AddEvent("client.input", data)
}

func (h *HTTPContext) GetSession() string {
	return h.Req.Context().Value(constants.Session).(string)
}
