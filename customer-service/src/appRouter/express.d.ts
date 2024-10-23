import * as express from 'express'

declare global {
  namespace Express {
    interface Request {
      trace_id?: string // Add your custom properties here
      span_id?: string
      session?: string | null
      user?: {
        email: string
        name: string
      }
    }
  }
}
