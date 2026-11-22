// @vitest-environment jsdom
import { useForm } from '@inertiajs/react'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { setupPrecognitionPlus } from '../src'
import { schema } from './fixtures'
import { fakeServer } from './setup'

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let uninstall: () => void
let server: ReturnType<typeof fakeServer>

beforeEach(() => {
  server = fakeServer({ 'post /users': schema })
  uninstall = setupPrecognitionPlus()
})
afterEach(() => uninstall())

const precognitiveForm = () => useForm('post', '/users', { name: '', email: '' })

function renderForm() {
  const current = {} as { form: ReturnType<typeof precognitiveForm> }

  function Probe() {
    current.form = precognitiveForm()
    return null
  }

  act(() => createRoot(document.createElement('div')).render(<Probe />))
  act(() => {
    current.form.setValidationTimeout(1)
  })
  return current
}

describe('stock Inertia React useForm()', () => {
  it('fetches the rules first, then checks browser-only fields locally', async () => {
    const current = renderForm()
    act(() => current.form.setData('name', 'Taylor'))
    act(() => {
      current.form.validate('name')
    })
    await vi.waitFor(() => expect(current.form.valid('name')).toBe(true))

    act(() => current.form.setData('name', 'Way too long name'))
    act(() => {
      current.form.validate('name')
    })
    await vi.waitFor(() => expect(current.form.errors).toEqual({ name: 'max failed' }))

    expect(server.requests).toEqual([{ method: 'post', url: '/users', only: 'name', rules: true }])
  })

  it('sends a server field in a precognitive request of its own', async () => {
    const current = renderForm()
    act(() => current.form.setData('name', 'Taylor'))
    act(() => {
      current.form.validate('name')
    })
    await vi.waitFor(() => expect(current.form.valid('name')).toBe(true))

    act(() => current.form.setData('email', 'taylor@laravel.com'))
    act(() => {
      current.form.validate('email')
    })
    await vi.waitFor(() => expect(current.form.valid('email')).toBe(true))

    expect(server.requests[1]).toEqual({ method: 'post', url: '/users', only: 'email' })
  })
})
