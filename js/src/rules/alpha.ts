import { pattern } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const alpha: RuleValidator = pattern(/^[a-zA-Z]+$/, false)
