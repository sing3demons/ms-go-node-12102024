import mongoose, { FilterQuery } from 'mongoose'
import UserModel, { UserDocument } from '../models/user.model'
import DetailLog from '../logger/loggerEntry'
import { LoginInput, UserInput, UserResponse } from '../schema/user.schema'
import Bcrypt from '../utils/argon'
import SessionModel from '../models/session.model'
import { signJwt, verifyJwt } from '../utils/jwt'
import { Request } from 'express'
import UserAgentModel from '../models/device.model'

class UserService {
  constructor(private readonly bcrypt: Bcrypt) {}
  async createUser(user: UserInput, logger: DetailLog): Promise<UserResponse> {
    const cmd = 'mongo.user.service.create'
    logger.addEventWithMark(`${cmd}.input`, user)
    try {
      const data = await UserModel.create({
        email: user.email,
        name: user.name,
        password: user.password,
      })
      logger.addEventWithMark(`${cmd}.output`, data)
      return {
        id: String(data._id),
        href: `/users/${data._id}`,
        email: data.email,
        name: data.name,
      }
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()
      throw error
    }
  }

  async getUser(query: FilterQuery<UserDocument>, logger: DetailLog): Promise<UserResponse | null> {
    const cmd = 'mongo.user.service.get'
    logger.addEventWithMark(`${cmd}.input`, query)
    try {
      const data = await UserModel.findOne(query).lean()
      if (!data) {
        logger.addEvent(`${cmd}.error`, { error: 'User not found' })
        return null
      }

      logger.addEventWithMark(`${cmd}.output`, data)
      return {
        id: data._id as string,
        href: `/users/${data._id}`,
        email: data.email,
        name: data.name,
      }
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()
      throw error
    }
  }

  public async login(payload: LoginInput, logger: DetailLog): Promise<{ access_token: string; refresh_token: string } | null> {
    const cmd = 'mongo.user.service.login'
    logger.addEventWithMark(`${cmd}.input`, payload)
    try {
      const user = await UserModel.findOne({ email: payload.email }).lean()
      if (!user) {
        logger.addEvent(`${cmd}.error`, { error: 'User not found' })
        return null
      }

      const isMatch = await this.bcrypt.verifyPassword(user.password, payload.password)
      if (!isMatch) {
        logger.addEvent(`${cmd}.error`, { error: 'Invalid password' })
        return null
      }
      logger.addEventWithMark(`${cmd}.output`, user)

      const access_token = signJwt({ email: user.email }, 'privateKey', { expiresIn: '10m' })
      const refresh_token = signJwt({ email: user.email }, 'refreshPrivateKey', { expiresIn: '1d' })

      const options = { upsert: true, new: true }
      const condition = { email: { $eq: payload.email } }

      await Promise.all([
        UserAgentModel.create({
          userAgent: payload.userAgent,
          user: user._id,
        }),
        SessionModel.findOneAndUpdate(
          condition,
          {
            email: payload.email,
            refreshToken: refresh_token,
            accessToken: access_token,
            userAgent: payload.userAgent,
            user: user._id,
            createdBy: user.name,
          },
          options
        ).lean(),
      ])

      return { access_token, refresh_token }
    } catch (error) {
      logger.addEvent(`${cmd}.error`, { error }).end()

      throw error
    }
  }

  public async verifyToken(payload: { access_token: string }, logger: DetailLog) {
    const cmd = 'mongo.user.service.verifyToken'
    logger.addEventWithMark(`${cmd}.input`, payload)

    const verify = verifyJwt(payload.access_token, 'publicKey')
    if (verify.err) {
      logger.addEvent(`${cmd}.error`, verify)
      return {
        err: true,
        decoded: null,
        message: verify.message,
      }
    }

    const session = await SessionModel.findOne({ accessToken: { $eq: payload.access_token } }).lean()
    if (!session) {
      logger.addEvent(`${cmd}.error`, { error: 'Invalid token' })
      return {
        err: true,
        decoded: null,
        message: 'Invalid token',
      }
    }

    logger.addEventWithMark(`${cmd}.output`, session)

    return {
      err: false,
      message: 'success',
      decoded: verify.decoded,
    }
  }
}

export default UserService
