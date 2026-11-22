import type { RuleContext, RuleValidator } from './types'
import { isNumeric, isPlainObject, phpText, trimEnds } from './utils'

// Checks call this when they can't decide. The engine sends the field to the server on any throw.
export const askServer = (): never => {
  throw new Error('Left to the server')
}

// Strings as they are, and numbers as PHP would write them (or the server decides). undefined otherwise.
export const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' ? value : typeof value === 'number' ? (phpText(value) ?? askServer()) : undefined

// Like textOf, for rules that only take text and whole numbers. Anything else goes to the server.
export const plainText = (value: unknown): string => textOf(value) ?? askServer()

// PHP's trim(), which only strips spaces, tabs, newlines, NUL and \v.
export const phpTrim = (text: string) => trimEnds(text, /^[ \t\n\r\0\v]$/)

export const param = (rule: { params: string[] }, index = 0) => Number(rule.params[index])

// An exact decimal, compared the way brick/math does, kept as its digits and its decimal places.
type Decimal = { digits: bigint; scale: number }

// Parses a plain decimal like 12, -0.5, 1. or .5. Anything else goes to the server.
function decimal(text: string): Decimal {
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text)
  const fraction = match?.[3] ?? ''
  if (!match || match[2] + fraction === '') return askServer()
  return { digits: BigInt(match[2] + fraction) * (match[1] === '-' ? -1n : 1n), scale: fraction.length }
}

function compare(a: Decimal, b: Decimal): number {
  const scale = Math.max(a.scale, b.scale)
  const x = a.digits * 10n ** BigInt(scale - a.scale)
  const y = b.digits * 10n ** BigInt(scale - b.scale)
  return x === y ? 0 : x < y ? -1 : 1
}

// Like Laravel's getSize(), the item count for a list, the length for text, or the value in a numeric field.
function sizeOf(value: unknown, context: RuleContext): Decimal {
  if (Array.isArray(value)) return { digits: BigInt(value.length), scale: 0 }
  if (isPlainObject(value)) return { digits: BigInt(Object.keys(value).length), scale: 0 }
  const text = plainText(value)
  if (context.field.type === 'numeric' && isNumeric(text)) {
    // Laravel puts numbers with an exponent through a range check that apps can configure.
    return /[eE]/.test(text) ? askServer() : decimal(phpTrim(text))
  }
  return { digits: BigInt([...text].length), scale: 0 }
}

export function sizeComparedTo(value: unknown, param: string, context: RuleContext): number {
  return compare(sizeOf(value, context), decimal(param))
}

// Up to 12.66 and 13.25, in compares loosely ('01' matches '1'), so a value that only matches loosely goes to the server.
export function isIn(value: unknown, options: string[]): boolean {
  const text = plainText(value)
  if (options.includes(text)) return true
  if (!isNumeric(text)) return false
  const number = Number(text)
  return options.some((option) => isNumeric(option) && Number(option) === number) ? askServer() : false
}

// PHP matches bytes, its . matches \r and its $ matches before a final newline, so only plain ASCII
// without those runs here. Text over 255 characters goes to the server too, since a slow pattern
// can take JavaScript seconds on it.
export function pcreMatches(text: string, pattern: string, flags: string): boolean {
  if (text.length > 255 || !isAscii(text) || /\r|\n$/.test(text)) return askServer()
  return new RegExp(pattern, flags).test(text)
}

export const isAscii = (text: string) => /^[\x00-\x7F]*$/.test(text)

// Without :ascii, PHP's Unicode tables decide what counts as a letter, so only ASCII text is checked here.
export const pattern =
  (letters: RegExp, readsNumbers: boolean): RuleValidator =>
  (value, rule) => {
    const text = readsNumbers ? textOf(value) : typeof value === 'string' ? value : undefined
    if (text === undefined) return false
    return rule.params[0] === 'ascii' || isAscii(text) ? letters.test(text) : askServer()
  }

// Laravel releases disagree on values that aren't strings, so only strings are checked here.
export const affix =
  (matches: (text: string, needle: string) => boolean, negated: boolean): RuleValidator =>
  (value, rule) =>
    typeof value === 'string' ? rule.params.some((needle) => needle !== '' && matches(value, needle)) !== negated : askServer()

// The number of digits, or NaN if the text holds anything besides 0-9.
const digitLength = (text: string) => (/^[0-9]*$/.test(text) ? text.length : NaN)

export const digitCount =
  (fits: (length: number, rule: { params: string[] }) => boolean): RuleValidator =>
  (value, rule) =>
    fits(digitLength(plainText(value)), rule)
