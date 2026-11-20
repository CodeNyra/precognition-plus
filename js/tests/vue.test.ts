// @vitest-environment jsdom
import { Form, useForm } from '@inertiajs/vue3'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, h, nextTick } from 'vue'
import { setupPrecognitionPlus } from '../src'
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
  it('asks for the rules with the first request, then checks client-safe fields in the browser', async () => {
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

  it('learns the rules from a first request that fails', async () => {
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

  it('asks the server for changed server fields only', async () => {
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

  it('does not ask the server while a client rule fails', async () => {
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

  it('asks the server again when a field its rules name changes', async () => {
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

  it('asks the server again when another file is picked', async () => {
    server = fakeServer({ 'post /profile': { avatar: field([], { server: true, type: 'file' }) } })
    const form = useForm('post', '/profile', { avatar: null as File | null }).setValidationTimeout(1).validateFiles()
    form.avatar = new File(['%PDF'], 'cv.pdf')
    form.validate('avatar')
    await vi.waitFor(() => expect(server.requests).toHaveLength(1))

    form.avatar = new File(['PNG'], 'me.png')
    form.validate('avatar')
    await vi.waitFor(() => expect(server.requests).toHaveLength(2))

    expect(server.requests[1]).toEqual({ method: 'post', url: '/profile', only: 'avatar' })
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

  it('asks again on another page, but not when Inertia returns to the same one', async () => {
    navigate('/users/create')
    const form = precognitive()
    await learnRules(form)

    navigate('/users/create')
    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(form.errors).toEqual({ name: 'max failed' }))
    expect(server.requests).toEqual([])

    navigate('/teams')
    form.name = 'Taylor'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name,age', rules: true }]))
  })

  it('can be uninstalled', async () => {
    uninstall()
    const form = precognitive()
    form.name = 'Way too long name'
    form.validate('name')
    await vi.waitFor(() => expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name' }]))
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
