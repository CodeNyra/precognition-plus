import { askServer } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// Compares like PHP's === for text and null. A missing confirmation reads as null too.
export const confirmed: RuleValidator = (value, rule, context) => {
  const other = context.other(rule.params[0]) ?? null
  const plain = (item: unknown) => typeof item === 'string' || item === null
  return plain(value) && plain(other) ? value === other : askServer()
}
