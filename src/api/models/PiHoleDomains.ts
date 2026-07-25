export type PiHoleDomain = {
  domain: string
  unicode: string
  type: string
  kind: string
  comment: string | null
  groups: number[]
  enabled: boolean
  id: number
  date_added: number
  date_modified: number
}

export type PiHoleDomains = {
  domains: PiHoleDomain[]
  processed?: {
    errors: Array<{
      item: string
      error?: string
    }>
    success: Array<{
      item: string
    }>
  } | null
  took: number
}
