import { createLogger, format, transports } from 'winston'
import logger from 'pino'
import dayjs from 'dayjs'
// const log = createLogger({
//   format: format.combine(format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss', alias: '@timestamp' }), format.json()),
//   transports: [new transports.Console({ level: 'info', handleExceptions: true })],
//   exceptionHandlers: [],
//   exitOnError: false,
// })

const log = logger({
  base: {
    pid: true,
  },
  timestamp: () => `,"@timestamp":"${dayjs().format()}"`,
})
export default log
