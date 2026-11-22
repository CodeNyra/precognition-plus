import type { RuleValidator } from '../core/types'

export const boolean: RuleValidator = (value) => [true, false, 0, 1, '0', '1'].includes(value as never)
