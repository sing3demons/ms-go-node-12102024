import express, {
  type Express,
  type Request,
  type Response,
  type NextFunction,
  type RequestHandler,
  Router,
} from 'express'
import http from 'http'
import { Socket } from 'net'
import { v7 as uuid } from 'uuid'
import promBundle from 'express-prom-bundle'
import { Type, Static, TSchema } from '@sinclair/typebox'
import { TypeCompiler } from '@sinclair/typebox/compiler'
import swaggerJsDoc from 'swagger-jsdoc'
import DetailLog from './loggerEntry'

const transaction = 'x-session-id'
const metricsMiddleware = promBundle({ includeMethod: true })

type ExtractParams<T extends string> = T extends `${infer _Start}:${infer Param}/${infer Rest}`
  ? [Param, ...ExtractParams<Rest>]
  : T extends `${infer _Start}:${infer Param}`
  ? [Param]
  : []

type ParamsObject<T extends string[]> = { [K in T[number]]: string }

type RouteHandler<T extends string, P = ParamsObject<ExtractParams<T>>, B = unknown, Q = unknown> = (ctx: {
  params: P
  body: B
  query: Q
  req: Request
  res: Response
  next: NextFunction
}) => Promise<BaseResponse>

enum HttpMethod {
  GET = 'get',
  POST = 'post',
  PUT = 'put',
  PATCH = 'patch',
  DELETE = 'delete',
}

interface Route<T extends string = string, P extends TSchema = any, B extends TSchema = any, Q extends TSchema = any> {
  path: T
  method: HttpMethod
  handler: RouteHandler<T, B, Q>
  schemas?: {
    params?: TSchema
    body?: TSchema
    query?: TSchema
    middleware?: RequestHandler
    detail?: SwaggerDetail
  }
}

function catchAsync(fn: (...args: any[]) => any) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch((err) => next(err))
  }
}

export interface BaseResponse<T = unknown> {
  statusCode?: number
  message?: string
  /**
   * @default true
   */
  success?: boolean
  data?: T
  traceStack?: string
  page?: number
  pageSize?: number
  total?: number
  download?: string
}

function createParamsObject<T extends string>(path: T) {
  const matches = path.match(/:(\w+)/g)
  const paramsArray = matches ? (matches.map((match) => match.substring(1)) as ExtractParams<T>) : []

  const routeParamsSchema = Type.Object(
    paramsArray.reduce((acc, key) => {
      acc[key as keyof typeof acc] = Type.String()
      return acc
    }, {} as Record<(typeof paramsArray)[number], any>) // Use a Record type to define the accumulator
  )

  return routeParamsSchema
}

export class HttpError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message)
    this.name = 'HttpError'
  }
}

export function notFoundError(req: Request, res: Response, _next: NextFunction) {
  res.status(404).json({ message: 'Unknown URL', path: req.originalUrl })
}

export function globalErrorHandler(error: unknown, _request: Request, res: Response, _next: NextFunction) {
  let statusCode = 500
  let message = 'An unknown error occurred'
  if (error instanceof Error) {
    message = error.message

    if (message.includes('not found')) {
      statusCode = 404
    }
  } else {
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
}

export type AppSwagger = {
  path: string
  method: HttpMethod
  detail?: SwaggerDetail
  body: Record<string, any>
  query: Record<string, any>
  params: Record<string, any>
  response: Record<string, any>
}

type TSwaggerObject = {
  name: string
  type: string
  required: boolean | false
  description?: string
}

type TResponses = {
  type: 'object' | 'array' | 'string' | 'number' | 'boolean'
  properties?:
    | Record<string, { type: string; default?: string | number | object | []; nullable?: boolean }>
    | Record<string, TResponses>
    | Record<string, { type: string; properties: TResponses }>
  items?: TResponses | { type: string } | { type: string; properties: TResponses }
}

type IParameters = {
  in: 'path' | 'query'
  name: string
  schema: { type: string; enum?: string[]; default?: string | number | object | [] }
  required: boolean
}

type SwaggerDetail = {
  path?: string
  tags?: string[]
  summary?: string
  description?: string
  query?: IParameters[]
  body?: TSwaggerObject[]
  response?: {
    success?: TResponses
    'bad request'?: TResponses
    'internal server error'?: TResponses
  }
  params?: IParameters[]
}

type RouteSchema<P, B, Q> = {
  params?: P
  body?: B
  query?: Q
  middleware?: RequestHandler
  detail?: SwaggerDetail
}

class BaseRouter {
  protected routes: Route[] = []

  protected createHandler(
    handler: RouteHandler<any, any, any>,
    schemas?: { params?: TSchema; body?: TSchema; query?: TSchema }
  ) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        this.validateRequest(req, schemas)
        this.preRequest(handler)(req, res, next)
      } catch (error) {
        this.handleError(error, res, next)
      }
    }
  }

  private validateRequest(req: Request, schemas?: { params?: TSchema; body?: TSchema; query?: TSchema }) {
    const valueErr = new Map<string, { path: string; message: string[] }>()

    if (schemas?.params) {
      const result = TypeCompiler.Compile(schemas.params)
      if (!result.Check(req.params)) {
        const value = [...result.Errors(req.params)].map(({ path, message }) => ({ path, message }))
        value.forEach((v) => {
          if (valueErr.has(v.path)) {
            valueErr.get(v.path)?.message.push(v.message)
          } else {
            valueErr.set(v.path, { path: v.path, message: [v.message] })
          }
        })
      }
    }
    if (schemas?.body) {
      const result = TypeCompiler.Compile(schemas.body)
      if (!result.Check(req.body)) {
        const value = [...result.Errors(req.params)].map(({ path, message }) => ({ path, message }))
        value.forEach((v) => {
          if (valueErr.has(v.path)) {
            valueErr.get(v.path)?.message.push(v.message)
          } else {
            valueErr.set(v.path, { path: v.path, message: [v.message] })
          }
        })
      }
    }
    if (schemas?.query) {
      const result = TypeCompiler.Compile(schemas.query)
      if (!result.Check(req.query)) {
        const value = [...result.Errors(req.params)].map(({ path, message }) => ({ path, message }))
        value.forEach((v) => {
          if (valueErr.has(v.path)) {
            valueErr.get(v.path)?.message.push(v.message)
          } else {
            valueErr.set(v.path, { path: v.path, message: [v.message] })
          }
        })
      }
    }

    if (valueErr.size > 0) throw Array.from(valueErr.values())
  }

  private handleError(error: unknown, res: Response, next: NextFunction) {
    if (Array.isArray(error)) {
      // Assuming `error` is an array of manual validation error messages
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        details: error.map((err: { path: string; message: string[] }) => ({
          name: err?.path.startsWith('/') ? err.path.replace('/', '') : err.path || 'unknown',
          message: err?.message || 'Unknown error',
        })),
      })
    } else if (error instanceof Error) {
      // Handle general errors
      return res.status(500).json({
        success: false,
        message: 'Internal server error',
        traceStack: error.stack,
      })
    }

    // Proceed to the next middleware
    next(error)
  }

  private preRequest(handler: RouteHandler<any, any, any>) {
    return catchAsync(async (req: Request, res: Response, next: NextFunction) => {
      const ctx = {
        params: req.params,
        body: req.body,
        query: req.query,
        req: req as Request,
        res: res as Response,
        next,
      }
      const result = await handler(ctx)

      if (result?.download) {
        res.download(result.download, (err) => {
          if (err) {
            res.status(500).send({ success: false, message: 'Internal server error' })
          }
        })
        return
      }
      let status = 200
      if (result.statusCode) {
        if (result.statusCode >= 1000) {
          status = parseInt(`${result.statusCode}`.slice(0, 3))
        } else if (result.statusCode) {
          status = parseFloat(`${result.statusCode}`.padEnd(3, '0'))
        }
      }
      res.status(status).send({
        success: true,
        message: 'Request successful',
        ...result,
      } satisfies BaseResponse)
    })
  }

  protected addRoute<
    T extends string,
    P extends { [K in T[number]]: string },
    B extends TSchema = TSchema,
    Q extends TSchema = TSchema
  >(
    method: HttpMethod,
    path: T,
    handler: RouteHandler<T, P, Static<B>, Static<Q>>,
    schemas?: RouteSchema<TSchema, B, Q>
  ) {
    if (!method || !path || typeof handler !== 'function') {
      throw new Error('Invalid route definition')
    }
    this.routes.push({ path, method, handler, schemas })
    return this
  }

  public get<T extends string, P extends TSchema = TSchema, B extends TSchema = TSchema, Q extends TSchema = TSchema>(
    path: T,
    handler: RouteHandler<T, ParamsObject<ExtractParams<T>>, Static<B>, Static<Q>>,
    schemas?: {
      params?: P
      body?: B
      query?: Q
      middleware?: RequestHandler
      detail?: SwaggerDetail
    }
  ) {
    return this.addRoute(HttpMethod.GET, path, handler, schemas)
  }

  public post<T extends string, P extends TSchema = TSchema, B extends TSchema = TSchema, Q extends TSchema = TSchema>(
    path: T,
    handler: RouteHandler<T, ParamsObject<ExtractParams<T>>, Static<B>, Static<Q>>,
    schemas?: RouteSchema<P, B, Q>
  ) {
    return this.addRoute(HttpMethod.POST, path, handler, schemas)
  }

  public put<T extends string, P extends TSchema = TSchema, B extends TSchema = TSchema, Q extends TSchema = TSchema>(
    path: T,
    handler: RouteHandler<T, ParamsObject<ExtractParams<T>>, Static<B>, Static<Q>>,
    schemas?: RouteSchema<P, B, Q>
  ) {
    return this.addRoute(HttpMethod.PUT, path, handler, schemas)
  }

  public patch<T extends string, P extends TSchema = TSchema, B extends TSchema = TSchema, Q extends TSchema = TSchema>(
    path: T,
    handler: RouteHandler<T, ParamsObject<ExtractParams<T>>, Static<B>, Static<Q>>,
    schemas?: RouteSchema<P, B, Q>
  ) {
    return this.addRoute(HttpMethod.PATCH, path, handler, schemas)
  }

  public delete<
    T extends string,
    P extends TSchema = TSchema,
    B extends TSchema = TSchema,
    Q extends TSchema = TSchema
  >(
    path: T,
    handler: RouteHandler<T, ParamsObject<ExtractParams<T>>, Static<B>, Static<Q>>,
    schemas?: RouteSchema<P, B, Q>
  ) {
    return this.addRoute(HttpMethod.DELETE, path, handler, schemas)
  }
}

class AppRouter extends BaseRouter {
  constructor(private readonly instance: Router = Router()) {
    super()
  }
  public register() {
    this.routes.forEach((route) => {
      const { path, handler, schemas, method } = route
      const m = schemas?.middleware ? [schemas.middleware] : []
      const schemaObject = createParamsObject(path) as TSchema
      const schema = schemas ?? {}

      if (Object.keys(schemaObject.properties).length) {
        if (!schema?.params) {
          schema.params = schemaObject as TSchema
        }
      }

      this.instance.route(path)[method](...m, this.createHandler(handler, schema))
    })

    return this.instance
  }
}

class AppServer extends BaseRouter {
  private readonly app: Express = express()

  constructor(before?: () => void) {
    super()

    before?.()
    this.app.use(express.json())
    this.app.use(express.urlencoded({ extended: true }))
    this.app.use(metricsMiddleware)
    this.app.use((req: Request, _res: Response, next: NextFunction) => {
      if (!req.headers[transaction]) {
        req.headers[transaction] = `default-${uuid()}`
      }
      next()
    })
  }

  public router(
    pathOrRouter: string | AppRouter,
    routerOrMiddleware?: AppRouter | RequestHandler[],
    ...middleware: RequestHandler[]
  ) {
    if (typeof pathOrRouter === 'string') {
      if (routerOrMiddleware instanceof AppRouter) {
        this.app.use(pathOrRouter, ...middleware, routerOrMiddleware.register())
      }
    } else if (pathOrRouter instanceof AppRouter) {
      if (routerOrMiddleware) {
        if (Array.isArray(routerOrMiddleware)) {
          this.app.use(...routerOrMiddleware, pathOrRouter.register())
        }
      } else {
        this.app.use(pathOrRouter.register())
      }
    } else {
      const router = pathOrRouter as AppRouter
      if (routerOrMiddleware) {
        if (Array.isArray(routerOrMiddleware)) {
          this.app.use(...routerOrMiddleware, router.register())
        }
      } else {
        this.app.use(router.register())
      }
    }

    return this
  }

  public use(...middleware: RequestHandler[]) {
    this.app.use(...middleware)
    return this
  }

  public listen(port: number | string, close?: () => Promise<void> | void) {
    this.app.use((req: Request, res: Response, _next: NextFunction) => {
      res.status(404).json({ message: 'Unknown URL', path: req.originalUrl })
    })
    this.app.use(globalErrorHandler)

    const server = http.createServer(this.app).listen(port, () => {
      console.log(`Server is running on port: ${port}`)
    })

    const connections = new Set<Socket>()

    server.on('connection', (connection) => {
      connections.add(connection)
      connection.on('close', () => {
        connections.delete(connection)
      })
    })

    const signals = ['SIGINT', 'SIGTERM']
    signals.forEach((signal) => {
      process.on(signal, () => {
        console.log(`Received ${signal}, shutting down gracefully...`)
        server.close(() => {
          console.log('Closed out remaining connections.')
          close?.()
          process.exit(0)
        })

        // If after 10 seconds the server hasn't finished, force shutdown
        setTimeout(() => {
          console.error('Forcing shutdown as server is taking too long to close.')
          connections.forEach((connection) => {
            connection.destroy()
          })
          close?.()
          process.exit(1)
        }, 10000)
      })
    })
  }
}

export { AppRouter, Type }
export default AppServer
