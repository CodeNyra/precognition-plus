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

// TrimStrings and ConvertEmptyStringsToNull, which also clean the strings inside arrays.
export function normalize(value: unknown, attribute: string): unknown {
  if (Array.isArray(value)) return value.map((item, index) => normalize(item, `${attribute}.${index}`))
  if (isPlainObject(value)) {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item, `${attribute}.${key}`)]))
  }
  if (typeof value !== 'string') return value
  const trimmed = UNTRIMMED.has(attribute) ? value : value.trim()
  return trimmed === '' ? null : trimmed
}
