import mongoose from 'mongoose'
import { UserDocument } from './user.model'

export interface SessionDocument extends mongoose.Document {
  user: UserDocument['_id']
  valid: boolean
  userAgent: string
  createdAt: Date
  updatedAt: Date
}

const sessionSchema = new mongoose.Schema(
  {
    email: { type: 'string' },
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    userAgent: { type: 'string' },
    createdBy: { type: 'string' },
  },
  { timestamps: true, versionKey: false }
)

sessionSchema.index({ accessToken: 1 }, { unique: true })
sessionSchema.index({ email: 1 }, { unique: true })

const SessionModel = mongoose.model<SessionDocument>('session', sessionSchema)

export default SessionModel
