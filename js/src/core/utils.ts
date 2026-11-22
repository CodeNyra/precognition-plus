export type Data = Record<string, unknown>

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

export const isFile = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob

// An object made by {} or Object.create(null), which JSON writes as its own keys.
export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && [Object.prototype, null].includes(Object.getPrototypeOf(value))

// Whether the value holds a file or FormData anywhere. laravel-precognition sends those as multipart.
export const hasFile = (value: unknown): boolean =>
  isFile(value) || (typeof FormData !== 'undefined' && value instanceof FormData) || (isObject(value) && Object.values(value).some(hasFile))

// The total length of the text in a value, counting what's inside arrays and objects.
export const textLength = (value: unknown): number =>
  typeof value === 'string'
    ? value.length
    : isObject(value) && !isFile(value)
      ? Object.values(value).reduce((sum: number, item) => sum + textLength(item), 0)
      : 0

// Own keys only, so inherited names like constructor read as missing.
export const hasOwn = (object: object, key: string): boolean => Object.prototype.hasOwnProperty.call(object, key)

// The value at a dot path, following only array indexes and an object's own enumerable keys.
export function findPath(data: unknown, path: string): { value: unknown } | undefined {
  let current: unknown = data

  for (const segment of path.split('.')) {
    const sent = Array.isArray(current)
      ? /^(0|[1-9]\d*)$/.test(segment) && Number(segment) < current.length
      : isObject(current) && Object.prototype.propertyIsEnumerable.call(current, segment)
    if (!sent) return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return { value: current }
}

export const getPath = (data: unknown, path: string): unknown => findPath(data, path)?.value

function toPhpString(value: unknown): string {
  if (value === true) return '1'
  if (value === false || value === null || value === undefined) return ''
  return String(value)
}

// PHP's is_numeric(), which allows spaces, tabs, newlines, \v and \f around the number.
export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && /^[ \t\n\r\v\f]*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?[ \t\n\r\v\f]*$/.test(value)
}

// What PHP's (string) cast gives for the value, or undefined for a fraction or a number beyond
// 64 bits, which PHP formats with its own precision.
export function phpText(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  if (typeof value === 'boolean' || value === null || value === undefined) return toPhpString(value)
  return Number.isInteger(value) && (value as number) > -(2 ** 63) && (value as number) < 2 ** 63 ? String(value) : undefined
}

const UNTRIMMED = new Set(['current_password', 'password', 'password_confirmation'])

// What TrimStrings (Str::trim) strips from both ends. That's whitespace, NUL, U+0085 and Str::INVISIBLE_CHARACTERS.
const TRIMMED =
  '\\0\\t-\\r \\u0085\\u00A0\\u00AD\\u034F\\u061C\\u115F\\u1160\\u1680\\u17B4\\u17B5\\u180E\\u2000-\\u200F\\u2028\\u2029\\u202F\\u205F-\\u2065\\u206A-\\u206F\\u2800\\u3000\\u3164\\uFEFF\\uFFA0\\u{1D159}\\u{1D173}-\\u{1D17A}\\u{E0020}'
const TRIMS = new RegExp(`^[${TRIMMED}]$`, 'u')

// Trims one character at a time, since a regex anchored at the end takes quadratic time on long text.
export function trimEnds(text: string, trims: RegExp): string {
  const chars = Array.from(text)
  let start = 0
  let end = chars.length
  while (start < end && trims.test(chars[start])) start++
  while (end > start && trims.test(chars[end - 1])) end--
  return chars.slice(start, end).join('')
}

// Applies TrimStrings and ConvertEmptyStringsToNull, inside arrays too. JSON turns NaN and Infinity into null.
export function normalize(value: unknown, attribute: string): unknown {
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${attribute}.${index}`))
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, `${attribute}.${key}`)]))
  }
  if (typeof value === 'number' && !Number.isFinite(value)) return null
  if (typeof value !== 'string') return value
  const trimmed = UNTRIMMED.has(attribute) ? value : trimEnds(value, TRIMS)
  return trimmed === '' ? null : trimmed
}
