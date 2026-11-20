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

// Laravel's in rule. A list is checked item by item only when the field has the array rule. The
// server compares strings exactly, but `in` here also accepts numbers written another way ('01'
// for '1') and `not_in` only rejects an exact match, so the browser never rejects what the server
// would accept.
function isIn(value: unknown, allowed: string[], context: RuleContext, matches: (a: string, b: string) => boolean): boolean {
  const items = Array.isArray(value) ? value : isPlainObject(value) ? Object.values(value) : null

  if (items === null) return allowed.some((option) => matches(toPhpString(value), option))
  if (context.field.type !== 'array' || items.some((item) => Array.isArray(item) || isPlainObject(item))) return false

  return items.every((item) => allowed.some((option) => matches(toPhpString(item), option)))
}

const pattern = (unicode: RegExp, ascii: RegExp, accepts: (value: unknown) => boolean): RuleValidator => (value, rule) =>
  accepts(value) && (rule.params[0] === 'ascii' ? ascii : unicode).test(String(value))

// Laravel 12 also runs starts_with and the digit counts on true, false and null, read as PHP
// strings ('1', ''), so the browser does too, and never rejects what either version accepts.
const loosely = (value: unknown): string | null =>
  isStringy(value) || typeof value === 'boolean' || value === null ? toPhpString(value) : null

const affix =
  (matches: (text: string, needle: string) => boolean, expected: boolean): RuleValidator =>
  (value, rule) => {
    // For a file, Laravel 12 reads the path of its temporary copy on the server. Let the server answer.
    if (isFile(value)) throw new Error('Checked on the server')
    const text = loosely(value)
    return text !== null && rule.params.some((needle) => needle !== '' && matches(text, needle)) === expected
  }

// The length of a value made of 0-9 only.
function digitCount(text: string | null): number {
  return text !== null && /^[0-9]*$/.test(text) ? text.length : NaN
}

const PHP_EXTENSIONS = ['php', 'php3', 'php4', 'php5', 'php7', 'php8', 'phtml', 'phar']

// Like getClientOriginalExtension(), the part of the file name after its last dot. A Blob without
// a name is uploaded as "blob".
function extensionOf(file: Blob): string {
  const name = 'name' in file && typeof file.name === 'string' ? file.name : 'blob'
  const dot = name.lastIndexOf('.')
  return dot === -1 ? '' : name.slice(dot + 1).replace(/[A-Z]/g, (letter) => letter.toLowerCase())
}

export const validators: RuleValidators = {
  required,
  string: (value) => typeof value === 'string',
  numeric: (value) => isNumeric(value),
  integer,
  boolean: (value) => [true, false, 0, 1, '0', '1'].includes(value as never),
  accepted: (value) => ['yes', 'on', '1', 1, true, 'true'].includes(value as never),
  declined: (value) => ['no', 'off', '0', 0, false, 'false'].includes(value as never),
  min: (value, rule, context) => measure(value, context) >= param(rule),
  max: (value, rule, context) => measure(value, context) <= param(rule),
  between: (value, rule, context) => {
    const actual = measure(value, context)
    return actual >= param(rule, 0) && actual <= param(rule, 1)
  },
  size: (value, rule, context) => measure(value, context) === param(rule),
  digits: (value, rule) => digitCount(isStringy(value) ? String(value) : null) === param(rule),
  digits_between: (value, rule) => {
    const count = digitCount(loosely(value))
    return count >= param(rule, 0) && count <= param(rule, 1)
  },
  min_digits: (value, rule) => digitCount(loosely(value)) >= param(rule),
  max_digits: (value, rule) => digitCount(loosely(value)) <= param(rule),
  decimal: (value, rule) => {
    const places = isNumeric(value) ? /^[+-]?\d*\.?(\d*)$/.exec(toPhpString(value))?.[1].length : undefined
    if (places === undefined) return false
    return rule.params.length < 2 ? places === param(rule) : places >= param(rule, 0) && places <= param(rule, 1)
  },
  email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value),
  regex: (value, rule) => isStringy(value) && new RegExp(rule.params[0], rule.params[1]).test(String(value)),
  not_regex: (value, rule) => isStringy(value) && !new RegExp(rule.params[0], rule.params[1]).test(String(value)),
  in: (value, rule, context) => isIn(value, rule.params, context, phpStringEquals),
  not_in: (value, rule, context) => !isIn(value, rule.params, context, (a, b) => a === b),
  // Rule::enum(). tryFrom() turns numbers and booleans into integers first, and numeric strings
  // too for an int-backed enum, so 2.5 matches the value 2.
  enum: (value, rule) => {
    if (value === null || Array.isArray(value) || isPlainObject(value)) return false
    const number = typeof value === 'boolean' ? Number(value) : value
    return (
      rule.params.some((option) => phpStringEquals(toPhpString(value), option)) ||
      (isNumeric(number) && rule.params.includes(String(Math.trunc(Number(number)))))
    )
  },
  confirmed: (value, rule, context) => value === context.other(rule.params[0]),
  alpha: pattern(/^[\p{L}\p{M}]+$/u, /^[a-zA-Z]+$/, (value) => typeof value === 'string'),
  alpha_dash: pattern(/^[\p{L}\p{M}\p{N}_-]+$/u, /^[a-zA-Z0-9_-]+$/, isStringy),
  alpha_num: pattern(/^[\p{L}\p{M}\p{N}]+$/u, /^[a-zA-Z0-9]+$/, isStringy),
  lowercase: (value) => typeof value === 'string' && value.toLowerCase() === value,
  uppercase: (value) => typeof value === 'string' && value.toUpperCase() === value,
  starts_with: affix((text, needle) => text.startsWith(needle), true),
  ends_with: affix((text, needle) => text.endsWith(needle), true),
  doesnt_start_with: affix((text, needle) => text.startsWith(needle), false),
  doesnt_end_with: affix((text, needle) => text.endsWith(needle), false),
  uuid: (value) => typeof value === 'string' && /^[\da-fA-F]{8}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{4}-[\da-fA-F]{12}$/.test(value),
  ulid: (value) => typeof value === 'string' && /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/.test(value),
  file: (value) => isFile(value),
  extensions: (value, rule) => {
    if (!isFile(value)) return false
    const extension = extensionOf(value)
    if (!rule.params.includes('php') && PHP_EXTENSIONS.includes(extension.trim())) return false
    return rule.params.some((allowed) => phpStringEquals(extension, allowed))
  },
}
