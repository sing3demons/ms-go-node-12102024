import os from 'os'
import packageInfo from '../../package.json'
import type { Request, Response } from 'express'
import logStream from '../writer'
const endOfLine = os.EOL

interface InputOutputLog {
  Invoke: string
  Event: string
  Protocol?: string
  Type: string
  RawData?: any
  Data: any
  ResTime?: string
}

interface DetailLogConfig {
  detail: {
    rawData: boolean
    logFile: boolean
    logConsole: boolean
  }
  projectName: string
}

export default class DetailLog {
  private LogType: string
  private Host: string
  private AppName: string
  private Instance: string | undefined
  private Session: string
  private InitInvoke: string
  private Scenario: string
  private Identity: string
  private InputTimeStamp: string | null
  private Input: InputOutputLog[]
  private OutputTimeStamp: string | null
  private Output: InputOutputLog[]
  private ProcessingTime: string | null

  conf: DetailLogConfig
  private startTimeDate: Date | null
  private inputTime: Date | null
  private outputTime: Date | null
  private timeCounter: { [key: string]: Date }

  constructor(private readonly req: Request, private readonly res: Response, initInvoke: string, scenario: string, identity: string) {
    const conf: DetailLogConfig = {
      detail: {
        rawData: true,
        logFile: process.env.LOG_FILE === 'true',
        logConsole: true,
      },
      projectName: packageInfo.name,
    }
    this.LogType = 'Detail'
    this.Host = os.hostname()
    this.AppName = conf.projectName
    this.Instance = process.env.pm_id
    this.Session = req['session'] || 'unknown_' + Math.random().toString(36).substring(7)
    this.InitInvoke = initInvoke
    this.Scenario = scenario
    this.Identity = identity
    this.InputTimeStamp = null
    this.Input = []
    this.OutputTimeStamp = null
    this.Output = []
    this.ProcessingTime = null

    this.conf = conf
    this.startTimeDate = new Date()
    this.inputTime = null
    this.outputTime = null
    this.timeCounter = {}

    const originalJson = this.res.json
    // Wrap res.json()
    this.res.json = (body: any) => {
      if (this.startTimeDate) {
        this.end()
      }
      return originalJson.call(res, body)
    }
  }

  isRawDataEnabled(): boolean {
    return this.conf.detail.rawData
  }

  addInputRequest(node: string, cmd: string, invoke: string, rawData: any, data: any, protocol?: string, protocolMethod?: string): void {
    this.addInput(node, cmd, invoke, 'req', rawData, data, undefined, protocol, protocolMethod)
  }

  addInputRequestTimeout(node: string, cmd: string, invoke: string): void {
    this.addInput(node, cmd, invoke, 'req_timeout')
  }

  addInputResponse(node: string, cmd: string, invoke: string, rawData: any, data: any, resTime: number): void {
    this.addInput(node, cmd, invoke, 'res', rawData, data, resTime)
  }

  addInputResponseError(node: string, cmd: string, invoke: string): void {
    this.addInput(node, cmd, invoke, 'res_error')
  }

  addInput(node: string, cmd: string, invoke: string, type: string, rawData?: any, data?: any, resTime?: number, protocol?: string, protocolMethod?: string): void {
    this.inputTime = new Date()

    // Case where end() is called and then new input/output is added
    if (!this.startTimeDate) {
      this.startTimeDate = this.inputTime
    }

    let resTimeString: string | undefined
    if (typeof resTime === 'number') {
      resTimeString = resTime + ' ms'
      delete this.timeCounter[invoke]
    } else if (type.startsWith('res') && this.timeCounter[invoke]) {
      resTimeString = this.inputTime.getTime() - this.timeCounter[invoke].getTime() + ' ms'
      delete this.timeCounter[invoke]
    }

    const input: InputOutputLog = {
      Invoke: invoke,
      Event: node + '.' + cmd,
      Protocol: type === 'req' ? this._buildValueProtocol(protocol || this.req.protocol, protocolMethod || this.req.method) : undefined,
      Type: type,
      RawData: this.conf.detail.rawData === true ? rawData : undefined,
      Data: data,
      ResTime: resTimeString,
    }
    this.Input.push(input)
  }

  addOutputRequest(node: string, cmd: string, invoke: string, rawData: any, data: any, protocol?: string, protocolMethod?: string): void {
    this.addOutput(node, cmd, invoke, 'req', rawData, data, protocol, protocolMethod)
  }

  addOutputResponse(node: string, cmd: string, invoke: string, rawData: any, data: any): void {
    this.addOutput(node, cmd, invoke, 'res', rawData, data)
  }

  addOutputRequestRetry(node: string, cmd: string, invoke: string, rawData: any, data: any, total: number, maxCount: number): void {
    this.addOutput(node, cmd, invoke, `req_retry_${total}/${maxCount}`, rawData, data)
  }

  addOutput(node: string, cmd: string, invoke: string, type: string, rawData: any, data: any, protocol?: string, protocolMethod?: string): void {
    this.outputTime = new Date()
    if (invoke && type !== 'res') {
      this.timeCounter[invoke] = this.outputTime
    }

    const output: InputOutputLog = {
      Invoke: invoke,
      Event: node + '.' + cmd,
      Protocol: type === 'req' ? this._buildValueProtocol(protocol || this.req.protocol, protocolMethod || this.req.method) : undefined,
      Type: type,
      RawData: this.conf.detail.rawData === true ? rawData : undefined,
      Data: data,
    }
    this.Output.push(output)
  }

  end(): void {
    if (this.startTimeDate === null) {
      throw new Error('end() called without any input/output')
    }
    this.ProcessingTime = new Date().getTime() - (this.startTimeDate?.getTime() || 0) + ' ms'
    this.InputTimeStamp = this.inputTime ? this.inputTime.toISOString() : null
    this.OutputTimeStamp = this.outputTime ? this.outputTime.toISOString() : null

    const logDetail = {
      LogType: this.LogType,
      Host: this.Host,
      AppName: this.AppName,
      Instance: this.Instance,
      Session: this.Session,
      InitInvoke: this.InitInvoke,
      Scenario: this.Scenario,
      Identity: this.Identity,
      InputTimeStamp: this.InputTimeStamp,
      Input: this.Input,
      OutputTimeStamp: this.OutputTimeStamp,
      Output: this.Output,
      ProcessingTime: this.ProcessingTime,
    }
    // console.log(JSON.stringify(this.logDetail, null, 2))
    // stdio output

    // Write to standard output

    if (this.conf.detail.logConsole) {
      process.stdout.write(JSON.stringify(logDetail) + endOfLine)
    }

    // Write to rotating file
    if (this.conf.detail.logFile) {
      //   writer(JSON.stringify(logDetail) + endOfLine)
      logStream?.write(JSON.stringify(logDetail) + endOfLine, 'utf8', (err) => {
        if (err) {
          console.error('Error writing to log stream:', err)
        }
      })
    }

    this._clr()
  }

  private _clr(): void {
    this.ProcessingTime = null
    this.InputTimeStamp = null
    this.OutputTimeStamp = null
    this.Input = []
    this.Output = []
    this.outputTime = null
    this.startTimeDate = null
  }

  private _buildValueProtocol(protocol?: string, protocolMethod?: string): string | undefined {
    let v = undefined
    if (protocol) {
      v = protocol.toLowerCase()
      if (protocolMethod) {
        v += '.' + protocolMethod.toLowerCase()
      }
    }
    return v
  }
}
