import config from './config'
import app from './server'
import logger from './logger/logger'
import connect from './db'
import os, { hostname } from 'os'

const port = config.get('port')

export const StartServer = async () => {
  await connect()

  const cpus = new Set(os.cpus().map((cpu) => cpu.model))

  const opt = {
    app_name: config.get('app_name'),
    port: port,
    hostname: hostname(),
    platform: os.platform(),
    arch: os.arch(),
    cpus: Array.from(cpus).join(', '),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    uptime: os.uptime(),
    environment: process.env.NODE_ENV,
    pid: process.pid,
  }

  const server = app.listen(port, () => {
    logger.info(opt, `Server is running on port ${port}`)
  })

  process.on('unhandledRejection', (reason, promise) => {
    logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`)
  })

  process.on('uncaughtException', async (error) => {
    logger.error(`Uncaught Exception thrown: ${error}`)
    process.exit(1)
  })

  process.on('SIGINT', async () => {
    logger.info('Received SIGINT. Shutting down')
    server.close()
    process.exit(0)
  })

  process.on('SIGTERM', async () => {
    logger.info('Received SIGTERM. Shutting down')
    server.close()
    process.exit(0)
  })
}

StartServer()
