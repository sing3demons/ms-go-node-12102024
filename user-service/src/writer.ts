import fs from 'fs'
// rotating-file-stream
import { createStream, RotatingFileStream } from 'rotating-file-stream'
import packageInfo from '../package.json'

const logDir = './log/detail'

// Ensure that the /log/detail directory exists
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true })
}

// Function to generate log file name based on appName and timestamp (pattern: appName_YYYYMMDD_HHmmss.log)
function getLogFileName(time: Date | number): string {
  const appName = packageInfo.name
  if (!time) {
    time = new Date()
  }

  // Ensure 'time' is a valid Date object
  if (time instanceof Date && !isNaN(time.getTime())) {
    const year = time.getFullYear()
    const month = `0${time.getMonth() + 1}`.slice(-2)
    const day = `0${time.getDate()}`.slice(-2)
    const hour = `0${time.getHours()}`.slice(-2)
    const minute = `0${time.getMinutes()}`.slice(-2)
    const second = `0${time.getSeconds()}`.slice(-2)

    return `${appName}_${year}${month}${day}_${hour}${minute}${second}.log`
  }

  // Fallback in case time is not valid
  return `${appName}.log`
}

// Create a rotating write stream for logs
const logStream: RotatingFileStream | null =
  process.env.LOG_FILE === 'true'
    ? createStream(getLogFileName, {
        size: '10M',
        interval: '1d',
        compress: 'gzip',
        path: logDir,
      })
    : null

export default logStream
