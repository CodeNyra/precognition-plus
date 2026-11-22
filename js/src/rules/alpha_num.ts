import { pattern } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const alpha_num: RuleValidator = pattern(/^[a-zA-Z0-9]+$/, true)
