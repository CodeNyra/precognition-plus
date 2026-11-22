import { askServer, plainText } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// Rule::enum(), with the backing type as the first parameter. tryFrom() coerces values loosely, so
// an int-backed enum is only checked here for plain integers.
export const enumRule: RuleValidator = (value, rule) => {
  const [backing, ...cases] = rule.params
  const text = plainText(value)
  if (backing === 'int' && !/^(?:0|-?[1-9]\d{0,17})$/.test(text)) return askServer()
  return cases.includes(text)
}
