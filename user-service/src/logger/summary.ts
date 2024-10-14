import dayjs from 'dayjs'
import logger from './logger'

export interface Summary {
  log_time?: string
  hostname?: string
  appname?: string
  instance?: string
  log_name?: string
  intime: string
  out_time?: string
  diff_time?: number
  ssid?: string
  invoke?: string
  audit_log_id?: string
  mobile_no?: string
  input?: string
  output?: string
  status?: number
  result_code?: string
  command?: string
  menu_id?: string
  channel?: string
}

export function toSummaryLog(newSummaryLog: Summary): void {
  // Parse the intime
  const startDate = dayjs(newSummaryLog.intime)
  const endTime = dayjs()

  // Set fields as per logic
  newSummaryLog.log_name = 'SUMMARY'
  newSummaryLog.log_time = endTime.toISOString()
  newSummaryLog.out_time = endTime.toISOString()
  newSummaryLog.diff_time = endTime.diff(startDate, 'milliseconds')

  // Truncate 'input' and 'output' fields if they exceed 2000 characters
  if (newSummaryLog.input && newSummaryLog.input.length > 2000) {
    newSummaryLog.input = newSummaryLog.input.substring(0, 2000)
  }
  if (newSummaryLog.output && newSummaryLog.output.length > 2000) {
    newSummaryLog.output = newSummaryLog.output.substring(0, 2000)
  }

  newSummaryLog.output = newSummaryLog.output?.replace(/\\"/g, '').replace(/\\\\/g, '\\')

  // Log the summary using the logger library
  logger.info(newSummaryLog)
}
