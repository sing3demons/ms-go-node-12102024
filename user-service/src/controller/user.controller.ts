import { z } from 'zod'
import DetailLog from '../logger/loggerEntry'
import UserService from '../service/user.service'
import { createUserSchema, LoginInput } from '../schema/user.schema'
import { Response } from '../utils/response'

export default class UserController {
  constructor(private readonly userService: UserService) {}

  async createUser(body: z.infer<typeof createUserSchema>, logger: DetailLog) {
    const cmd = 'user.controller.create'
    const response = new Response()
    logger.addEventWithMark(`${cmd}.input`, body)
    try {
      const data = await this.userService.createUser(body, logger)
      logger.addEventWithMark(`${cmd}.output`, data)
      response.setData(data)
      return response
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()
      response.setMessage('error')
      response.setStatusCode(500)
      response.setSuccess(false)
      if (error instanceof Error) {
        response.setMessage(error.message)
        if (error.name === 'MongoServerError') {
          response.setStatusCode(400)
          response.setMessage(error.message.startsWith('E11000') ? 'User already exists' : error.message)
        }
      }
      return response
    }
  }

  async login(body: LoginInput, logger: DetailLog) {
    const cmd = 'user.controller.login'
    const response = new Response()
    logger.addEventWithMark(`${cmd}.input`, body)

    try {
      const data = await this.userService.login(body, logger)
      if (!data) {
        response.setMessage('User not found')
        response.setStatusCode(404)
        response.setSuccess(false)

        return response
      }
      logger.addEventWithMark(`${cmd}.output`, data, { mark: ['access_token', 'refresh_token'] })
      response.setData(data)

      return response
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()
      response.setMessage('error')
      response.setStatusCode(500)
      response.setSuccess(false)
      if (error instanceof Error) {
        response.setMessage(error.message)
        if (error.name === 'MongoServerError') {
          response.setStatusCode(400)
          response.setMessage(error.message.startsWith('E11000') ? 'User already exists' : error.message)
        }
      }
      return response
    }
  }

  async verifyToken(body: { access_token: string }, logger: DetailLog) {
    const cmd = 'user.controller.verifyToken'
    const response = new Response()
    logger.addEventWithMark(`${cmd}.input`, body)

    try {
      const data = await this.userService.verifyToken(body, logger)
      if (data.err) {
        response.setMessage(data.message)
        response.setStatusCode(401)
        response.setSuccess(false)
        return response
      }
      logger.addEventWithMark(`${cmd}.output`, data)

      return response
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()
      response.setMessage('error')
      response.setStatusCode(500)
      response.setSuccess(false)
      if (error instanceof Error) {
        response.setMessage(error.message)
        if (error.name === 'MongoServerError') {
          response.setStatusCode(400)
          response.setMessage(error.message.startsWith('E11000') ? 'User already exists' : error.message)
        }
      }
      return response
    }
  }
}
