import { askServer, param, plainText } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'
import { isNumeric } from '../core/utils'

// Laravel's /^[+-]?\d*\.?(\d*)$/, rewritten so a long number can't take quadratic time. PHP's $ also
// matches before a final newline, so that case goes to the server.
export const decimal: RuleValidator = (value, rule) => {
  const text = plainText(value)
  if (text.endsWith('\n')) return askServer()
  const match = isNumeric(text) ? /^[+-]?\d*(?:\.(\d*))?$/.exec(text) : null
  if (match === null) return false
  const places = (match[1] ?? '').length
  return rule.params.length < 2 ? places === param(rule) : places >= param(rule, 0) && places <= param(rule, 1)
}
