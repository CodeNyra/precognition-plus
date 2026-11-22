import { phpTrim } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'
import { isPlainObject } from '../core/utils'

export const required: RuleValidator = (value) =>
  !(
    value === null ||
    value === undefined ||
    (typeof value === 'string' && phpTrim(value) === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  )
