import { affix } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const starts_with: RuleValidator = affix((text, needle) => text.startsWith(needle), false)
