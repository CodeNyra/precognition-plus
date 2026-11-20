import type { RuleContext, RuleValidator, RuleValidators } from './types'
import { isFile, isNumeric, isPlainObject, phpStringEquals, phpText } from './utils'

// The engine sends a field to the server when one of its checks throws.
const askServer = (): never => {
  throw new Error('Left to the server')
}

// The text of a string, or of a number PHP writes the same way, for the rules that read numbers as
// text. A number PHP could write differently goes to the server, and other values have no text.
const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? (phpText(value) ?? askServer()) : undefined

// PHP's trim(), which removes only spaces, tabs, line breaks, NUL and \v.
const phpTrim = (text: string) => text.replace(/^[ \t\n\r\0\v]+|[ \t\n\r\0\v]+$/g, '')

const param = (rule: { params: string[] }, index = 0) => Number(rule.params[index])

// An exact decimal, as brick/math compares them: its digits as a whole number, and how many of
// them come after the point.
type Decimal = { digits: bigint; scale: number }

// A plain decimal, like 12, -0.5, 1. or .5. Anything else is left to the server.
function decimal(text: string): Decimal {
  const match = /^([+-]?)(\d*)\.?(\d*)$/.exec(text)
  if (!match || match[2] + match[3] === '') return askServer()
  return { digits: BigInt(match[2] + match[3]) * (match[1] === '-' ? -1n : 1n), scale: match[3].length }
}

function compare(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale)
  const x = a.digits * 10n ** BigInt(scale - a.scale)
  const y = b.digits * 10n ** BigInt(scale - b.scale)
  return x === y ? 0 : x < y ? -1 : 1
}

// getSize(): the number itself in a numeric field, the items of a list, the kilobytes of a file,
// and the characters of anything else.
function sizeOf(value: unknown, context: RuleContext): Decimal {
  if (context.field.type === 'numeric' && isNumeric(value)) {
    const text = typeof value === 'number' ? (phpText(value) ?? askServer()) : phpTrim(value as string)
    // An exponent goes through a range check that apps can change.
    return /[eE]/.test(text) ? askServer() : decimal(text)
  }
  if (Array.isArray(value)) return { digits: BigInt(value.length), scale: 0 }
  if (isPlainObject(value)) return { digits: BigInt(Object.keys(value).length), scale: 0 }
  // Bytes / 1024 has at most 10 decimals: bytes * 5^10 / 10^10.
  if (isFile(value)) return { digits: BigInt(value.size) * 9765625n, scale: 10 }
  return { digits: BigInt([...(phpText(value) ?? askServer())].length), scale: 0 }
}

// How a value's size compares with a rule's parameter. PHP first writes the kilobytes of a file
// with 14 significant digits, which can't change a comparison with a whole number below 10 TB.
function sizeComparedTo(value: unknown, param: string, context: RuleContext): number {
  if (isFile(value) && (!/^-?\d+$/.test(param) || value.size >= 1e13)) return askServer()
  return compare(sizeOf(value, context), decimal(param))
}

const required: RuleValidator = (value) =>
  !(
    value === null ||
    value === undefined ||
    (typeof value === 'string' && phpTrim(value) === '') ||
    (Array.isArray(value) && value.length === 0) ||
    (isPlainObject(value) && Object.keys(value).length === 0)
  )

// filter_var(FILTER_VALIDATE_INT): a whole number within PHP's 64 bits, without leading zeros, with
// only spaces, tabs, line breaks and \v around it. PHP writes a fraction as text with its own
// precision before checking it, so a fraction goes to the server.
const integer: RuleValidator = (value) => {
  if (typeof value === 'boolean') return value
  if (typeof value === 'number') return Number.isInteger(value) ? phpText(value) !== undefined : askServer()
  const match = typeof value === 'string' ? /^[ \t\n\r\v]*([+-]?(?:0|[1-9]\d*))[ \t\n\r\v]*$/.exec(value) : null
  return match !== null && BigInt(match[1]) >= -(2n ** 63n) && BigInt(match[1]) < 2n ** 63n
}

// How PHP's weak typing reads numeric text as an integer: whole numbers within 64 bits as they are,
// anything else as a float cut to its whole part. Undefined where PHP throws a TypeError, for text
// that isn't numeric or a number beyond 64 bits.
function phpInt(text: string): string | undefined {
  if (!isNumeric(text)) return undefined
  const number = text.replace(/^[ \t\n\r\v\f]+|[ \t\n\r\v\f]+$/g, '')
  if (/^[+-]?\d+$/.test(number) && BigInt(number) >= -(2n ** 63n) && BigInt(number) < 2n ** 63n) return BigInt(number).toString()
  const float = Number(number)
  return float >= -(2 ** 63) && float < 2 ** 63 ? BigInt(Math.trunc(float)).toString() : undefined
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

// PHP's === on what JSON sends. Lists and objects arrive as PHP arrays, which are identical with the
// same keys and identical values in the same order, and a missing value reads as null. A file is a
// new object on the server, so the server answers.
function identical(a: unknown, b: unknown): boolean {
  if (isFile(a) || isFile(b)) return askServer()
  const entries = (value: unknown) =>
    Array.isArray(value) ? value.map((item, index) => [String(index), item] as const) : isPlainObject(value) ? Object.entries(value) : null
  const x = entries(a)
  const y = entries(b)
  if (x === null || y === null) return x === y && (a ?? null) === (b ?? null)
  return x.length === y.length && x.every(([key, item], index) => key === y[index][0] && identical(item, y[index][1]))
}

// A pattern the server converted for JavaScript, run only on text PHP reads the same way. PHP's $
// also matches before a final line break, and \r, U+2028 and U+2029 aren't line breaks to it.
// Without the u flag PHP matches bytes, and with u its caseless matching isn't JavaScript's, so
// text beyond ASCII goes to the server in both cases.
function pcreMatches(text: string, pattern: string, flags: string): boolean {
  if (/\n$|[\r\u2028\u2029]/.test(text)) return askServer()
  if ((!flags.includes('u') || flags.includes('i')) && /[^\x00-\x7F]/.test(text)) return askServer()
  return new RegExp(pattern, flags).test(text)
}

// alpha only reads strings, alpha_dash and alpha_num numbers too.
const pattern =
  (unicode: RegExp, ascii: RegExp, readsNumbers: boolean): RuleValidator =>
  (value, rule) => {
    const text = readsNumbers ? textOf(value) : typeof value === 'string' ? value : undefined
    return text !== undefined && (rule.params[0] === 'ascii' ? ascii : unicode).test(text)
  }

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
    const text = typeof value === 'boolean' || typeof value === 'number' ? phpText(value) : undefined
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
    if (typeof value === 'string' || typeof value === 'number') return fits(digitLength(textOf(value) ?? ''), rule)
    if (isFile(value)) return false
    if ((value === null || typeof value === 'boolean') && !fits(digitLength(phpText(value) ?? ''), rule)) return false
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
  min: (value, rule, context) => sizeComparedTo(value, rule.params[0], context) >= 0,
  max: (value, rule, context) => sizeComparedTo(value, rule.params[0], context) <= 0,
  between: (value, rule, context) =>
    sizeComparedTo(value, rule.params[0], context) >= 0 && sizeComparedTo(value, rule.params[1], context) <= 0,
  size: (value, rule, context) => sizeComparedTo(value, rule.params[0], context) === 0,
  digits: (value, rule) =>
    (typeof value === 'string' || typeof value === 'number') && digitLength(textOf(value) ?? '') === param(rule),
  digits_between: digitCount((length, rule) => length >= param(rule, 0) && length <= param(rule, 1)),
  min_digits: digitCount((length, rule) => length >= param(rule)),
  max_digits: digitCount((length, rule) => length <= param(rule)),
  // PHP's $ also matches before a final line break, which only a field that isn't trimmed can have.
  decimal: (value, rule) => {
    const places = isNumeric(value) ? /^[+-]?\d*\.?(\d*)\n?$/.exec(textOf(value) ?? '')?.[1].length : undefined
    if (places === undefined) return false
    return rule.params.length < 2 ? places === param(rule) : places >= param(rule, 0) && places <= param(rule, 1)
  },
  email: (value) => typeof value === 'string' && /^[^\s@]+@[^\s@]+$/.test(value),
  regex: (value, rule) => {
    const text = textOf(value)
    return text !== undefined && pcreMatches(text, rule.params[0], rule.params[1])
  },
  not_regex: (value, rule) => {
    const text = textOf(value)
    return text !== undefined && !pcreMatches(text, rule.params[0], rule.params[1])
  },
  in: (value, rule, context) => isIn(value, rule.params, context),
  not_in: (value, rule, context) => !isIn(value, rule.params, context),
  // Rule::enum(), whose first parameter says how the enum is backed. tryFrom() reads the value with
  // PHP's weak typing. Text must match a string-backed enum's value exactly, and an int-backed enum
  // reads numeric text as a number. Booleans and numbers become integers for both, so 1.9 matches
  // 1, and a number beyond 64 bits, which PHP writes its own way, goes to the server.
  enum: (value, rule) => {
    const [backing, ...cases] = rule.params
    if (typeof value === 'string') {
      const key = backing === 'int' ? phpInt(value) : value
      return key !== undefined && cases.includes(key)
    }
    if (typeof value === 'boolean') return cases.includes(value ? '1' : '0')
    if (typeof value === 'number') {
      const key = phpInt(String(value))
      return key !== undefined ? cases.includes(key) : backing === 'int' ? false : askServer()
    }
    return isFile(value) && backing !== 'int' ? askServer() : false
  },
  confirmed: (value, rule, context) => identical(value, context.other(rule.params[0])),
  alpha: pattern(/^[\p{L}\p{M}]+$/u, /^[a-zA-Z]+$/, false),
  alpha_dash: pattern(/^[\p{L}\p{M}\p{N}_-]+$/u, /^[a-zA-Z0-9_-]+$/, true),
  alpha_num: pattern(/^[\p{L}\p{M}\p{N}]+$/u, /^[a-zA-Z0-9]+$/, true),
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
