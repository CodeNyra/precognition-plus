import { pcreMatches, textOf } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

export const not_regex: RuleValidator = (value, rule) => {
  const text = textOf(value)
  return text !== undefined && !pcreMatches(text, rule.params[0], rule.params[1])
}
