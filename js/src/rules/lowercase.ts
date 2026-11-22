import { askServer, isAscii } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// Str::lower() relies on PHP's Unicode tables beyond ASCII, so only ASCII strings are checked here.
export const lowercase: RuleValidator = (value) =>
  typeof value === 'string' && isAscii(value) ? value.toLowerCase() === value : askServer()
