import { askServer } from './core/rule_helpers'
import type { RuleValidator, RuleValidators } from './core/types'
import { accepted } from './rules/accepted'
import { alpha } from './rules/alpha'
import { alpha_dash } from './rules/alpha_dash'
import { alpha_num } from './rules/alpha_num'
import { between } from './rules/between'
import { boolean } from './rules/boolean'
import { confirmed } from './rules/confirmed'
import { decimal } from './rules/decimal'
import { declined } from './rules/declined'
import { digits } from './rules/digits'
import { digits_between } from './rules/digits_between'
import { doesnt_end_with } from './rules/doesnt_end_with'
import { doesnt_start_with } from './rules/doesnt_start_with'
import { email } from './rules/email'
import { ends_with } from './rules/ends_with'
import { enumRule } from './rules/enum'
import { inRule } from './rules/in'
import { integer } from './rules/integer'
import { lowercase } from './rules/lowercase'
import { max } from './rules/max'
import { max_digits } from './rules/max_digits'
import { min } from './rules/min'
import { min_digits } from './rules/min_digits'
import { not_in } from './rules/not_in'
import { not_regex } from './rules/not_regex'
import { numeric } from './rules/numeric'
import { regex } from './rules/regex'
import { required } from './rules/required'
import { size } from './rules/size'
import { starts_with } from './rules/starts_with'
import { string } from './rules/string'
import { ulid } from './rules/ulid'
import { uppercase } from './rules/uppercase'
import { uuid } from './rules/uuid'

// The browser's checks by Laravel rule name. Keep in sync with php/src/BrowserRules.php.
export const browserRules: RuleValidators = {
  accepted,
  alpha,
  alpha_dash,
  alpha_num,
  between,
  boolean,
  confirmed,
  decimal,
  declined,
  digits,
  digits_between,
  doesnt_end_with,
  doesnt_start_with,
  email,
  ends_with,
  enum: enumRule,
  in: inRule,
  integer,
  lowercase,
  max,
  max_digits,
  min,
  min_digits,
  not_in,
  not_regex,
  numeric,
  regex,
  required,
  size,
  starts_with,
  string,
  ulid,
  uppercase,
  uuid,
}

// The built-in checks with the app's own over them, from setupPrecognitionPlus({ rules }). An app's
// check gets its own copy of the parameters, and an answer other than true or false leaves the
// field to the server. Object.fromEntries keeps any name, even __proto__, a plain entry.
export function withAppRules(rules: RuleValidators = {}): RuleValidators {
  const wrapped = Object.entries(rules).map(([name, check]): [string, RuleValidator] => [
    name,
    (value, rule, context) => {
      const passes: unknown = check(value, { ...rule, params: [...rule.params] }, context)
      return typeof passes === 'boolean' ? passes : askServer()
    },
  ])

  return Object.fromEntries([...Object.entries(browserRules), ...wrapped])
}
