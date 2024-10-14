import type { Request, Response } from 'express'
import packageInfo from '../../package.json'
import dayjs from 'dayjs'
import logger from './logger'

interface MaskingConfig {
  highlight?: string[]
  mark?: string[]
}

class DetailLog {
  name: string
  log_name: string = 'DETAIL'
  context: {
    trace_id: string
    span_id: string
  }
  session: string | null
  start_time: string
  end_time?: string
  attributes: Record<string, any>
  events: { name: string; timestamp: string; attributes?: Record<string, any> }[]
  response_time?: string

  constructor(req: Request, res: Response) {
    const traceId = req.trace_id || 'unknown-trace'
    const spanId = req.span_id || 'unknown-span'
    const startTime = dayjs().toISOString()
    const route = req.path
    const method = req.method
    const parentId = req.session || null
    this.name = packageInfo.name
    this.context = {
      trace_id: traceId,
      span_id: spanId,
    }
    this.session = parentId
    this.start_time = startTime
    this.attributes = {
      'http.route': route,
      'http.method': method,
      'http.device': req.headers['user-agent'],
    }

    this.events = []

    this.wrapResponseMethods(res)
  }

  addEvent(name: string, attributes?: Record<string, any>) {
    this.events.push({ name, timestamp: dayjs().toISOString(), attributes })
    return this
  }

  addEventWithMark(name: string, data?: Record<string, any>, fieldsToMask: MaskingConfig = { highlight: [], mark: ['password'] }) {
    if (!fieldsToMask.mark) {
      fieldsToMask.mark = ['password']
    }
    const attributes = this.maskSensitiveData(data, fieldsToMask)

    this.events.push({ name, timestamp: dayjs().toISOString(), attributes })
    return this
  }

  private maskSensitiveData(data: any, config: MaskingConfig): any {
    if (typeof data !== 'object' || data === null) {
      return data // Not an object, no need to mask
    }

    const maskedData: any = Array.isArray(data) ? [] : {}

    for (const key in data) {
      if (data.hasOwnProperty(key)) {
        // Check if the key is in 'mark' (full mask) or 'highlight' (partial mask)
        if (config?.mark?.includes(key)) {
          maskedData[key] = '******' // Fully mask fields in 'mark'
        } else if (config?.highlight?.includes(key)) {
          maskedData[key] = this.applyPartialMask(data[key]) // Partially mask fields in 'highlight'
        } else if (typeof data[key] === 'object') {
          // Recursively mask nested objects
          maskedData[key] = this.maskSensitiveData(data[key], config)
        } else {
          maskedData[key] = data[key]
        }
      }
    }

    return maskedData
  }

  // Partial mask for fields in 'highlight' (e.g., mask part of an email)
  private applyPartialMask(value: string): string {
    const rex = new RegExp(/^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)
    if (rex.test(value)) {
      let [first, second] = value.split('@')
      if (!first) {
        return ''
      }
      if (first.length > 2) {
        const mask = first.substring(3, first.length)
        const notMask = first.substring(0, 3)
        first = notMask + 'X'.repeat(mask.length)
      } else {
        first = first.replace(first.substring(1, first.length), 'X'.repeat(first.length - 1))
      }
      return `${first}@${second}`
    }

    return value.length > 2 ? value.substring(0, 2) + 'X'.repeat(value.length - 2) : value
  }
  setResponseTime(duration: string) {
    this.response_time = duration
  }

  end() {
    const endTime = dayjs().toISOString()
    this.end_time = endTime
    const start = new Date(this.start_time).getTime()
    const end = new Date(endTime).getTime()
    const duration = `${end - start}ms`
    this.setResponseTime(duration)
    // console.log(JSON.stringify(this, null, 2));
    logger.info(this)
    this.events = []
  }

  finish() {
    if (this.events.length > 0) {
      this.end()
    }
  }

  private wrapResponseMethods(res: Response) {
    // if (this.events.length > 0) {
    // Save original methods
    const originalJson = res.json
    const originalSend = res.send

    // Wrap res.json()
    res.json = (body: any) => {
      if (this.events.length > 0) {
        this.withEnd()
      }
      return originalJson.call(res, body)
    }

    // Wrap res.send()
    res.send = (body: any) => {
      if (this.events.length > 0) {
        this.withEnd()
      }

      return originalSend.call(res, body)
    }
  }

  private withEnd() {
    const endTime = new Date().toISOString()
    this.end_time = endTime
    const start = new Date(this.start_time).getTime()
    const end = new Date(endTime).getTime()
    const duration = `${end - start}ms`
    this.setResponseTime(duration)
    logger.info(this)
    this.events = []
  }
  // }
}

export default DetailLog
