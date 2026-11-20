import { describe, expect, it } from 'vitest'
import { checkField } from '../src/core/engine'
import type { RuleValidators } from '../src/core/types'
import { validators } from '../src/core/validators'
import { field } from './fixtures'

const passes = (rule: string, value: unknown, params: string[] = [], extra = {}, data: Record<string, unknown> = {}) =>
  checkField({ x: field([[rule, params]], extra) }, validators, 'x', { ...data, x: value }).message === null

describe('rules mirror Laravel', () => {
  it.each([
    ['required', 'a', true],
    ['required', '   ', false],
    ['required', [], false],
    ['required', false, true],
    ['string', 'a', true],
    ['string', 5, false],
    ['numeric', '1.5e3', true],
    ['numeric', '0x1A', false],
    ['integer', '42', true],
    ['integer', '042', false],
    ['integer', '4.2', false],
    ['boolean', '1', true],
    ['boolean', 'true', false],
    ['email', 'taylor@laravel.com', true],
    ['email', 'not an email', false],
  ])('%s(%j) => %s', (rule, value, expected) => {
    expect(passes(rule, value)).toBe(expected)
  })

  it('measures size by type, like getSize()', () => {
    expect(passes('min', 'abc', ['3'])).toBe(true)
    expect(passes('min', '12', ['3'])).toBe(false)
    expect(passes('min', '12', ['3'], { type: 'numeric' })).toBe(true)
    expect(passes('max', ['a', 'b'], ['1'])).toBe(false)
    expect(passes('between', '😀😀', ['2', '2'])).toBe(true)
  })

  it('compares in with PHP equality', () => {
    expect(passes('in', 'b', ['a', 'b'])).toBe(true)
    expect(passes('in', '01', ['1'])).toBe(true)
    expect(passes('in', true, ['1'])).toBe(true)
    expect(passes('in', 'c', ['a', 'b'])).toBe(false)
  })

  it('checks the confirmation field', () => {
    expect(passes('confirmed', 'secret', ['x_confirmation'], {}, { x_confirmation: 'secret' })).toBe(true)
    expect(passes('confirmed', 'secret', ['x_confirmation'], {}, { x_confirmation: 'other' })).toBe(false)
  })

  it('runs regexes converted from PCRE', () => {
    expect(passes('regex', 'ABC', ['^[a-z]+$', 'i'])).toBe(true)
    expect(passes('regex', 'AB1', ['^[a-z]+$', 'i'])).toBe(false)
    expect(passes('regex', 'é', ['^\\p{L}$', 'u'])).toBe(true)
  })
})

describe('the engine', () => {
  it('sees empty strings as null, like ConvertEmptyStringsToNull', () => {
    expect(passes('string', '')).toBe(false)
    expect(passes('string', '', [], { nullable: true })).toBe(true)
    expect(passes('min', '  ab  ', ['3'])).toBe(false)
  })

  it('skips non-implicit rules for a missing value', () => {
    expect(checkField({ x: field([['email']]) }, validators, 'x', {}).message).toBeNull()
  })

  it('returns the first failing message', () => {
    const result = checkField({ x: field([['required'], ['email']]) }, validators, 'x', { x: '' })
    expect(result).toEqual({ message: 'required failed', server: false })
  })

  it('fills :input in with the value, the way Laravel does', () => {
    const code = field([['regex', ['^\\d+$', ''], { message: 'The code :input is not valid.' }]])
    expect(checkField({ x: code }, validators, 'x', { x: ' abc ' }).message).toBe('The code abc is not valid.')

    const role = field([['in', ['admin'], { message: ':input is not a role.' }]], { values: { editor: 'Editor in chief' } })
    expect(checkField({ x: role }, validators, 'x', { x: 'editor' }).message).toBe('Editor in chief is not a role.')
  })

  it('leaves fields it has no rules for to the server', () => {
    expect(checkField({}, validators, 'items.0.sku', { items: [{ sku: 'a' }] })).toEqual({ message: null, server: true })
  })

  it('falls back to the server when a rule cannot run here', () => {
    const missing: RuleValidators = { required: validators.required }
    expect(checkField({ x: field([['required'], ['email']]) }, missing, 'x', { x: 'a' }).server).toBe(true)

    const invalidPattern = { x: field([['regex', ['(?<!', '']]]) }
    expect(checkField(invalidPattern, validators, 'x', { x: 'a' })).toEqual({ message: null, server: true })
  })
})
