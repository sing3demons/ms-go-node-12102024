import AppServer, { AppRouter, Type } from './appRouter'
import os from 'os'
import DetailLog from './appRouter/loggerEntry'
import { initTracer } from './appRouter/tracer'
import { FORMAT_HTTP_HEADERS, Tags } from 'opentracing'

const app = new AppServer()
const tracer = initTracer()
const router = new AppRouter()

const querySchema = Type.Object({
  name: Type.String(),
  age: Type.Optional(Type.Number()),
})

const bodySchema = Type.Object({
  description: Type.String(),
})

router.get('/api/v1/health', async ({ params }) => {
  return { status: 'UP', success: true }
})

router.get('/api/v1/resource', async ({ req, res }) => {
  const span = tracer.startSpan('init-span')
  const logger = new DetailLog(req, res)

  span.setTag(Tags.HTTP_URL, req.url)
  span.setTag(Tags.HTTP_METHOD, req.method)
  span.setTag(Tags.SPAN_KIND, Tags.SPAN_KIND_RPC_SERVER)
  span.setTag(Tags.PEER_HOSTNAME, os.hostname())
  span.setTag(Tags.PEER_PORT, 8080)
  span.setTag(Tags.COMPONENT, 'customer-service')
  span.setTag(Tags.HTTP_STATUS_CODE, 200)
  span.setTag('trace_id', req.headers['trace_id'])
  span.setTag('span_id', req.headers['span_id'])
  span.setTag('x-session-id', req.session)
  tracer.inject(span, FORMAT_HTTP_HEADERS, req.headers)

  logger.addEvent('client.request', {
    headers: req.headers,
  })

  const cpus = new Set(os.cpus().map((cpu) => cpu.model))
  const resource = {
    hostname: os.hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: Array.from(cpus).join(', '),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    environment: process.env.NODE_ENV,
    pid: process.pid,
  }
  const result = { success: true, data: resource }
  logger.addEvent('client.response', result).end()
  span.finish()
  return result
})

app.router(router).listen(8080, () => {
  console.log('Server is running on port 8080')
})
