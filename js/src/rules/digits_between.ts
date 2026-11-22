import { digitCount, param } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const digits_between: RuleValidator = digitCount((length, rule) => length >= param(rule, 0) && length <= param(rule, 1))
