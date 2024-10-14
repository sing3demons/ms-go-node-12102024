import mongoose from 'mongoose'
import config from './config'
import log from './logger/logger'

async function connect() {
  const uri = config.get('mongoUri')
  try {
    await mongoose.connect(uri)
    log.info('Connected to database')
  } catch (error) {
    log.error('Error connecting to database', error)
    process.exit(1)
  }
}

export default connect
