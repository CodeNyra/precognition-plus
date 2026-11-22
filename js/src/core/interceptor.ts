import { client, type Config, type HttpResponse, HttpResponseError } from 'laravel-precognition'
import { withAppRules } from '../browser_rules'
import { checkField, hasQuery, received, schemaKey } from './engine'
import type { RuleValidators, ValidationSchema } from './types'
import { findPath, hasFile, hasOwn, isPlainObject } from './utils'

type Errors = Record<string, string[]>
type Send = (url: string, data?: Record<string, unknown>, config?: Config) => Promise<unknown>

// Every method is wrapped so that a real submit (precognitive: false) clears the cache. GET and
// DELETE send their data in the query string, so beyond that they're left to plain Precognition.
const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'query'] as const

const HEADER = 'Precognition-Rules'

// rules holds the app's own browser checks by rule name, listed in config/precognition-plus.php on
// the server. See docs/custom-rules.md.
export function setupPrecognitionPlus(options: { rules?: RuleValidators } = {}): () => void {
  const validators = withAppRules(options.rules)
  let schemas = new Map<string, ValidationSchema | null>()
  let cache = new Map<string, { value: string; errors: Errors }>()
  const inflight = new Map<string, AbortController>()

  // A visit or a submit can change both the rules and the answers (think of a unique check), so
  // drop them, and ignore late responses to requests sent before.
  let generation = 0
  const forget = () => {
    schemas = new Map()
    cache = new Map()
    generation++
  }
  globalThis.document?.addEventListener('inertia:navigate', forget)
  globalThis.document?.addEventListener('inertia:finish', forget)

  // A cached answer holds while the field and the fields its rules read keep their values. Values
  // are tagged with their type, so a missing value, null and an object never look the same.
  const tagged = (value: unknown): unknown => {
    if (value === null) return ['null']
    if (typeof value !== 'object') return [typeof value, typeof value === 'string' || typeof value === 'boolean' ? value : String(value)]
    return Array.isArray(value) ? ['list', value.map(tagged)] : ['object', Object.entries(value).map(([key, item]) => [key, tagged(item)])]
  }
  // reads keeps the serialized value of each path already read during one check.
  const valueOf = (data: unknown, entry: string, schema: ValidationSchema, reads: Map<string, string>) =>
    [entry, ...(schema[entry].depends ?? [])].map((path) => {
      if (!reads.has(path)) {
        const found = findPath(data, path)
        reads.set(path, JSON.stringify(found ? tagged(found.value) : ['missing']))
      }
      return reads.get(path)
    }).join(' ')

  // Only cache fields we have rules for, since we need their depends, and skip names with an
  // escaped dot, which Laravel reads as a single key.
  const cacheable = (schema: ValidationSchema, entry: string) =>
    hasOwn(schema, entry) && ![entry, ...(schema[entry].depends ?? [])].some((path) => path.includes('\\'))
  // Values over 10,000 characters aren't cached, so those fields go to the server every time.
  const remember = (since: number, key: string, values: Map<string, string>, server: Errors) => {
    if (since !== generation) return
    for (const [entry, value] of values) {
      if (value.length > 10_000) continue
      cache.set(`${key} ${entry}`, { value, errors: hasOwn(server, entry) ? { [entry]: server[entry] } : {} })
    }
  }

  const originals = Object.fromEntries(METHODS.map((method) => [method, client[method]])) as Record<
    (typeof METHODS)[number],
    Send
  >

  for (const method of METHODS) {
    const intercept: Send = (url, data = {}, config = {}) => {
      const key = schemaKey(routedMethod(method, data), url)
      const only = config.only ?? config.validate
      const since = generation

      // Any new request for this form makes our pending check stale. laravel-precognition cancels
      // its own requests the same way, but it can't cancel ours.
      inflight.get(key)?.abort()
      inflight.delete(key)

      if (config.precognitive === false) {
        return Promise.resolve(originals[method](url, data, config)).finally(forget)
      }

      // Leave it to plain Precognition when there's nothing to validate, the data isn't a plain
      // object or holds a file, or the config changes what gets sent (params, data, url, baseURL,
      // method or Content-Type).
      if (
        method === 'get' ||
        method === 'delete' ||
        !only ||
        !isPlainObject(data) ||
        hasFile(data) ||
        (['params', 'data', 'url', 'baseURL', 'method'] as const).some((option) => config[option] !== undefined) ||
        Object.keys(config.headers ?? {}).some((name) => name.toLowerCase() === 'content-type')
      ) {
        return originals[method](url, data, config)
      }

      const schema = schemas.get(key)

      if (schema === undefined) {
        const rulesIn = (response: HttpResponse) => {
          const rules = typeof response.data === 'object' ? response.data?.rules : undefined
          return rules && typeof rules === 'object' ? (rules as ValidationSchema) : null
        }
        // Don't cache answers when the data can't be serialized, like with a BigInt.
        const first = received(data, hasQuery(url))
        const copy = first?.data
        const learn = (response: HttpResponse, server: Errors = {}) => {
          if (since !== generation) return
          const learned = rulesIn(response)
          // Without Inertia visits to clear it, the cache starts over once it holds 50 URLs.
          if (!schemas.has(key) && schemas.size >= 50) {
            schemas = new Map()
            cache = new Map()
          }
          schemas.set(key, learned)
          if (first === null || learned === null) return
          const entries = Array.from(only).filter((entry) => cacheable(learned, entry))
          const reads = new Map<string, string>()
          remember(since, key, new Map(entries.map((entry) => [entry, valueOf(copy, entry, learned, reads)])), server)
        }

        return originals[method](url, data, {
          ...config,
          headers: { ...config.headers, [HEADER]: 'true' },
          onPrecognitionSuccess: (response) => {
            learn(response)
            return config.onPrecognitionSuccess?.(response) ?? response
          },
          onSuccess: (response) => {
            if (response.status !== 200 || !rulesIn(response)) {
              return config.onSuccess?.(response) ?? response
            }

            learn(response)
            return succeed(config, { ...response, status: 204, data: '' })
          },
          onValidationError: (response, error) => {
            learn(response, (response.data?.errors ?? {}) as Errors)
            return config.onValidationError ? config.onValidationError(response, error) : Promise.reject(error)
          },
        })
      }

      if (schema === null) {
        return originals[method](url, data, config)
      }

      // No prototype, so a field named __proto__ keeps its errors.
      const local: Errors = Object.create(null)
      const kept: Errors = Object.create(null)
      const send: string[] = []
      const values = new Map<string, string>()
      const sent = received(data, hasQuery(url))
      const reads = new Map<string, string>()

      for (const entry of Array.from(only)) {
        if (entry.includes('*')) {
          send.push(entry)
          continue
        }

        const { message, server } = checkField(schema, validators, entry, data, sent)

        // An empty message still counts as a failure, like in Laravel.
        if (message !== null) {
          local[entry] = [message]
          continue
        }

        if (!server) continue

        if (sent === null || !cacheable(schema, entry)) {
          send.push(entry)
          continue
        }

        const value = valueOf(sent.data, entry, schema, reads)
        const cached = cache.get(`${key} ${entry}`)

        if (cached?.value === value) {
          Object.assign(kept, cached.errors)
        } else {
          send.push(entry)
          values.set(entry, value)
        }
      }

      const errors = (server: Errors = {}) => ({ ...kept, ...server, ...local })

      if (send.length === 0) {
        return answer(config, errors())
      }

      const controller = new AbortController()
      config.signal?.addEventListener('abort', () => controller.abort())
      inflight.set(key, controller)

      return originals[method](url, data, {
        ...config,
        only: send,
        signal: controller.signal,
        onPrecognitionSuccess: (response) => {
          remember(since, key, values, {})
          const all = errors()
          return Object.keys(all).length ? fail(config, all) : (config.onPrecognitionSuccess?.(response) ?? response)
        },
        onValidationError: (response) => {
          const server = (response.data?.errors ?? {}) as Errors
          remember(since, key, values, server)
          return fail(config, errors(server), response)
        },
        onFinish: () => {
          if (inflight.get(key) === controller) inflight.delete(key)
          config.onFinish?.()
        },
      })
    }

    // If the data can't be walked (a cycle, for example), fall back to plain Precognition.
    client[method] = (url, data, config) => {
      try {
        return intercept(url, data, config)
      } catch {
        return originals[method](url, data, config)
      }
    }
  }

  return () => {
    for (const method of METHODS) client[method] = originals[method]
    globalThis.document?.removeEventListener('inertia:navigate', forget)
    globalThis.document?.removeEventListener('inertia:finish', forget)
  }
}

// The method Laravel routes a POST by. A string _method field overrides it.
function routedMethod(method: string, data: unknown): string {
  return method === 'post' && isPlainObject(data) && typeof data._method === 'string' ? data._method : method
}

function fail(config: Config, errors: Errors, base?: HttpResponse): unknown {
  const response: HttpResponse = {
    status: 422,
    headers: { ...base?.headers, precognition: 'true' },
    data: { ...(typeof base?.data === 'object' ? base.data : {}), errors },
  }
  const error = new HttpResponseError(response)

  return config.onValidationError ? config.onValidationError(response, error) : Promise.reject(error)
}

async function answer(config: Config, errors: Errors): Promise<unknown> {
  if (config.onBefore?.() === false) return null

  config.onStart?.()

  try {
    if (Object.keys(errors).length) return await fail(config, errors)

    return await succeed(config, { status: 204, data: '', headers: { precognition: 'true', 'precognition-success': 'true' } })
  } finally {
    config.onFinish?.()
  }
}

async function succeed(config: Config, response: HttpResponse): Promise<unknown> {
  const payload = (await config.onPrecognitionSuccess?.(response)) ?? response
  return (await config.onSuccess?.(payload as HttpResponse)) ?? payload
}
