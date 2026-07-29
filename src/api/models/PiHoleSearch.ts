export type PiHoleSearchDomainEntry = {
  domain: string
  comment: string | null
  enabled: boolean
  type: 'allow' | 'deny'
  kind: 'exact' | 'regex'
  id: number
  groups: number[]
}

export type PiHoleSearchGravityEntry = {
  domain: string
  address: string
  comment: string | null
  enabled: boolean
  id: number
  type: 'allow' | 'block'
  groups: number[]
}

export type PiHoleSearchResponse = {
  search: {
    domains: PiHoleSearchDomainEntry[]
    gravity: PiHoleSearchGravityEntry[]
    results: {
      domains: {
        exact: number
        regex: number
      }
      gravity: {
        allow: number
        block: number
      }
      total: number
    }
  }
}
