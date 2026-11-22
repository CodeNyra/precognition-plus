import { digitCount, param } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const min_digits: RuleValidator = digitCount((length, rule) => length >= param(rule))
