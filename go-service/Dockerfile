FROM golang:1.22-alpine3.19 AS builder
ENV GO111MODULE=on
ENV CGO_ENABLED=1
ENV GOOS=linux
ENV GOARCH=amd64

WORKDIR /go/src

COPY go.mod .
COPY go.sum .
RUN go mod download && go mod verify && \
	apk update && apk upgrade && \
	apk add --no-cache tzdata ca-certificates pkgconf git bash build-base sudo && \
	ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime && echo "$TZ" > /etc/timezone && \
	rm -rf /var/cache/apk/*
COPY . .

RUN go build -tags musl --ldflags "-extldflags -static" -o main .

FROM alpine:3.19
RUN apk update && apk upgrade && \
	apk add --no-cache tzdata && \
	ln -snf "/usr/share/zoneinfo/$TZ" /etc/localtime && echo "$TZ" > /etc/timezone
ENV TZ=Asia/Bangkok
COPY --from=builder /go/src/main /
EXPOSE 8080

CMD ["./main"]