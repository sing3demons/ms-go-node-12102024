import { AppRouter } from '../appRouter'
import UserController from '../controller/user.controller'
import DetailLog from '../logger/loggerEntry'
import { createUserSchema, loginSchema, verifyTokenSchema } from '../schema/user.schema'
import UserService from '../service/user.service'
import Bcrypt from '../utils/argon'

const bcrypt: Bcrypt = new Bcrypt('UserService')
const userService = new UserService(bcrypt)
const userController = new UserController(userService)

const router = new AppRouter()

router.post(
  '/register',
  async ({ req, res, body }) => {
    const logger = new DetailLog(req, res)
    const cmd = 'client.request'
    logger.addEventWithMark(`${cmd}.input`, { ...req.query, ...req.body, ...req.params })

    const data = await userController.createUser(body, logger)

    logger.addEventWithMark(`${cmd}.output`, data)
    return data
  },
  {
    body: createUserSchema,
  }
)

router.post(
  '/login',
  async ({ req, res, body }) => {
    const logger = new DetailLog(req, res)
    const cmd = 'client.request'
    logger.addEventWithMark(`${cmd}.input`, { ...req.query, ...req.body, ...req.params })

    const data = await userController.login(
      {
        email: body.email,
        password: body.password,
        userAgent: req.headers['user-agent'],
      },
      logger
    )

    logger.addEventWithMark(`${cmd}.output`, data, { mark: ['access_token', 'refresh_token'] })
    return data
  },
  {
    body: loginSchema,
  }
)

router.post(
  '/verify',
  async ({ req, res }) => {
    const logger = new DetailLog(req, res)
    const cmd = 'client.request'
    logger.addEventWithMark(`${cmd}.input`, { ...req.query, ...req.body, ...req.params })

    const data = await userController.verifyToken(req.body, logger)

    logger.addEventWithMark(`${cmd}.output`, data)
    return data
  },
  {
    body: verifyTokenSchema,
  }
)
export default router.register()
