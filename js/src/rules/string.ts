import type { RuleValidator } from '../core/types'

export const string: RuleValidator = (value) => typeof value === 'string'
