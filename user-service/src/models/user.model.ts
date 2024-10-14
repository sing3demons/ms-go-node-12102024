import mongoose from 'mongoose'
import Bcrypt from '../utils/argon'
import { UserInput } from '../schema/user.schema'
const bcrypt = new Bcrypt('UserModel')

export interface UserDocument extends UserInput, mongoose.Document {
  createdAt: Date
  updatedAt: Date
  comparePassword(candidatePassword: string): Promise<Boolean>
  deletedAt: { type: Date; default: null }
}

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    password: { type: String, required: true },
  },
  {
    timestamps: true,
    versionKey: false,
  }
)

userSchema.pre('save', async function (next) {
  let user = this as UserDocument

  if (!user.isModified('password')) {
    return next()
  }

  user.password = await bcrypt.hashPassword(user.password)

  return next()
})

userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  const user = this as UserDocument
  return bcrypt.verifyPassword(user.password, candidatePassword)
}

const UserModel = mongoose.model<UserDocument>('User', userSchema)

export default UserModel
