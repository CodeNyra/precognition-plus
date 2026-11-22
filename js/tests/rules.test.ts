import { describe, expect, it } from 'vitest'
import { browserRules } from '../src/browser_rules'
import { checkField, received, schemaKey } from '../src/core/engine'
import type { RuleValidators } from '../src/core/types'
import { normalize } from '../src/core/utils'
import { field } from './fixtures'

const passes = (rule: string, value: unknown, params: string[] = [], extra = {}) =>
  checkField({ x: field([[rule, params]], extra) }, browserRules, 'x', { x: value }).message === null

const outcome = (rule: string, value: unknown, params: string[] = [], extra = {}, attribute = 'x', data: Record<string, unknown> = {}) => {
  const result = checkField({ [attribute]: field([[rule, params]], extra) }, browserRules, attribute, { ...data, [attribute]: value })
  return result.message !== null ? 'fail' : result.server ? 'server' : 'pass'
}

describe('rules match Laravel', () => {
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
    ['alpha', 'hello', true],
    ['alpha', 'abc1', false],
    ['alpha_dash', 'a-b_1', true],
    ['alpha_dash', 'a b', false],
    ['alpha_num', 'abc123', true],
    ['alpha_num', 'abc-1', false],
    ['lowercase', 'abc', true],
    ['lowercase', 'Abc', false],
    ['uppercase', 'ABC', true],
    ['uppercase', 'ABc', false],
    ['uuid', '123e4567-e89b-12d3-a456-426614174000', true],
    ['uuid', '{123e4567-e89b-12d3-a456-426614174000}', false],
    ['ulid', '01ARZ3NDEKTSV4RRFFQ69G5FAV', true],
    ['ulid', '81ARZ3NDEKTSV4RRFFQ69G5FAV', false],
  ])('%s(%j) => %s', (rule, value, expected) => {
    expect(passes(rule, value)).toBe(expected)
  })

  it('runs accepted and declined on empty fields', () => {
    expect(checkField({ x: field([['accepted']]) }, browserRules, 'x', {}).message).toBe('accepted failed')
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

  it('asks the server where Laravel releases disagree', () => {
    // in compares loosely up to 12.66 and 13.25, and strictly after that.
    expect(outcome('in', '01', ['1'])).toBe('server')
    expect(outcome('not_in', '1.0', ['1'])).toBe('server')
  })

  it('only checks text rules on text and whole numbers', () => {
    expect(outcome('in', 5, ['5'])).toBe('pass')
    expect(outcome('not_in', 5, ['5'])).toBe('fail')
    expect(outcome('digits', 123, ['3'])).toBe('pass')
    expect(outcome('max_digits', 1234, ['3'])).toBe('fail')
    expect(outcome('integer', -7)).toBe('pass')
    expect(outcome('decimal', 12, ['0'])).toBe('pass')
    expect(outcome('max', 12345, ['3'])).toBe('fail')
    // PHP turns true, false and null into text its own way, and releases disagree on some of them,
    // so the server decides. Only the size rules take lists, by counting them.
    for (const value of [true, false, null, ['1']]) {
      expect(outcome('in', value, ['1'])).toBe('server')
      expect(outcome('not_in', value, ['1'])).toBe('server')
      expect(outcome('digits', value, ['1'])).toBe('server')
      expect(outcome('min_digits', value, ['1'])).toBe('server')
      expect(outcome('decimal', value, ['0'])).toBe('server')
      expect(outcome('integer', value)).toBe('server')
    }
    for (const value of [true, false, null]) expect(outcome('max', value, ['1'])).toBe('server')
  })

  it('only checks letter and case rules on ASCII', () => {
    expect(outcome('alpha', 'héllo')).toBe('server')
    expect(outcome('alpha', 'héllo', ['ascii'])).toBe('fail')
    expect(outcome('alpha_dash', '١٢٣')).toBe('server')
    expect(outcome('alpha_num', 123)).toBe('pass')
    expect(outcome('alpha', 123)).toBe('fail')
    expect(outcome('lowercase', 'abc1')).toBe('pass')
    expect(outcome('lowercase', 'été')).toBe('server')
    expect(outcome('uppercase', 'ß')).toBe('server')
    // Releases up to 13.3 throw an error for a list.
    for (const value of [5, true, null, ['a']]) {
      expect(outcome('lowercase', value)).toBe('server')
      expect(outcome('uppercase', value)).toBe('server')
    }
  })

  it('only checks starts_with and friends on strings', () => {
    expect(outcome('starts_with', 'abc', ['ab'])).toBe('pass')
    expect(outcome('doesnt_end_with', 'abc', ['bc'])).toBe('fail')
    for (const value of [123, true, null, ['1']]) {
      expect(outcome('starts_with', value, ['1'])).toBe('server')
      expect(outcome('doesnt_start_with', value, ['1'])).toBe('server')
    }
  })

  it('matches Rule::enum() values only where tryFrom() is unambiguous', () => {
    // A string-backed enum compares the text exactly, and a whole number as its digits.
    const strings = ['string', 'free', 'pro', '1']
    expect(outcome('enum', 'pro', strings)).toBe('pass')
    expect(outcome('enum', 'team', strings)).toBe('fail')
    expect(outcome('enum', '01', strings)).toBe('fail')
    expect(outcome('enum', 1, strings)).toBe('pass')

    // An int-backed enum is checked here for plain integers of up to 18 digits.
    const integers = ['int', '0', '1', '-3']
    expect(outcome('enum', '1', integers)).toBe('pass')
    expect(outcome('enum', -3, integers)).toBe('pass')
    expect(outcome('enum', '7', integers)).toBe('fail')

    // tryFrom() reads anything else with PHP's weak typing, so the server decides.
    for (const value of ['01', '-0', '1.0', '1e0', 'abc', '1'.repeat(19)]) expect(outcome('enum', value, integers)).toBe('server')
    for (const value of [1.9, true, false, null, ['1']]) {
      expect(outcome('enum', value, strings)).toBe('server')
      expect(outcome('enum', value, integers)).toBe('server')
    }
  })

  it("compares text confirmations with PHP's ===", () => {
    const confirmed = (value: unknown, confirmation?: unknown) =>
      outcome('confirmed', value, ['x_confirmation'], {}, 'x', confirmation === undefined ? {} : { x_confirmation: confirmation })
    expect(confirmed('secret', 'secret')).toBe('pass')
    expect(confirmed('secret', 'other')).toBe('fail')
    expect(confirmed('secret')).toBe('fail')
    expect(confirmed('secret', '')).toBe('fail')
    expect(confirmed(null, null)).toBe('pass')
    // A Date is compared as the text JSON sends.
    expect(confirmed('a', new Date())).toBe('fail')
    // Numbers, booleans and lists go to the server.
    expect(confirmed(1, '1')).toBe('server')
    expect(confirmed('1', 1)).toBe('server')
    expect(confirmed(true, true)).toBe('server')
    expect(confirmed(['a'], ['a'])).toBe('server')
  })

  it('checks how a value starts and ends', () => {
    expect(passes('starts_with', 'abc', ['x', 'ab'])).toBe(true)
    expect(passes('ends_with', 'abc', ['b'])).toBe(false)
    expect(passes('doesnt_start_with', 'admin1', ['admin'])).toBe(false)
    expect(passes('not_regex', 'Admin1', ['^admin', 'i'])).toBe(false)
  })

  it('only checks email where every Laravel release agrees', () => {
    expect(outcome('email', 'taylor@laravel.com')).toBe('pass')
    expect(outcome('email', 'a+b@sub.example.co.uk')).toBe('pass')
    expect(outcome('email', 'user@localhost')).toBe('pass')
    expect(outcome('email', `a@x.${'x'.repeat(62)}`)).toBe('pass')
    expect(outcome('email', 'a..b@example.com')).toBe('fail')
    expect(outcome('email', '.a@example.com')).toBe('fail')
    expect(outcome('email', 'a@-example.com')).toBe('fail')
    expect(outcome('email', 'a@example.com.')).toBe('fail')
    expect(outcome('email', '@example.com')).toBe('fail')
    expect(outcome('email', 'taylor')).toBe('fail')
    expect(outcome('email', 5)).toBe('fail')
    // Quoted text, IP addresses, letters beyond ASCII, and lengths near egulias's and Laravel's limits.
    expect(outcome('email', '"john doe"@example.com')).toBe('server')
    expect(outcome('email', 'a@[127.0.0.1]')).toBe('server')
    expect(outcome('email', 'josé@example.com')).toBe('server')
    expect(outcome('email', `a@x.${'x'.repeat(63)}`)).toBe('server')
    expect(outcome('email', `a@${'x.'.repeat(126)}x`)).toBe('server')
    // egulias fails IPv6 as a word in the domain, and allows a hyphen right after a dot.
    expect(outcome('email', 'x@IPv6Forum.com')).toBe('server')
    expect(outcome('email', 'IPv6@example.com')).toBe('pass')
    expect(outcome('email', 'me@example.-com')).toBe('server')
    expect(outcome('email', 'a@example-.com')).toBe('fail')
  })

  it('measures size by type, like getSize()', () => {
    expect(passes('min', 'abc', ['3'])).toBe(true)
    expect(passes('min', '12', ['3'])).toBe(false)
    expect(passes('min', '12', ['3'], { type: 'numeric' })).toBe(true)
    expect(passes('max', ['a', 'b'], ['1'])).toBe(false)
    expect(passes('between', '😀😀', ['2', '2'])).toBe(true)
  })

  it('reads numbers the way PHP receives and writes them', () => {
    // A whole number arrives as an integer, within 64 bits, and a larger one as a float.
    expect(outcome('integer', 2 ** 60)).toBe('pass')
    expect(outcome('integer', 2 ** 63)).toBe('server')
    expect(outcome('regex', -(2 ** 63), ['^-?\\d+$', ''])).toBe('server')
    expect(outcome('regex', -(2 ** 62), ['^-?\\d+$', ''])).toBe('pass')
    expect(outcome('integer', '9223372036854775807')).toBe('pass')
    expect(outcome('integer', '9223372036854775808')).toBe('fail')
    expect(outcome('integer', '\f42', [], {}, 'password')).toBe('fail')
    // PHP writes a fraction with its own precision, so rules that read it as text ask the server.
    expect(outcome('integer', 1.5)).toBe('server')
    expect(outcome('regex', 1.5, ['^\\d+$', ''])).toBe('server')
    expect(outcome('regex', 123, ['^\\d+$', ''])).toBe('pass')
    expect(outcome('decimal', 9.99, ['2'])).toBe('server')
    expect(outcome('decimal', '9.99', ['2'])).toBe('pass')
    // PHP's $ also matches before a final line break, which only an untrimmed field can have.
    expect(outcome('decimal', '9.99\n', ['2'], {}, 'password')).toBe('server')
    expect(outcome('min', 1.5, ['2'])).toBe('server')
    // NaN and Infinity arrive as null.
    expect(outcome('required', Number.NaN)).toBe('fail')
  })

  it('compares sizes exactly, as brick/math does', () => {
    expect(outcome('max', '0.30000000000000001', ['0.3'], { type: 'numeric' })).toBe('fail')
    expect(outcome('size', '0.3', ['0.30'], { type: 'numeric' })).toBe('pass')
    // JSON writes 2 ** 60 as 1152921504606847000, and that is the integer Laravel gets.
    expect(outcome('max', 2 ** 60, ['1152921504606847000'], { type: 'numeric' })).toBe('pass')
    expect(outcome('max', 2 ** 60, ['1152921504606846999'], { type: 'numeric' })).toBe('fail')
    // An exponent goes through a range check that apps can change.
    expect(outcome('max', '1e5', ['10'], { type: 'numeric' })).toBe('server')
  })

  it('matches in options against the value as PHP writes it', () => {
    expect(outcome('in', 'b', ['a', 'b'])).toBe('pass')
    expect(outcome('in', 2, ['1', '2'])).toBe('pass')
    expect(outcome('in', 'c', ['a', 'b'])).toBe('fail')
    // PHP writes fractions its own way, so the server compares them.
    expect(outcome('in', 2.5, ['2.5'])).toBe('server')
  })

  it('asks the server about text PHP matches differently', () => {
    // PHP matches bytes, its . also matches \r, and its $ also matches before a final line break.
    expect(outcome('regex', 'é', ['^.$', ''])).toBe('server')
    expect(outcome('regex', 'a\rb', ['^a.b$', ''])).toBe('server')
    expect(outcome('regex', 'a\n', ['^a$', ''], {}, 'password')).toBe('server')
    expect(outcome('regex', 'abc', ['^a.c$', ''])).toBe('pass')
  })

  it('asks the server about regex input over 255 characters', () => {
    expect(outcome('regex', 'a'.repeat(255), ['^a+$', ''])).toBe('pass')
    expect(outcome('not_regex', '<'.repeat(256), ['<[^>]*>', ''])).toBe('server')
  })

  it('runs the patterns PHP sends as is', () => {
    expect(passes('regex', 'ABC', ['^[a-z]+$', 'i'])).toBe(true)
    expect(passes('regex', 'AB1', ['^[a-z]+$', 'i'])).toBe(false)
    expect(outcome('regex', 'a\nb', ['^a.b$', 's'])).toBe('pass')
    expect(outcome('regex', 'a\nb', ['^a.b$', ''])).toBe('fail')
  })
})

describe('the engine', () => {
  it('treats empty strings as null, like ConvertEmptyStringsToNull', () => {
    expect(passes('string', '')).toBe(false)
    expect(passes('string', '', [], { nullable: true })).toBe(true)
    expect(passes('min', '  ab  ', ['3'])).toBe(false)
  })

  it('trims strings inside arrays too', () => {
    expect(normalize([' a ', { b: ' ' }], 'x')).toEqual(['a', { b: null }])
  })

  it('trims the same invisible characters as Laravel', () => {
    expect(passes('max', 'abc\u200B', ['3'])).toBe(true)
    expect(passes('max', '\u00A0abc\u0085\uFEFF', ['3'])).toBe(true)
    expect(passes('max', '\u3164abc\u200D\u{E0020}', ['3'])).toBe(true)
    expect(passes('max', 'ab\u200Dc', ['3'])).toBe(false)
    expect(normalize(' secret ', 'password')).toBe(' secret ')
  })

  it('asks the server about text over 100,000 characters', () => {
    expect(outcome('max', 'a'.repeat(100_000), ['100000'])).toBe('pass')
    expect(outcome('max', 'a'.repeat(100_001), ['200000'])).toBe('server')
    expect(outcome('confirmed', 'a', ['x_confirmation'], {}, 'x', { x_confirmation: 'a'.repeat(100_001) })).toBe('server')
    // Text inside arrays and objects counts too.
    expect(outcome('required', ['a'.repeat(100_001)])).toBe('server')
    expect(outcome('required', { a: 'a'.repeat(50_001), b: ['a'.repeat(50_000)] })).toBe('server')
    expect(outcome('confirmed', 'a', ['x_confirmation'], {}, 'x', { x_confirmation: ['a'.repeat(100_001)] })).toBe('server')
  })

  it('stays linear on long input', () => {
    const start = performance.now()
    // Just under the 100,000-character limit for browser checks.
    const spaces = ' '.repeat(99_000)
    const digits = '1'.repeat(99_000)
    expect(normalize(` a${spaces}b `, 'x')).toBe(`a${spaces}b`)
    expect(outcome('required', `a${spaces}b`, [], {}, 'password')).toBe('pass')
    expect(outcome('decimal', `${digits} `, ['0'], {}, 'password')).toBe('fail')
    expect(outcome('max', `${digits}\f`, ['9'], { type: 'numeric' }, 'password')).toBe('server')
    expect(schemaKey('post', `/a${'/'.repeat(99_000)}b`)).toBe(`post http://localhost/a${'/'.repeat(99_000)}b`)
    expect(outcome('in', digits, Array.from({ length: 100_000 }, (_, i) => String(i)))).toBe('fail')
    // The regexes these replaced took seconds each, and in took a minute. Now it's tens of
    // milliseconds. vitest only reports a test's time once it ends, so the test times itself.
    expect(performance.now() - start).toBeLessThan(3000)
  })

  it('only runs implicit rules on text PHP trims to nothing', () => {
    expect(outcome('min', '   ', ['8'], {}, 'password')).toBe('pass')
    expect(outcome('required', '   ', [], {}, 'password')).toBe('fail')
    expect(outcome('min', '\u00A0', ['8'], {}, 'password')).toBe('fail')
  })

  it("sends the whole field to the server when one rule can't run here", () => {
    // On releases where in fails, Laravel shows its message, not max's.
    const result = checkField({ x: field([['in', ['1', '2']], ['max', ['1']]]) }, browserRules, 'x', { x: '01' })
    expect(result).toEqual({ message: null, server: true })
  })

  it('sends a failing array to the server when a later rule could throw on it', () => {
    // string fails on a list, and lowercase throws on one in Laravel 12.53 to 13.3.
    expect(checkField({ x: field([['string'], ['lowercase']]) }, browserRules, 'x', { x: ['a'] })).toEqual({ message: null, server: true })
    // So can a server rule, wherever it sits.
    expect(checkField({ x: field([['string']], { server: true }) }, browserRules, 'x', { x: { a: 1 } })).toEqual({ message: null, server: true })
    expect(checkField({ x: field([['string']]) }, browserRules, 'x', { x: ['a'] })).toEqual({ message: 'string failed', server: false })
    expect(checkField({ x: field([['required'], ['max', ['3']]], { server: true }) }, browserRules, 'x', {})).toEqual({ message: 'required failed', server: true })
  })

  it('sends a failing number or boolean to the server when the field has server rules', () => {
    // A date rule after max throws on 1e15 in Laravel.
    const big = { x: field([['max', ['9999']]], { server: true, type: 'numeric' }) }
    expect(checkField(big, browserRules, 'x', { x: 1e15 })).toEqual({ message: null, server: true })
    expect(checkField({ x: field([['accepted']], { server: true }) }, browserRules, 'x', { x: false })).toEqual({ message: null, server: true })
    expect(checkField(big, browserRules, 'x', { x: '1000000' })).toEqual({ message: 'max failed', server: true })
    expect(checkField({ x: field([['max', ['9999']]], { type: 'numeric' }) }, browserRules, 'x', { x: 1e15 }).message).toBe('max failed')
  })

  it('skips a missing field with sometimes', () => {
    const nickname = { x: field([['required'], ['max', ['5']]], { sometimes: true }) }
    expect(checkField(nickname, browserRules, 'x', {})).toEqual({ message: null, server: false })
    expect(checkField(nickname, browserRules, 'x', { x: null }).message).toBe('required failed')
    expect(checkField({ x: field([['required']]) }, browserRules, 'x', {}).message).toBe('required failed')
  })

  it('skips non-implicit rules for a missing value', () => {
    expect(checkField({ x: field([['email']]) }, browserRules, 'x', {}).message).toBeNull()
  })

  it('returns the first failing message', () => {
    const result = checkField({ x: field([['required'], ['email']]) }, browserRules, 'x', { x: '' })
    expect(result).toEqual({ message: 'required failed', server: false })
  })

  it('leaves names with an escaped dot to the server', () => {
    expect(checkField({ 'a\\.b': field([['required']]) }, browserRules, 'a\\.b', { 'a.b': 'x' }).server).toBe(true)
    const confirm = { x: field([['confirmed', ['x\\.again']]]) }
    expect(checkField(confirm, browserRules, 'x', { x: 'a', 'x.again': 'a' }).server).toBe(true)
  })

  it('reads only keys and indexes that would actually be sent', () => {
    expect(checkField({ 'items.length': field([['required']]) }, browserRules, 'items.length', { items: [] }).message).toBe('required failed')
    const hidden = Object.defineProperty({}, 'code', { value: 'abc', enumerable: false })
    expect(checkField({ 'form.code': field([['required']]) }, browserRules, 'form.code', { form: hidden }).message).toBe('required failed')
    expect(checkField({ 'items.01': field([['required']]) }, browserRules, 'items.01', { items: ['a', 'b'] }).message).toBe('required failed')
  })

  it('asks the server about missing fields when the URL has a query string', () => {
    const schema = { name: field([['required']]), 'user.name': field([['required']]) }
    expect(checkField(schema, browserRules, 'name', {}, received({}, true)).server).toBe(true)
    expect(checkField(schema, browserRules, 'name', { name: '' }, received({ name: '' }, true)).message).toBe('required failed')
    // Laravel fills only top-level fields from the query string.
    expect(checkField(schema, browserRules, 'user.name', { user: {} }, received({ user: {} }, true)).message).toBe('required failed')
    expect(checkField(schema, browserRules, 'name', {}).message).toBe('required failed')
  })

  it('keys rules by method, origin, path and query string', () => {
    expect(schemaKey('POST', 'https://a.example/users/?team=1')).toBe('post https://a.example/users?team=1')
    expect(schemaKey('post', 'https://a.example/users')).not.toBe(schemaKey('post', 'https://b.example/users'))
  })

  it('leaves fields without rules to the server', () => {
    expect(checkField({}, browserRules, 'items.0.sku', { items: [{ sku: 'a' }] })).toEqual({ message: null, server: true })
  })

  it('reads only own keys, so names like constructor are safe', () => {
    expect(checkField({}, browserRules, 'constructor', {})).toEqual({ message: null, server: true })
    expect(checkField({ constructor: field([['required']]) }, browserRules, 'constructor', {}).message).toBe('required failed')
  })

  it('falls back to the server for unknown rules and broken patterns', () => {
    const missing: RuleValidators = { required: browserRules.required }
    expect(checkField({ x: field([['required'], ['email']]) }, missing, 'x', { x: 'a' }).server).toBe(true)

    const invalidPattern = { x: field([['regex', ['(?<!', '']]]) }
    expect(checkField(invalidPattern, browserRules, 'x', { x: 'a' })).toEqual({ message: null, server: true })
  })

  it('leaves every file to the server', () => {
    const file = new File(['a'], 'photo.jpg')
    expect(outcome('required', file)).toBe('server')
    expect(outcome('max', [file], ['2'])).toBe('server')
    expect(outcome('required', null)).toBe('fail')
  })

  it('checks the data as JSON encodes it', () => {
    expect(outcome('max', new Date(0), ['23'])).toBe('fail')
    expect(outcome('max', new Date(0), ['24'])).toBe('pass')
    expect(outcome('max', [new Date()], ['1'])).toBe('pass')
    expect(outcome('required', new Map([['a', 1]]))).toBe('fail')
    expect(outcome('required', { street: undefined, open: () => true })).toBe('fail')
    expect(outcome('max', { toJSON: () => 'abcdef' }, ['3'])).toBe('fail')
    expect(outcome('size', { a: 1, b: 2 }, ['2'])).toBe('pass')
    // undefined in a list arrives as null.
    expect(checkField({ 'tags.0': field([['string']]) }, browserRules, 'tags.0', { tags: [undefined, 'a'] }).message).toBe('string failed')
  })

  it("asks the server about everything for files and bodies over PHP's limit", () => {
    const server = (data: Record<string, unknown>) => checkField({ name: field([['required']]) }, browserRules, 'name', { name: '', ...data }).server
    // A form with a file, which goes as multipart, and a body bigger than PHP accepts by default.
    expect(server({ avatar: new File(['a'], 'a.jpg') })).toBe(true)
    expect(server({ bio: 'a'.repeat(2_800_000) })).toBe(true)
  })

  it("asks the server about everything when JSON can't encode the data", () => {
    // JSON can't write a BigInt.
    expect(checkField({ name: field([['required']]) }, browserRules, 'name', { name: '', views: 5n }).server).toBe(true)
    expect(checkField({ name: field([['required']]) }, browserRules, 'name', { name: '', bio: 'x😀' }).message).toBe('required failed')
  })

  it('leaves a form holding FormData to the server', () => {
    expect(received({ name: 'Taylor', extra: new FormData() })).toBeNull()
    expect(received({ name: 'Taylor' })).not.toBeNull()
  })

})
