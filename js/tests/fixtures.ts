import type { ClientRule, FieldSchema, ValidationSchema } from '../src/core/types'

export const field = (rules: Array<[string, string[]?, Partial<ClientRule>?]>, extra: Partial<FieldSchema> = {}): FieldSchema => ({
  rules: rules.map(([rule, params = [], more = {}]) => ({ rule, params, message: `${rule} failed`, ...more })),
  server: false,
  nullable: false,
  type: 'string',
  ...extra,
})

export const schema: ValidationSchema = {
  name: field([['required'], ['string'], ['max', ['10']]]),
  email: field([['required'], ['email']], { server: true }),
  password: field([['required'], ['min', ['8']], ['confirmed', ['password_confirmation']]]),
  age: field([['integer'], ['min', ['18']]], { nullable: true, type: 'numeric' }),
}
