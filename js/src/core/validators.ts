import type { RuleContext, RuleValidator, RuleValidators } from './types'
import { isFile, isNumeric, isPlainObject, phpStringEquals, toPhpString } from './utils'

const isStringy = (value: unknown): value is string | number =>
  typeof value === 'string' || (typeof value === 'number' && Number.isFinite(value))

function measure(value: unknown, context: RuleContext): number {
  if (context.field.type === 'numeric' && isNumeric(value)) return Number(value)
  if (Array.isArray(value)) return value.length
  if (isFile(value)) return value.size / 1024
  if (isPlainObject(value)) return Object.keys(value).length
  return [...toPhpString(value)].length
}

const param = (rule: { params: string[] }, index = 0) => Number(rule.params[index])

const required: RuleValidator = (value) =>
  !(
    value === null ||
    value === undefined ||
    (typeof value === 'string' && value.trim() === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  )

const integer: RuleValidator = (value) =>
  value === true ||
  (typeof value === 'number' && Number.isInteger(value)) ||
  (typeof value === 'string' && /^\s*[+-]?(0|[1-9]\d*)\s*$/.test(value))

export const validators: RuleValidators = {
  required,
  string: (value) => typeof value === 'string',
  numeric: (value) => isNumeric(value),
  integer,
  boolean: (value) => [true, false, 0, 1, '0', '1'].includes(value as never),
  min: (value, rule, context) => measure(value, context) >= param(rule),
  max: (value, rule, context) => measure(value, context) <= param(rule),
  between: (value, rule, context) => {
    const actual = measure(value, context)
    return actual >= param(rule, 0) && actual <= param(rule, 1)
  },
  email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value),
  regex: (value, rule) => isStringy(value) && new RegExp(rule.params[0], rule.params[1]).test(String(value)),
  in: (value, rule) => !Array.isArray(value) && rule.params.some((allowed) => phpStringEquals(toPhpString(value), allowed)),
  confirmed: (value, rule, context) => value === context.other(rule.params[0]),
}
