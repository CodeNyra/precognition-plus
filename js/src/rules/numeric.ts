import type { RuleValidator } from '../core/types'
import { isNumeric } from '../core/utils'

export const numeric: RuleValidator = (value) => isNumeric(value)
