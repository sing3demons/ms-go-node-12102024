import { BaseResponse } from '../appRouter'

export class Response<T = unknown> {
  public data?: T
  public message: string
  public statusCode?: number
  public success: boolean

  constructor(message: string = 'success', success: boolean = true, data?: T) {
    this.data = data
    this.message = message
    this.success = success
  }

  setStatusCode(statusCode: number) {
    this.statusCode = statusCode
  }

  setSuccess(success: boolean) {
    this.success = success
  }

  setMessage(message: string) {
    this.message = message
  }

  setData(data: any) {
    this.data = data
  }

  async getResponse(): Promise<BaseResponse> {
    return {
      data: this.data,
      message: this.message,
      statusCode: this.statusCode,
      success: this.success,
    }
  }
}
