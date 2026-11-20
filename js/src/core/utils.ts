export type Data = Record<string, unknown>

const isObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

export const isFile = (value: unknown): value is Blob =>
  typeof Blob !== 'undefined' && value instanceof Blob

export const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  isObject(value) && !Array.isArray(value) && !isFile(value)

export function getPath(data: unknown, path: string): unknown {
  let current: unknown = data

  for (const segment of path.split('.')) {
    if (!isObject(current) || !(segment in current)) {
      return undefined
    }
    current = current[segment]
  }

  return current
}

export function toPhpString(value: unknown): string {
  if (value === true) return '1'
  if (value === false || value === null || value === undefined) return ''
  return String(value)
}

export function isNumeric(value: unknown): boolean {
  if (typeof value === 'number') return Number.isFinite(value)
  return typeof value === 'string' && /^\s*[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?\s*$/.test(value)
}

export function phpStringEquals(a: string, b: string): boolean {
  return isNumeric(a) && isNumeric(b) ? Number(a) === Number(b) : a === b
}

const UNTRIMMED = new Set(['current_password', 'password', 'password_confirmation'])

// What TrimStrings (Str::trim) removes from both ends of a string, the same in every Laravel
// release from 12.53: whitespace, NUL, U+0085 and Str::INVISIBLE_CHARACTERS, such as the
// zero-width space, the byte order mark and the soft hyphen.
const TRIMMED =
  '\\0\\t-\\r \\u0085\\u00A0\\u00AD\\u034F\\u061C\\u115F\\u1160\\u1680\\u17B4\\u17B5\\u180E\\u2000-\\u200F\\u2028\\u2029\\u202F\\u205F-\\u2065\\u206A-\\u206F\\u2800\\u3000\\u3164\\uFEFF\\uFFA0\\u{1D159}\\u{1D173}-\\u{1D17A}\\u{E0020}'
const TRIM = new RegExp(`^[${TRIMMED}]+|[${TRIMMED}]+$`, 'gu')

// TrimStrings and ConvertEmptyStringsToNull, which also clean the strings inside arrays.
export function normalize(value: unknown, attribute: string): unknown {
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${attribute}.${index}`))
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, `${attribute}.${key}`)]))
  }
  if (typeof value !== 'string') return value
  const trimmed = UNTRIMMED.has(attribute) ? value : value.replace(TRIM, '')
  return trimmed === '' ? null : trimmed
}
