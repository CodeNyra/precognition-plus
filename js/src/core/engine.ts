import { askServer } from './rule_helpers'
import type { FieldResult, RuleContext, RuleValidators, ValidationSchema } from './types'
import {
  type Data,
  getPath,
  hasFile,
  hasOwn,
  normalize,
  textLength,
  trimEnds,
} from './utils'

// Laravel runs these even when the field is empty or missing.
const IMPLICIT = new Set(['required', 'accepted', 'declined'])

// Values with more text than this, nested text included, go to the server to keep checks cheap.
const MAX_TEXT = 100_000

// PHP's default post_max_size. PHP drops bodies bigger than this.
const MAX_BODY = 8 * 1024 * 1024

type Received = { data: Data; query: boolean }

// The data as it arrives over JSON. A file, a BigInt or a body over 8 MB gives null, for the server.
export function received(data: Data, query = false): Received | null {
  try {
    if (hasFile(data)) return null
    const json = JSON.stringify(data)
    return json.length * 3 > MAX_BODY ? null : { data: JSON.parse(json) as Data, query }
  } catch {
    return null
  }
}

export function checkField(
  schema: ValidationSchema,
  validators: RuleValidators,
  attribute: string,
  data: Data,
  sent: Received | null = received(data),
): FieldResult {
  const field = hasOwn(schema, attribute) ? schema[attribute] : undefined
  const toServer = { message: null, server: true }

  if (!field || sent === null) {
    return toServer
  }

  // Laravel treats a backslash as part of the name, and takes a missing top-level field from the query string.
  const readable = (name: string) => !name.includes('\\') && (!sent.query || getPath(sent.data, name.split('.')[0]) !== undefined)

  if (!readable(attribute)) {
    return toServer
  }

  const raw = getPath(sent.data, attribute)

  if (textLength(raw) > MAX_TEXT) {
    return toServer
  }

  const value = normalize(raw, attribute)

  // With sometimes, Laravel skips a field that isn't in the data.
  if (value === undefined && field.sometimes) {
    return { message: null, server: false }
  }

  // For a missing value, null in a nullable field, or blank text, Laravel only runs the implicit rules.
  const optional =
    value === undefined || (value === null && field.nullable) || (typeof value === 'string' && /^[ \t\n\r\0\v]*$/.test(value))

  const context: RuleContext = {
    field,
    other: (path) => {
      const other = readable(path) ? getPath(sent.data, path) : askServer()
      return textLength(other) > MAX_TEXT ? askServer() : normalize(other, path)
    },
  }

  // Laravel reports the first rule that fails, so one rule we can't run sends the whole field to the server.
  for (const rule of field.rules) {
    if (optional && !IMPLICIT.has(rule.rule)) continue

    const validator = hasOwn(validators, rule.rule) ? validators[rule.rule] : undefined
    if (!validator) return toServer

    let passes: boolean
    try {
      passes = validator(value, rule, context)
    } catch {
      return toServer
    }

    if (!passes) {
      // Laravel keeps running the later rules, which can throw on an array or an object, and server
      // rules can throw on a number or a boolean. Leave those to the server.
      const later = field.server || field.rules.indexOf(rule) < field.rules.length - 1
      if (later && typeof value === 'object' && value !== null) return toServer
      if (field.server && value !== undefined && value !== null && typeof value !== 'string') return toServer

      return { message: rule.message, server: field.server }
    }
  }

  return { message: null, server: field.server }
}

// Resolve relative URLs against the page, like the request itself does.
const parseUrl = (url: string) => new URL(url, globalThis.document?.baseURI ?? 'http://localhost')

export const hasQuery = (url: string) => parseUrl(url).search !== ''

// Rules and answers are cached per method and URL, including the origin and query string.
export function schemaKey(method: string, url: string): string {
  const { origin, pathname, search } = parseUrl(url)
  return `${method.toLowerCase()} ${origin}/` + trimEnds(pathname, /^\/$/) + search
}
