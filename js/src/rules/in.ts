import { isIn } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const inRule: RuleValidator = (value, rule) => isIn(value, rule.params)
