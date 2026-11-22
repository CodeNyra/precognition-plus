import { sizeComparedTo } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const size: RuleValidator = (value, rule, context) => sizeComparedTo(value, rule.params[0], context) === 0
