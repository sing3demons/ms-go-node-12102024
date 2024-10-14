import { readFileSync } from 'fs'
const packageJsonPath = require.resolve('../package.json')
const packageJsonContents = readFileSync(packageJsonPath).toString()
const packageJson = JSON.parse(packageJsonContents)
import dotenv from 'dotenv'
dotenv.config()

interface IConfig {
  host: string
  port: number
  timeout: number
  level: string
  app_name: string
  logFile: boolean
  privateKey: string
  publicKey: string
  refreshPrivateKey: string
  refreshPublicKey: string
  mongoUri: string
}
class Config {
  private config: IConfig
  constructor() {
    const config = {
      host: process.env.HOST || 'localhost',
      port: parseInt(process.env.PORT || '3000'),
      timeout: parseInt(process.env.TIMEOUT || '5000'),
      level: process.env.LOG_LEVEL || 'info',
      app_name: process.env.APP_NAME || packageJson.name,
      logFile: process.env.LOG_FILE === 'true',
      privateKey: process.env.PRIVATE_KEY || 'private.key',
      publicKey: process.env.PUBLIC_KEY || 'public.key',
      refreshPrivateKey: process.env.REFRESH_PRIVATE_KEY || 'refresh_private.key',
      refreshPublicKey: process.env.REFRESH_PUBLIC_KEY || 'refresh_public.key',
      mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017',
    }
    this.config = config
  }

  get<K extends keyof IConfig>(key: K) {
    return this.config[key]
  }

  set<K extends keyof IConfig>(key: K, value: IConfig[K]) {
    this.config[key] = value
    return this
  }
}

const config = new Config()

export default config
