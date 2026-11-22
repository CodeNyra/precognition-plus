import type { RuleValidator } from '../core/types'

export const declined: RuleValidator = (value) => ['no', 'off', '0', 0, false, 'false'].includes(value as never)
