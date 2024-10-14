import { object, string, TypeOf } from 'zod'

export const createUserSchema = object({
  name: string({
    required_error: 'Name is required',
  }),
  password: string({
    required_error: 'Password is required',
  }).min(6, 'Password too short - should be 6 chars minimum'),
  passwordConfirmation: string({
    required_error: 'passwordConfirmation is required',
  }),
  email: string({
    required_error: 'Email is required',
  }).email('Not a valid email'),
}).refine((data) => data.password === data.passwordConfirmation, {
  message: 'Passwords do not match',
  path: ['passwordConfirmation'],
})

export type CreateUserInput = Omit<TypeOf<typeof createUserSchema>, 'body.passwordConfirmation'>

export type UserResponse = {
  id: string
  href: string
  email: string
  name: string
}

export const userSchema = object({
  email: string(),
  name: string(),
  password: string(),
})

export const loginSchema = object({
  email: string(),
  password: string(),
})

export type LoginInput = TypeOf<typeof loginSchema> & { userAgent?: string }

export type UserInput = TypeOf<typeof userSchema>

export const verifyTokenSchema = object({
  access_token: string(),
})


export type verifyTokenInput = TypeOf<typeof verifyTokenSchema>