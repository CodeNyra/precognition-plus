import { affix } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const doesnt_end_with: RuleValidator = affix((text, needle) => text.endsWith(needle), true)
