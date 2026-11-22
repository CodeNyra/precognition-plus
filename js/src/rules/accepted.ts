import type { RuleValidator } from '../core/types'

export const accepted: RuleValidator = (value) => ['yes', 'on', '1', 1, true, 'true'].includes(value as never)
