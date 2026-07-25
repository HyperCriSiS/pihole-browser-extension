export type PiHoleGroup = {
  name: string
  comment: string | null
  enabled: boolean
  id: number
  date_added: number
  date_modified: number
}

export type PiHoleGroups = {
  groups: PiHoleGroup[]
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
