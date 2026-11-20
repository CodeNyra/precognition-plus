import { client, type HttpRequestConfig, type HttpResponse, HttpResponseError } from 'laravel-precognition'
import type { ValidationSchema } from '../src/core/types'

export const navigate = (url: string) =>
  document.dispatchEvent(new CustomEvent('inertia:navigate', { detail: { page: { component: 'Test', props: {}, url } } }))

export function fakeServer(rules: Record<string, ValidationSchema> = {}) {
  const requests: Array<{ method: string; url: string; only: string | undefined; rules?: true }> = []
  let errors: Record<string, string[]> = {}

  client.useHttpClient({
    async request(config: HttpRequestConfig): Promise<HttpResponse> {
      const only = config.headers?.['Precognition-Validate-Only']
      const asked = config.headers?.['Precognition-Rules'] === 'true'
      requests.push({ method: config.method, url: config.url, only: only === undefined ? undefined : String(only), rules: asked || undefined })

      const schema = asked ? rules[`${config.method} ${config.url}`] : undefined
      const headers = { precognition: 'true' }
      const fields = only === undefined ? Object.keys(errors) : String(only).split(',')
      const failing = Object.fromEntries(Object.entries(errors).filter(([field]) => fields.includes(field)))

      if (Object.keys(failing).length) {
        throw new HttpResponseError({ status: 422, data: { errors: failing, ...(schema ? { rules: schema } : {}) }, headers })
      }
      const success = { ...headers, 'precognition-success': 'true' }
      return schema ? { status: 200, data: { rules: schema }, headers: success } : { status: 204, data: '', headers: success }
    },
  })

  return { requests, failWith: (next: Record<string, string[]>) => (errors = next) }
}
