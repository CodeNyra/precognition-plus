import { askServer, isAscii } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// Str::upper() relies on PHP's Unicode tables beyond ASCII, so only ASCII strings are checked here.
export const uppercase: RuleValidator = (value) =>
  typeof value === 'string' && isAscii(value) ? value.toUpperCase() === value : askServer()
