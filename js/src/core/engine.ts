import type { FieldResult, FieldSchema, RuleContext, RuleValidators, ValidationSchema } from './types'
import { type Data, getPath, normalize, phpText } from './utils'

// Rules Laravel runs on an empty or missing field too.
const IMPLICIT = new Set(['required', 'accepted', 'declined'])

export function checkField(schema: ValidationSchema, validators: RuleValidators, attribute: string, data: Data): FieldResult {
  const field = schema[attribute]

  if (!field) {
    return { message: null, server: true }
  }

  const value = normalize(getPath(data, attribute), attribute)
  // Laravel skips all but the implicit rules for a missing value, for null in a nullable field, and
  // for text that PHP's trim() empties, which only a field TrimStrings leaves alone can still have.
  const optional =
    value === undefined || (value === null && field.nullable) || (typeof value === 'string' && /^[ \t\n\r\0\v]*$/.test(value))

  const context: RuleContext = {
    attribute,
    field,
    other: (path) => normalize(getPath(data, path), path),
  }

  // Laravel shows the message of the first rule that fails, so once a rule can't be checked here,
  // the server answers for the whole field.
  const askServer = { message: null, server: true }

  for (const rule of field.rules) {
    if (optional && !IMPLICIT.has(rule.rule)) continue

    const validator = validators[rule.rule]
    if (!validator) return askServer

    let passes: boolean
    try {
      passes = validator(value, rule, context)
    } catch {
      return askServer
    }

    if (!passes) {
      const message = withInput(rule.message, value, field)
      return message === undefined ? askServer : { message, server: field.server }
    }
  }

  return { message: null, server: field.server }
}

// The server leaves :input in the messages, because only the browser knows the value. Laravel only
// fills it in for scalars and null, preferring a name from validation.values. Undefined when PHP
// would write the value in a way the browser can't be sure of.
function withInput(message: string, value: unknown, field: FieldSchema): string | undefined {
  if (!message.includes(':input')) return message
  if (value !== null && value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) return message

  const text = phpText(value)
  if (text === undefined) return undefined

  const shown = field.values?.[text] ?? (typeof value === 'boolean' ? String(value) : value === null || value === undefined ? 'empty' : text)

  return message.split(':input').join(shown)
}

export function schemaKey(method: string, url: string): string {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  return `${method.toLowerCase()} /` + new URL(url, base).pathname.replace(/^\/+|\/+$/g, '')
}
