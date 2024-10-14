import mongoose from 'mongoose'

const userAgentSchema = new mongoose.Schema(
  {
    user: { type: String, ref: 'User' },
    userAgent: { type: 'string' },
  },
  {
    timestamps: {
      createdAt: 'created_at',
      updatedAt: false,
    },
    versionKey: false,
  }
)

const UserAgentModel = mongoose.model('device', userAgentSchema)
export default UserAgentModel
