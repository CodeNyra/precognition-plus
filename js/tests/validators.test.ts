import { describe, expect, it } from 'vitest'
import { checkField } from '../src/core/engine'
import type { RuleValidators } from '../src/core/types'
import { normalize } from '../src/core/utils'
import { validators } from '../src/core/validators'
import { field } from './fixtures'

const passes = (rule: string, value: unknown, params: string[] = [], extra = {}, data: Record<string, unknown> = {}) =>
  checkField({ x: field([[rule, params]], extra) }, validators, 'x', { ...data, x: value }).message === null

const outcome = (rule: string, value: unknown, params: string[] = [], extra = {}) => {
  const result = checkField({ x: field([[rule, params]], extra) }, validators, 'x', { x: value })
  return result.message !== null ? 'fail' : result.server ? 'server' : 'pass'
}

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
    ['accepted', 'yes', true],
    ['accepted', 'true', true],
    ['accepted', 'no', false],
    ['declined', false, true],
    ['declined', 'off', true],
    ['declined', 'yes', false],
    ['alpha', 'héllo', true],
    ['alpha', 'abc1', false],
    ['alpha_dash', 'a-b_1', true],
    ['alpha_dash', 'a b', false],
    ['alpha_num', 'abc123', true],
    ['alpha_num', 'abc-1', false],
    ['lowercase', 'abc', true],
    ['lowercase', 'Abc', false],
    ['uppercase', 'ABC', true],
    ['uppercase', 'ß', false],
    ['uuid', '123e4567-e89b-12d3-a456-426614174000', true],
    ['uuid', '{123e4567-e89b-12d3-a456-426614174000}', false],
    ['ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV', true],
    ['ulid', '81ARZ3NDEKTSV4RRFFQ69G5FAV', false],
    ['file', new File(['a'], 'a.txt'), true],
    ['file', 'a.txt', false],
  ])('%s(%j) => %s', (rule, value, expected) => {
    expect(passes(rule, value)).toBe(expected)
  })

  it('runs accepted and declined on empty fields, like Laravel', () => {
    expect(checkField({ x: field([['accepted']]) }, validators, 'x', {}).message).toBe('accepted failed')
    expect(passes('declined', '', [], { nullable: true })).toBe(false)
  })

  it('counts size, digits and decimals the way Laravel does', () => {
    expect(passes('size', 'abc', ['3'])).toBe(true)
    expect(passes('size', '3', ['3'], { type: 'numeric' })).toBe(true)
    expect(passes('size', ['a', 'b'], ['2'])).toBe(true)
    expect(passes('digits', '0123', ['4'])).toBe(true)
    expect(passes('digits', '-123', ['4'])).toBe(false)
    expect(passes('digits_between', '12345', ['2', '4'])).toBe(false)
    expect(passes('min_digits', 123, ['3'])).toBe(true)
    expect(passes('decimal', '1.50', ['2'])).toBe(true)
    expect(passes('decimal', '1.5', ['2'])).toBe(false)
    expect(passes('decimal', '1.5', ['1', '3'])).toBe(true)
  })

  it('asks the server where Laravel releases answer differently', () => {
    // in compares loosely up to 12.66 and 13.25, and exactly after.
    expect(outcome('in', '01', ['1'])).toBe('server')
    expect(outcome('not_in', '1.0', ['1'])).toBe('server')
    // The digit counts read null and booleans as text up to 13.3.
    expect(outcome('max_digits', null, ['3'])).toBe('server')
    expect(outcome('min_digits', null, ['2'])).toBe('fail')
    expect(outcome('digits', null, ['3'])).toBe('fail')
    // starts_with and its kind read null as no text up to 13.3, and fail numbers in 13.4 to 13.9.
    expect(outcome('doesnt_start_with', null, ['ab'])).toBe('server')
    expect(outcome('starts_with', null, ['ab'])).toBe('fail')
    expect(outcome('doesnt_end_with', 123, ['4'])).toBe('server')
    expect(outcome('starts_with', 123, ['4'])).toBe('fail')
    // lowercase and uppercase throw an error for a list up to 13.3.
    expect(outcome('lowercase', ['a'])).toBe('server')
  })

  it('checks lists item by item, exactly, and only with the array rule', () => {
    expect(outcome('not_in', 'b', ['a', 'b'])).toBe('fail')
    expect(outcome('not_in', 'c', ['a', 'b'])).toBe('pass')
    expect(outcome('in', ['a', 'b'], ['a', 'b'], { type: 'array' })).toBe('pass')
    expect(outcome('in', ['a', 'c'], ['a', 'b'], { type: 'array' })).toBe('fail')
    expect(outcome('in', ['01'], ['1'], { type: 'array' })).toBe('fail')
    expect(outcome('in', ['a'], ['a'])).toBe('fail')
    expect(outcome('not_in', ['a'], ['a'])).toBe('pass')
    expect(outcome('not_in', [' a '], ['a'], { type: 'array' })).toBe('fail')
  })

  it('matches Rule::enum() values the way tryFrom() reads them', () => {
    expect(passes('enum', 'pro', ['free', 'pro'])).toBe(true)
    expect(passes('enum', 'team', ['free', 'pro'])).toBe(false)
    expect(passes('enum', 2.5, ['1', '2'])).toBe(true)
    expect(passes('enum', true, ['1', '2'])).toBe(true)
    expect(passes('enum', ['1'], ['1'])).toBe(false)
  })

  it('checks how a value starts and ends', () => {
    expect(passes('starts_with', 'abc', ['x', 'ab'])).toBe(true)
    expect(passes('ends_with', 'abc', ['b'])).toBe(false)
    expect(passes('doesnt_start_with', 'admin1', ['admin'])).toBe(false)
    expect(passes('not_regex', 'Admin1', ['^admin', 'i'])).toBe(false)
    expect(passes('alpha', 'héllo', ['ascii'])).toBe(false)
  })

  it('reads a file extension the way Laravel does', () => {
    const file = (name: string) => new File(['a'], name)
    expect(passes('extensions', file('photo.JPG'), ['jpg', 'png'])).toBe(true)
    expect(passes('extensions', file('archive.tar.gz'), ['gz'])).toBe(true)
    expect(passes('extensions', file('noext'), ['jpg'])).toBe(false)
    expect(passes('extensions', file('shell.phtml'), ['phtml'])).toBe(false)
    expect(passes('extensions', file('shell.phtml'), ['php', 'phtml'])).toBe(true)
    expect(passes('extensions', 'photo.jpg', ['jpg'])).toBe(false)
  })

  it('measures size by type, like getSize()', () => {
    expect(passes('min', 'abc', ['3'])).toBe(true)
    expect(passes('min', '12', ['3'])).toBe(false)
    expect(passes('min', '12', ['3'], { type: 'numeric' })).toBe(true)
    expect(passes('max', ['a', 'b'], ['1'])).toBe(false)
    expect(passes('between', '😀😀', ['2', '2'])).toBe(true)
  })

  it('matches in options as the text PHP gives the value', () => {
    expect(outcome('in', 'b', ['a', 'b'])).toBe('pass')
    expect(outcome('in', true, ['1'])).toBe('pass')
    expect(outcome('in', 'c', ['a', 'b'])).toBe('fail')
    // PHP writes fractions its own way, so the server compares them.
    expect(outcome('in', 2.5, ['2.5'])).toBe('server')
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

  it('trims the strings inside arrays too', () => {
    expect(passes('in', [' a '], ['a'], { type: 'array' })).toBe(true)
  })

  it('trims the invisible characters Laravel trims too', () => {
    expect(passes('max', 'abc​', ['3'])).toBe(true)
    expect(passes('max', ' abc\u0085﻿', ['3'])).toBe(true)
    expect(passes('max', 'ㅤabc‍\u{E0020}', ['3'])).toBe(true)
    expect(passes('max', 'ab‍c', ['3'])).toBe(false)
    expect(normalize(' secret ', 'password')).toBe(' secret ')
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

    // Laravel 12 reads a file's temporary path for starts_with and its kind.
    const file = { x: field([['doesnt_start_with', ['a']]]) }
    expect(checkField(file, validators, 'x', { x: new File(['a'], 'a.txt') })).toEqual({ message: null, server: true })
  })
})
