// server.ts
import express, { NextFunction, type Request, type Response } from 'express'
import { v7 as uuidv4 } from 'uuid'
import log from './logger/logger'
import userRouter from './router/user.router'
import { Summary, toSummaryLog } from './logger/summary'
import helmet from 'helmet'

const app = express()
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use((req, res, next) => {
  if (!req.headers['x-api-service']) {
    log.error('Unknown API service', { path: req.originalUrl, method: req.method, trace_id: req.trace_id, span_id: req.span_id, session: req.session, headers: req.headers })
    res.status(404).json({ message: 'Unknown API service', path: req.originalUrl })
  }
  const traceID = uuidv4()
  const spanID = uuidv4()
  const newSummaryLog: Summary = {
    intime: new Date().toISOString(),
    appname: 'user-service',
    instance: '1',
  }
  // Attach trace_id and span_id to the request
  req['trace_id'] = traceID
  req['span_id'] = spanID
  if (!req.headers['session']) {
    req['session'] = `default-${uuidv4()}`
  } else {
    req['session'] = req.headers['session'] as string
  }
  newSummaryLog.invoke = req['session']
  newSummaryLog.ssid = req['session']
  const input = {
    headers: req.headers,
    body: req.body,
    query: req.query,
    params: req.params,
  }
  newSummaryLog.input = JSON.stringify(input)

  next()
  // const originalJson = res.json
  const originalSend = res.send

  // Wrap res.send()
  res.send = (body: any) => {
    newSummaryLog.output = JSON.stringify(body)
    toSummaryLog(newSummaryLog)
    return originalSend.call(res, body)
  }
})
app.use(helmet())

app.use('/api/v1/users', userRouter)

app.use((req, res) => {
  log.error('Unknown URL', { path: req.originalUrl, method: req.method, trace_id: req.trace_id, span_id: req.span_id, session: req.session, headers: req.headers })
  res.status(404).json({ message: 'Unknown URL', path: req.originalUrl })
})

app.use((error: unknown, _request: Request, res: Response, _next: NextFunction) => {
  let statusCode = 500
  let message = 'An unknown error occurred'
  if (error instanceof Error) {
    log.error(error)
    message = error.message

    if (message.includes('not found')) {
      statusCode = 404
    }
  } else {
    log.error(`Unknown error: ${String(error)}`)
    message = `An unknown error occurred, ${String(error)}`
  }

  const data = {
    statusCode: statusCode,
    message,
    success: false,
    data: null,
    traceStack: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
  }
  res.status(statusCode).send(data)
})

export default app
