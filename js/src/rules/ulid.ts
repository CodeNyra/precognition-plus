import type { RuleValidator } from '../core/types'

export const ulid: RuleValidator = (value) => typeof value === 'string' && /^[0-7][0-9A-HJKMNP-TV-Za-hjkmnp-tv-z]{25}$/.test(value)
