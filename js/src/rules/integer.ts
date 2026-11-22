import { plainText } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// Like filter_var(FILTER_VALIDATE_INT), a 64-bit integer without leading zeros, optionally padded with whitespace.
export const integer: RuleValidator = (value) => {
  const match = /^[ \t\n\r\v]*([+-]?(?:0|[1-9]\d*))[ \t\n\r\v]*$/.exec(plainText(value))
  return match !== null && BigInt(match[1]) >= -(2n ** 63n) && BigInt(match[1]) < 2n ** 63n
}
