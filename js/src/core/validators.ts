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

// The engine sends a field to the server when one of its checks throws.
const askServer = (): never => {
  throw new Error('Left to the server')
}

// What PHP's (string) makes of the value Laravel receives, or undefined where the browser can't be
// sure: PHP writes fractions and large numbers its own way, and files and arrays aren't text.
function phpText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || value === null || value === undefined) return toPhpString(value)
  return Number.isSafeInteger(value) ? String(value) : undefined
}

// Laravel's in rule. With the array rule, each item of a list must match an option's text exactly.
// Any other value is compared loosely ('01' matches '1') up to Laravel 12.66 and 13.25 and exactly
// after, so a value that only a loose comparison matches is left to the server.
function isIn(value: unknown, options: string[], context: RuleContext): boolean {
  if (Array.isArray(value) || isPlainObject(value)) {
    const items = Object.values(value)
    if (context.field.type !== 'array' || items.some((item) => Array.isArray(item) || isPlainObject(item))) return false
    return items.every((item) => options.includes(phpText(item) ?? askServer()))
  }

  const text = phpText(value) ?? askServer()
  if (options.includes(text)) return true
  return options.some((option) => phpStringEquals(text, option)) ? askServer() : false
}

const pattern = (unicode: RegExp, ascii: RegExp, accepts: (value: unknown) => boolean): RuleValidator => (value, rule) =>
  accepts(value) && (rule.params[0] === 'ascii' ? ascii : unicode).test(String(value))

// starts_with and its kind changed twice inside the supported releases. Up to Laravel 13.3 they
// read any value as text, and null as none. 13.4 to 13.9 fail everything but strings, and 13.10 on
// everything but strings and numbers. For anything but a string, the browser only answers a
// failure they all give.
const affix =
  (matches: (text: string, needle: string) => boolean, negated: boolean): RuleValidator =>
  (value, rule) => {
    const answer = (text: string) => rule.params.some((needle) => needle !== '' && matches(text, needle)) !== negated
    if (typeof value === 'string') return answer(value)
    if (value === null && !negated) return false
    const text = typeof value === 'boolean' || Number.isSafeInteger(value) ? toPhpString(value) : undefined
    return text !== undefined && !answer(text) ? false : askServer()
  }

// The length of text made of 0-9 only, or NaN.
const digitLength = (text: string) => (/^[0-9]*$/.test(text) ? text.length : NaN)

// min_digits, max_digits and digits_between read null and booleans as text ('', '1') up to Laravel
// 13.3 (13.5 for digits_between), and fail them after. For those the browser only answers a
// failure both give.
const digitCount =
  (fits: (length: number, rule: { params: string[] }) => boolean): RuleValidator =>
  (value, rule) => {
    if (typeof value === 'string' || Number.isSafeInteger(value)) return fits(digitLength(String(value)), rule)
    if (isFile(value)) return false
    if ((value === null || typeof value === 'boolean') && !fits(digitLength(toPhpString(value)), rule)) return false
    return askServer()
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
  digits: (value, rule) => {
    if (typeof value === 'string' || Number.isSafeInteger(value)) return digitLength(String(value)) === param(rule)
    return typeof value === 'number' ? askServer() : false
  },
  digits_between: digitCount((length, rule) => length >= param(rule, 0) && length <= param(rule, 1)),
  min_digits: digitCount((length, rule) => length >= param(rule)),
  max_digits: digitCount((length, rule) => length <= param(rule)),
  decimal: (value, rule) => {
    const places = isNumeric(value) ? /^[+-]?\d*\.?(\d*)$/.exec(toPhpString(value))?.[1].length : undefined
    if (places === undefined) return false
    return rule.params.length < 2 ? places === param(rule) : places >= param(rule, 0) && places <= param(rule, 1)
  },
  email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value),
  regex: (value, rule) => isStringy(value) && new RegExp(rule.params[0], rule.params[1]).test(String(value)),
  not_regex: (value, rule) => isStringy(value) && !new RegExp(rule.params[0], rule.params[1]).test(String(value)),
  in: (value, rule, context) => isIn(value, rule.params, context),
  not_in: (value, rule, context) => !isIn(value, rule.params, context),
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
  // A list makes Laravel throw an error up to 13.3, and fail after, so the server answers it.
  lowercase: (value) => (Array.isArray(value) || isPlainObject(value) ? askServer() : typeof value === 'string' && value.toLowerCase() === value),
  uppercase: (value) => (Array.isArray(value) || isPlainObject(value) ? askServer() : typeof value === 'string' && value.toUpperCase() === value),
  starts_with: affix((text, needle) => text.startsWith(needle), false),
  ends_with: affix((text, needle) => text.endsWith(needle), false),
  doesnt_start_with: affix((text, needle) => text.startsWith(needle), true),
  doesnt_end_with: affix((text, needle) => text.endsWith(needle), true),
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
