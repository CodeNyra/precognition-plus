import { client, type Config, type HttpResponse, HttpResponseError } from 'laravel-precognition'
import { checkField, schemaKey } from './engine'
import type { ValidationSchema } from './types'
import { getPath, isFile } from './utils'
import { validators } from './validators'

type Errors = Record<string, string[]>
type Send = (url: string, data?: Record<string, unknown>, config?: Config) => Promise<unknown>

const METHODS = ['get', 'post', 'put', 'patch', 'delete', 'query'] as const

const HEADER = 'Precognition-Rules'

export function setupPrecognitionPlus(): () => void {
  let schemas = new Map<string, ValidationSchema | null>()
  let cache = new Map<string, { value: string; errors: Errors }>()
  const inflight = new Map<string, AbortController>()

  let page: unknown
  const onNavigate = (event: Event) => {
    const url = (event as CustomEvent).detail?.page?.url
    if (url === page) return
    page = url
    schemas = new Map()
    cache = new Map()
  }
  globalThis.document?.addEventListener('inertia:navigate', onNavigate)

  // JSON.stringify turns every File into {}, so each file gets a number of its own and picking
  // another file counts as a new value.
  const fileIds = new WeakMap<Blob, number>()
  let files = 0
  const withFileIds = (_key: string, value: unknown) => {
    if (!isFile(value)) return value
    if (!fileIds.has(value)) fileIds.set(value, ++files)
    return { file: fileIds.get(value) }
  }

  // A server answer holds while the field and the fields its rules name (required_if:type,...) keep
  // their values.
  const valueOf = (data: unknown, entry: string, schema?: ValidationSchema | null) =>
    JSON.stringify([entry, ...(schema?.[entry]?.depends ?? [])].map((path) => getPath(data, path)), withFileIds)
  const remember = (key: string, values: Map<string, string>, server: Errors) => {
    for (const [entry, value] of values) {
      cache.set(`${key} ${entry}`, { value, errors: server[entry] ? { [entry]: server[entry] } : {} })
    }
  }

  const originals = Object.fromEntries(METHODS.map((method) => [method, client[method]])) as Record<
    (typeof METHODS)[number],
    Send
  >

  for (const method of METHODS) {
    client[method] = (url, data = {}, config = {}) => {
      const key = schemaKey(method, url)
      const only = config.only ?? config.validate

      if (!only || config.precognitive === false) {
        return originals[method](url, data, config)
      }

      const schema = schemas.get(key)

      if (schema === undefined) {
        const rulesIn = (response: HttpResponse) => {
          const rules = typeof response.data === 'object' ? response.data?.rules : undefined
          return rules && typeof rules === 'object' ? (rules as ValidationSchema) : null
        }
        // The rules arrive with the answer, so keep a copy of what was sent to file the answer under.
        const sent: unknown = JSON.parse(JSON.stringify(data, withFileIds))
        const learn = (response: HttpResponse, server: Errors = {}) => {
          const learned = rulesIn(response)
          const entries = Array.from(only).filter((entry) => !entry.includes('*'))
          schemas.set(key, learned)
          remember(key, new Map(entries.map((entry) => [entry, valueOf(sent, entry, learned)])), server)
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

      const local: Errors = {}
      const kept: Errors = {}
      const send: string[] = []
      const values = new Map<string, string>()

      for (const entry of Array.from(only)) {
        if (entry.includes('*')) {
          send.push(entry)
          continue
        }

        const { message, server } = checkField(schema, validators, entry, data)

        if (message) {
          local[entry] = [message]
          continue
        }

        if (!server) continue

        const value = valueOf(data, entry, schema)
        const cached = cache.get(`${key} ${entry}`)

        if (cached?.value === value) {
          Object.assign(kept, cached.errors)
        } else {
          send.push(entry)
          values.set(entry, value)
        }
      }

      inflight.get(key)?.abort()
      inflight.delete(key)

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
          remember(key, values, {})
          const all = errors()
          return Object.keys(all).length ? fail(config, all) : (config.onPrecognitionSuccess?.(response) ?? response)
        },
        onValidationError: (response) => {
          const server = (response.data?.errors ?? {}) as Errors
          remember(key, values, server)
          return fail(config, errors(server), response)
        },
        onFinish: () => {
          if (inflight.get(key) === controller) inflight.delete(key)
          config.onFinish?.()
        },
      })
    }
  }

  return () => {
    for (const method of METHODS) client[method] = originals[method]
    globalThis.document?.removeEventListener('inertia:navigate', onNavigate)
  }
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
