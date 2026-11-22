import { sizeComparedTo } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const between: RuleValidator = (value, rule, context) =>
  sizeComparedTo(value, rule.params[0], context) >= 0 && sizeComparedTo(value, rule.params[1], context) <= 0
