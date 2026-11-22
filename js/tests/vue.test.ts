// @vitest-environment jsdom
import { Form, useForm } from '@inertiajs/vue3'
import { client } from 'laravel-precognition'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { type RuleValidator, setupPrecognitionPlus } from '../src'
import { field, schema } from './fixtures'
import { fakeServer, navigate } from './setup'

let uninstall: () => void
let server: ReturnType<typeof fakeServer>

beforeEach(() => {
  server = fakeServer({ 'post /users': schema })
  uninstall = setupPrecognitionPlus()
})
afterEach(() => uninstall())

const blank = () => ({ name: '', email: '', password: '', password_confirmation: '', age: '', items: [] as { sku: string }[] })

const precognitive = (data = blank()) => useForm('post', '/users', data).setValidationTimeout(1)

async function learnRules(form: ReturnType<typeof precognitive>) {
  form.age = '30'
  form.validate('age')
  await vi.waitFor(() => expect(form.valid('age')).toBe(true))
  expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'age', rules: true }])
  server.requests.length = 0
}

describe('stock Inertia useForm(method, url, data)', () => {
  it('fetches the rules with the first request, then checks browser fields locally', async () => {
    const form = precognitive()
    form.name = 'Taylor'
    form.validate('name')
    await vi.waitFor(() => expect(form.valid('name')).toBe(true))
    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name', rules: true }])

    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(form.errors).toEqual({ name: 'max failed' }))

    form.name = 'Otwell'
    form.validate('name')
    await vi.waitFor(() => expect(form.valid('name')).toBe(true))

    expect(form.errors).toEqual({})
    expect(server.requests).toHaveLength(1)
  })

  it('clears earlier errors when the first request passes', async () => {
    const form = precognitive()
    form.setError('name', 'Left over from a failed submit.')
    form.name = 'Taylor'
    form.validate('name')
    await vi.waitFor(() => expect(form.errors).toEqual({}))

    expect(form.valid('name')).toBe(true)
    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name', rules: true }])
  })

  it('picks up the rules from a failing first request', async () => {
    server.failWith({ email: ['The email has already been taken.'] })
    const form = precognitive()
    form.email = 'taken@laravel.com'
    form.validate('email')
    await vi.waitFor(() => expect(form.errors).toEqual({ email: 'The email has already been taken.' }))

    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(form.errors).toEqual({ email: 'The email has already been taken.', name: 'max failed' }))

    expect(server.requests).toHaveLength(1)
  })

  it('only asks the server about server fields that changed', async () => {
    const form = precognitive()
    await learnRules(form)
    form.name = 'Taylor'
    form.validate('name')
    form.email = 'taylor@laravel.com'
    form.validate('email')
    await vi.waitFor(() => expect(form.valid('email')).toBe(true))

    form.name = 'Otwell'
    form.validate('name')
    await vi.waitFor(() => expect(form.valid('name')).toBe(true))

    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'email' }])
  })

  it('keeps server errors and browser errors side by side', async () => {
    server.failWith({ email: ['The email has already been taken.'] })
    const form = precognitive()
    await learnRules(form)
    form.email = 'taken@laravel.com'
    form.validate('email')
    await vi.waitFor(() => expect(form.errors).toEqual({ email: 'The email has already been taken.' }))

    form.password = 'short'
    form.validate('password')
    await vi.waitFor(() => expect(form.errors).toEqual({ email: 'The email has already been taken.', password: 'min failed' }))

    expect(server.requests).toHaveLength(1)
  })

  it('reports browser errors when the server accepts the rest', async () => {
    const form = precognitive()
    await learnRules(form)
    form.password = 'short'
    form.email = 'taylor@laravel.com'
    form.touch('password')
    form.validate('email')
    await vi.waitFor(() => expect(form.errors).toEqual({ password: 'min failed' }))

    expect(form.valid('email')).toBe(true)
    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'email' }])
  })

  it("doesn't ask the server while a browser rule fails", async () => {
    const form = precognitive()
    await learnRules(form)
    form.email = 'not-an-email'
    form.validate('email')
    await vi.waitFor(() => expect(form.errors).toEqual({ email: 'email failed' }))

    expect(server.requests).toEqual([])
  })

  it('sends fields without browser rules to the server', async () => {
    const form = precognitive()
    await learnRules(form)
    form.items = [{ sku: 'abc' }]
    form.validate('items.0.sku')
    await vi.waitFor(() => expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'items.0.sku' }]))
  })

  it('asks the server every time about fields missing from the rules', async () => {
    const check = () => client.post('/users', { items: [{ sku: 'abc' }] }, { validate: ['items.0.sku'] }).catch(() => null)
    await check()
    await check()

    expect(server.requests).toEqual([
      { method: 'post', url: '/users', only: 'items.0.sku', rules: true },
      { method: 'post', url: '/users', only: 'items.0.sku' },
    ])
  })

  it('asks the server again when a field its rules depend on changes', async () => {
    server = fakeServer({
      'post /accounts': {
        type: field([['in', ['personal', 'business']]]),
        company: field([], { server: true, depends: ['type'] }),
      },
    })
    const form = useForm('post', '/accounts', { type: 'personal', company: '' }).setValidationTimeout(1)
    form.company = 'Acme'
    form.validate('company')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    form.type = 'business'
    form.validate('type')
    await vi.waitFor(() => expect(server.requests).toHaveLength(2))

    expect(server.requests[1]).toEqual({ method: 'post', url: '/accounts', only: 'company' })
  })

  it('keeps working when the data holds a BigInt', async () => {
    await client.post('/users', { name: 'Taylor', views: 5n }, { validate: ['name'] }).catch(() => null)
    await client.post('/users', { name: 'Way too long name', views: 5n }, { validate: ['name'] }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/users', only: 'name', rules: true },
      { method: 'post', url: '/users', only: 'name' },
    ])
  })

  it('asks the server again when a field goes from null to missing', async () => {
    server = fakeServer({ 'post /bio': { bio: field([], { server: true }) } })
    server.failWith({ bio: ['The bio field must have a value.'] })
    await client.post('/bio', { bio: null }, { validate: ['bio'] }).catch(() => null)
    await client.post('/bio', { bio: null }, { validate: ['bio'] }).catch(() => null)
    await client.post('/bio', {}, { validate: ['bio'] }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'post', url: '/bio', only: 'bio' },
    ])
  })

  it("doesn't cache answers for values over 10,000 characters", async () => {
    server = fakeServer({ 'post /bio': { bio: field([], { server: true }), title: field([], { server: true, depends: ['bio'] }) } })
    const bio = 'a'.repeat(10_001)
    for (const entry of ['bio', 'bio', 'title', 'title']) await client.post('/bio', { bio, title: 'x' }, { validate: [entry] }).catch(() => null)

    expect(server.requests).toHaveLength(4)
  })

  it('fetches the rules again after an Inertia visit, even to the same page', async () => {
    navigate('/bio')
    server = fakeServer({ 'post /bio': { bio: field([['max', ['3']]], { server: true }) } })
    await client.post('/bio', { bio: 'ab' }, { validate: ['bio'] }).catch(() => null)
    navigate('/bio')
    await client.post('/bio', { bio: 'ab' }, { validate: ['bio'] }).catch(() => null)
    await client.post('/bio', { bio: 'abcd' }, { validate: ['bio'] }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'post', url: '/bio', only: 'bio', rules: true },
    ])
  })

  it('ignores responses that arrive after a visit finished', async () => {
    server = fakeServer({ 'post /bio': { bio: field([], { server: true }) } })
    const check = () => client.post('/bio', { bio: 'ab' }, { validate: ['bio'] }).catch(() => null)
    const first = check()
    document.dispatchEvent(new CustomEvent('inertia:finish'))
    await first
    await check()
    await check()

    expect(server.requests).toEqual([
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'post', url: '/bio', only: 'bio', rules: true },
    ])
  })

  it.each([
    [
      'the first request after a visit',
      async () => {
        navigate('/bio')
        await client.post('/bio', { bio: 'c' }, { validate: ['bio'] })
      },
    ],
    ['a request with a file', () => client.post('/bio', { bio: 'c', avatar: new File(['a'], 'a.jpg') }, { validate: ['bio'] })],
    ['a submit', () => client.post('/bio', { bio: 'c' }, { precognitive: false })],
  ])('cancels a pending check when %s goes out', async (_, next) => {
    const signals: Array<AbortSignal | undefined> = []
    client.useHttpClient({
      request: async (config) => {
        signals.push(config.signal)
        // The first check after the rules arrive is still pending.
        if (signals.length === 2) return new Promise(() => {})
        const rules = config.headers?.['Precognition-Rules'] === 'true'
        const headers = { precognition: 'true', 'precognition-success': 'true' }
        return rules ? { status: 200, data: { rules: { bio: field([], { server: true }) } }, headers } : { status: 204, data: '', headers }
      },
    })
    await client.post('/bio', { bio: 'a' }, { validate: ['bio'] })
    void client.post('/bio', { bio: 'b' }, { validate: ['bio'] })
    await next()

    expect(signals).toHaveLength(3)
    expect(signals[1]?.aborted).toBe(true)
  })

  it('asks the server again after any visit finishes and after a submit', async () => {
    server = fakeServer({ 'post /bio': { bio: field([], { server: true }) } })
    const check = () => client.post('/bio', { bio: 'ab' }, { validate: ['bio'] }).catch(() => null)
    await check()
    await check()
    // Inertia sends no inertia:navigate for a visit that comes back to the same page.
    document.dispatchEvent(new CustomEvent('inertia:finish'))
    await check()
    await client.post('/bio', { bio: 'ab' }, { precognitive: false }).catch(() => null)
    await check()

    expect(server.requests).toEqual([
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'post', url: '/bio', only: undefined },
      { method: 'post', url: '/bio', only: 'bio', rules: true },
    ])
  })

  it('caches rules and answers per URL, query string included', async () => {
    const invite = { role: field([], { server: true }) }
    server = fakeServer({ 'post /invite?team=1': invite, 'post /invite?team=2': invite })
    const check = (url: string) => client.post(url, { role: 'admin' }, { validate: ['role'] }).catch(() => null)
    await check('/invite?team=1')
    await check('/invite?team=1')
    await check('/invite?team=2')

    expect(server.requests).toEqual([
      { method: 'post', url: '/invite?team=1', only: 'role', rules: true },
      { method: 'post', url: '/invite?team=2', only: 'role', rules: true },
    ])
  })

  it('resolves relative URLs against the page', async () => {
    server = fakeServer({ 'post basic': { bio: field([['max', ['3']]]) } })
    const check = async (page: string) => {
      history.pushState({}, '', page)
      await client.post('basic', { bio: 'ab' }, { validate: ['bio'] })
    }
    await check('/v/')
    await check('/v/lists/')
    await check('/v/lists/')
    history.pushState({}, '', '/')

    expect(server.requests).toEqual([
      { method: 'post', url: 'basic', only: 'bio', rules: true },
      { method: 'post', url: 'basic', only: 'bio', rules: true },
    ])
  })

  it('caches rules per routed method, which _method can change', async () => {
    server = fakeServer({ 'post /items': { name: field([['max', ['3']]]) } })
    const check = (data: Record<string, unknown>) => client.post('/items', { name: 'ab', ...data }, { validate: ['name'] })
    await check({ _method: 'put' })
    await check({ _method: 'PUT' })
    await check({ _method: 'delete' })
    await check({})

    expect(server.requests).toEqual([
      { method: 'post', url: '/items', only: 'name', rules: true },
      { method: 'post', url: '/items', only: 'name', rules: true },
      { method: 'post', url: '/items', only: 'name', rules: true },
    ])
  })

  it('treats an empty message as a failure', async () => {
    server = fakeServer({ 'post /users': { name: field([['required', [], { message: '' }]]) } })
    let errors: object = {}
    const config = { validate: ['name'], onValidationError: (response: { data: { errors: object } }) => void (errors = response.data.errors) }
    await client.post('/users', { name: 'Taylor' }, config as never).catch(() => null)
    await client.post('/users', { name: '' }, config as never).catch(() => null)

    expect(errors).toEqual({ name: [''] })
    expect(server.requests).toHaveLength(1)
  })

  it("doesn't cache the first answer when the data can't be serialized", async () => {
    server.failWith({ email: ['The email field is required.'] })
    await client.post('/users', { email: 'a@b.c', views: 5n }, { validate: ['email'] }).catch(() => null)
    server.failWith({})
    await client.post('/users', { email: 'a@b.c', views: 5 }, { validate: ['email'] }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/users', only: 'email', rules: true },
      { method: 'post', url: '/users', only: 'email' },
    ])
  })

  it('asks the server every time about names with an escaped dot', async () => {
    server = fakeServer({ 'post /dots': { 'a\\.b': field([], { server: true }), name: field([], { server: true, depends: ['a\\.b'] }) } })
    const check = (value: string) => client.post('/dots', { 'a.b': value, name: 'x' }, { validate: ['a\\.b', 'name'] }).catch(() => null)
    await check('one')
    await check('two')

    expect(server.requests).toEqual([
      { method: 'post', url: '/dots', only: 'a\\.b,name', rules: true },
      { method: 'post', url: '/dots', only: 'a\\.b,name' },
    ])
  })

  it('reads each value once per check, however many fields use it', async () => {
    const names = Array.from({ length: 1000 }, (_, i) => `f${i}`)
    server = fakeServer({ 'post /many': Object.fromEntries(names.map((name) => [name, field([], { server: true, depends: ['list'] })])) })
    const data = { list: Array.from({ length: 500 }, (_, i) => i), ...Object.fromEntries(names.map((name) => [name, 'x'])) }
    await client.post('/many', data, { validate: names }).catch(() => null)
    const start = performance.now()
    await client.post('/many', data, { validate: names }).catch(() => null)

    expect(performance.now() - start).toBeLessThan(100)
    expect(server.requests).toHaveLength(1)
  })

  it('caches answers by what JSON sends, so boxed numbers match plain ones', async () => {
    server = fakeServer({ 'post /qty': { qty: field([], { server: true }) } })
    await client.post('/qty', { qty: new Number(5) }, { validate: ['qty'] }).catch(() => null)
    await client.post('/qty', { qty: new Number(6) }, { validate: ['qty'] }).catch(() => null)

    expect(server.requests).toHaveLength(2)
  })

  it("leaves data it can't walk, like a cycle, to plain Precognition", async () => {
    const data: Record<string, unknown> = { name: 'Way too long name' }
    data.self = data
    await client.post('/users', data, { validate: ['name'] }).catch(() => null)
    await client.post('/users', data, { validate: ['name'] }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/users', only: 'name' },
      { method: 'post', url: '/users', only: 'name' },
    ])
  })

  it('keeps the errors of a field named __proto__', async () => {
    server = fakeServer({ 'post /odd': JSON.parse('{"__proto__": {"rules": [], "server": true, "nullable": false, "type": "string"}}') })
    server.failWith(JSON.parse('{"__proto__": ["Odd."]}'))
    let errors: object = {}
    const config = { validate: ['__proto__'], onValidationError: (response: { data: { errors: object } }) => void (errors = response.data.errors) }
    await client.post('/odd', {}, config as never).catch(() => null)
    errors = {}
    await client.post('/odd', {}, config as never).catch(() => null)

    // The second answer comes from the cache.
    expect(server.requests).toHaveLength(1)
    expect(Object.hasOwn(errors, '__proto__')).toBe(true)

    // Data with a key named __proto__ goes to the server every time, and keeps its errors too.
    errors = {}
    await client.post('/odd', JSON.parse('{"__proto__": "x"}'), config as never).catch(() => null)
    expect(server.requests).toHaveLength(2)
    expect(Object.hasOwn(errors, '__proto__')).toBe(true)
  })

  it('behaves like plain Precognition when the server sends no rules', async () => {
    const form = useForm('post', '/elsewhere', { title: '' }).setValidationTimeout(1)
    form.title = 'Hello'
    form.validate('title')
    await vi.waitFor(() => expect(form.valid('title')).toBe(true))
    form.title = 'Hello again'
    form.validate('title')
    await vi.waitFor(() => expect(server.requests).toHaveLength(2))

    expect(server.requests).toEqual([
      { method: 'post', url: '/elsewhere', only: 'title', rules: true },
      { method: 'post', url: '/elsewhere', only: 'title' },
    ])
  })

  it('fetches the rules again for a form after a visit back to its page', async () => {
    navigate('/users/create')
    const form = precognitive()
    await learnRules(form)

    navigate('/users/create')
    form.name = 'Taylor'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name,age', rules: true }]))
  })

  it('caches rules for at most 50 URLs', async () => {
    server = fakeServer(Object.fromEntries(Array.from({ length: 51 }, (_, i) => [`post /u${i}`, { bio: field([], { server: true }) }])))
    for (let i = 0; i <= 50; i++) await client.post(`/u${i}`, { bio: 'a' }, { validate: ['bio'] }).catch(() => null)
    server.requests.length = 0
    await client.post('/u1', { bio: 'a' }, { validate: ['bio'] }).catch(() => null)

    expect(server.requests).toEqual([{ method: 'post', url: '/u1', only: 'bio', rules: true }])
  })

  it('can be uninstalled', async () => {
    uninstall()
    const form = precognitive()
    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name' }]))
  })
})

describe('requests left to plain Precognition', () => {
  const profile = { name: field([['max', ['3']]]), avatar: field([], { server: true, type: 'file' }) }

  it('leaves GET forms alone', async () => {
    server = fakeServer({ 'get /search': { q: field([['max', ['3']]]) } })
    const form = useForm('get', '/search', { q: '' }).setValidationTimeout(1)
    form.q = 'longer'
    form.validate('q')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    expect(server.requests[0]).toMatchObject({ method: 'get', only: 'q' })
    expect(server.requests[0].rules).toBeUndefined()
    expect(form.errors).toEqual({})
  })

  it('leaves DELETE requests alone too', async () => {
    server = fakeServer({ 'delete /users/1': { reason: field([['max', ['3']]]) } })
    await client.delete('/users/1', { reason: 'longer' }, { validate: ['reason'] }).catch(() => null)

    expect(server.requests).toHaveLength(1)
    expect(server.requests[0].rules).toBeUndefined()
  })

  it('clears the cache after a DELETE submit too', async () => {
    server = fakeServer({ 'post /bio': { bio: field([], { server: true }) } })
    const check = () => client.post('/bio', { bio: 'ab' }, { validate: ['bio'] }).catch(() => null)
    await check()
    await client.delete('/bio/1', {}, { precognitive: false }).catch(() => null)
    await check()

    expect(server.requests).toEqual([
      { method: 'post', url: '/bio', only: 'bio', rules: true },
      { method: 'delete', url: '/bio/1', only: undefined },
      { method: 'post', url: '/bio', only: 'bio', rules: true },
    ])
  })

  it('leaves requests with a file alone', async () => {
    server = fakeServer({ 'post /profile': profile })
    const form = useForm('post', '/profile', { name: '', avatar: null as File | null }).setValidationTimeout(1).validateFiles()
    form.name = 'ab'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    form.avatar = new File(['PNG'], 'me.png')
    form.name = 'longer'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toHaveLength(2))

    expect(server.requests[1]).toEqual({ method: 'post', url: '/profile', only: 'name' })
  })

  it('leaves requests with params alone', async () => {
    await client.post('/users', { name: 'Way too long name' }, { validate: ['name'], params: { team: 'red' } }).catch(() => null)

    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name' }])
  })

  it('leaves requests with data or a URL in their config alone', async () => {
    await client.post('/users', { name: 'ok' }, { validate: ['name'], data: { name: 'Way too long name' } }).catch(() => null)
    await client.post('/users', { name: 'ok' }, { validate: ['name'], url: '/elsewhere' }).catch(() => null)

    expect(server.requests).toEqual([
      { method: 'post', url: '/users', only: 'name' },
      { method: 'post', url: '/elsewhere', only: 'name' },
    ])
  })

  it('leaves requests with their own Content-Type alone', async () => {
    const config = { validate: ['name'], headers: { 'content-type': 'multipart/form-data' } }
    await client.post('/users', { name: 'Way too long name' }, config).catch(() => null)

    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name' }])
  })

  it('leaves FormData alone', async () => {
    const data = new FormData()
    data.append('name', 'Taylor')
    await client.post('/users', data as never, { validate: ['name'] }).catch(() => null)

    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name' }])
  })
})

describe('other entry points', () => {
  it('covers useForm(data).withPrecognition(method, url)', async () => {
    const form = useForm(blank()).withPrecognition('post', '/users').setValidationTimeout(1)
    form.name = 'Taylor'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(form.errors).toEqual({ name: 'max failed' }))

    expect(server.requests).toHaveLength(1)
  })

  it('covers the <Form> component', async () => {
    const slot: { validate?: (field: string) => void; errors?: Record<string, string> } = {}
    const root = document.createElement('div')
    document.body.append(root)

    createApp({
      render: () =>
        h(Form, { action: '/users', method: 'post', validationTimeout: 1 }, {
          default: (props: typeof slot) => {
            Object.assign(slot, props)
            return [h('input', { name: 'name' }), h('p', props.errors!.name)]
          },
        }),
    }).mount(root)
    await nextTick()

    const input = root.querySelector('input')!
    input.value = 'Taylor'
    slot.validate!('name')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    input.value = 'Way too long name'
    slot.validate!('name')
    await vi.waitFor(() => expect(slot.errors).toEqual({ name: 'max failed' }))

    expect(server.requests).toHaveLength(1)
  })
})

describe("the app's own rules", () => {
  // The browser half of iso_date, from docs/custom-rules.md.
  const iso_date: RuleValidator = (value) => {
    const date = typeof value === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(value) : null
    if (!date) return false
    const [year, month, day] = date.slice(1).map(Number)
    const parsed = new Date(0)
    parsed.setUTCFullYear(year, month - 1, day)
    return year >= 1 && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day
  }

  beforeEach(() => {
    uninstall()
    server = fakeServer({ 'post /people': { birthday: field([['required'], ['iso_date']]) } })
    uninstall = setupPrecognitionPlus({ rules: { iso_date } })
  })

  it('checks a rule from setupPrecognitionPlus({ rules }) in the browser, with the message the server sent', async () => {
    const form = useForm('post', '/people', { birthday: '' }).setValidationTimeout(1)
    form.birthday = '2024-02-29'
    form.validate('birthday')
    await vi.waitFor(() => expect(form.valid('birthday')).toBe(true))

    form.birthday = '2024-02-30'
    form.validate('birthday')
    await vi.waitFor(() => expect(form.errors).toEqual({ birthday: 'iso_date failed' }))

    form.birthday = '2028-02-29'
    form.validate('birthday')
    await vi.waitFor(() => expect(form.valid('birthday')).toBe(true))

    expect(server.requests).toEqual([{ method: 'post', url: '/people', only: 'birthday', rules: true }])
  })
})
