export interface ClientRule {
  rule: string
  params: string[]
  message: string
}

export type SizeType = 'string' | 'numeric' | 'array' | 'file'

export interface FieldSchema {
  rules: ClientRule[]
  server: boolean
  nullable: boolean
  type: SizeType
  sometimes?: boolean
  depends?: string[]
}

export type ValidationSchema = Record<string, FieldSchema>

export interface RuleContext {
  field: FieldSchema
  other(path: string): unknown
}

export type RuleValidator = (value: unknown, rule: ClientRule, context: RuleContext) => boolean

export type RuleValidators = Record<string, RuleValidator>

export type FieldResult = { message: string | null; server: boolean }

