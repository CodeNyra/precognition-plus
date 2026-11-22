import { askServer } from '../core/rule_helpers'
import type { RuleValidator } from '../core/types'

// egulias/email-validator's RFC check, decided here only where every release agrees. Plain addresses
// pass, obviously broken ones fail, and everything else goes to the server.
const ATOM = "[A-Za-z0-9!#$%&'*+/=?^_`{|}~-]+"
const LABEL = '[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?'
const PLAIN = new RegExp(`^${ATOM}(?:\\.${ATOM})*@${LABEL}(?:\\.${LABEL})*$`)
const SIMPLE = /^[A-Za-z0-9!#$%&'*+\/=?^_`{|}~.-]*@[A-Za-z0-9.-]*$/

// Addresses past egulias's length limits go to the server, and so do ones over 254 characters,
// which Laravel rejects from 12.72 and 13.43.
function fits(address: string): boolean {
  const [local, domain] = address.split('@')
  const [first, ...rest] = domain.split('.')
  return address.length <= 254 && local.length <= 64 && first.length <= 63 && rest.every((label) => label.length <= 62)
}

export const email: RuleValidator = (value) => {
  if (typeof value !== 'string' || !value.includes('@')) return false
  // egulias handles these two in its own way.
  const domain = value.slice(value.lastIndexOf('@') + 1)
  if (domain.includes('IPv6') || domain.includes('.-')) return askServer()
  if (PLAIN.test(value)) return fits(value) || askServer()
  return SIMPLE.test(value) ? false : askServer()
}
