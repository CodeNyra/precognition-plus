import type { RuleValidator } from '../core/types'

export const uuid: RuleValidator = (value) =>
  typeof value === 'string' && /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/.test(value)
