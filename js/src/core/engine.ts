import type { FieldResult, FieldSchema, RuleContext, RuleValidators, ValidationSchema } from './types'
import { type Data, getPath, normalize, toPhpString } from './utils'

const IMPLICIT = new Set(['required'])

export function checkField(schema: ValidationSchema, validators: RuleValidators, attribute: string, data: Data): FieldResult {
  const field = schema[attribute]

  if (!field) {
    return { message: null, server: true }
  }

  const value = normalize(getPath(data, attribute), attribute)
  const optional = value === undefined || (value === null && field.nullable)
  let server = field.server

  const context: RuleContext = {
    attribute,
    field,
    other: (path) => normalize(getPath(data, path), path),
  }

  for (const rule of field.rules) {
    if (optional && !IMPLICIT.has(rule.rule)) continue

    const validator = validators[rule.rule]
    if (!validator) {
      server = true
      continue
    }

    let passes: boolean
    try {
      passes = validator(value, rule, context)
    } catch {
      server = true
      continue
    }

    if (!passes) {
      return { message: withInput(rule.message, value, field), server }
    }
  }

  return { message: null, server }
}

// The server leaves :input in the messages, because only the browser knows the value. Laravel only
// fills it in for scalars and null, preferring a name from validation.values.
function withInput(message: string, value: unknown, field: FieldSchema): string {
  if (!message.includes(':input')) return message
  if (value !== null && value !== undefined && !['string', 'number', 'boolean'].includes(typeof value)) return message

  const shown =
    field.values?.[toPhpString(value)] ??
    (typeof value === 'boolean' ? String(value) : value === null || value === undefined ? 'empty' : String(value))

  return message.split(':input').join(shown)
}

export function schemaKey(method: string, url: string): string {
  const base = typeof window === 'undefined' ? 'http://localhost' : window.location.origin
  return `${method.toLowerCase()} /` + new URL(url, base).pathname.replace(/^\/+|\/+$/g, '')
}
