import type { PiHoleSearchResponse } from '../api/models/PiHoleSearch'

export type DomainBlockingState = 'blocked' | 'allowed' | 'unknown'

const appliesToGroup = (groups: number[], groupId: number): boolean =>
  groups.includes(groupId)

export const evaluateDomainSearch = (
  response: PiHoleSearchResponse,
  groupId: number,
): DomainBlockingState => {
  const domainEntries = response.search.domains.filter(
    (entry) => entry.enabled && appliesToGroup(entry.groups, groupId),
  )
  const gravityEntries = response.search.gravity.filter(
    (entry) => entry.enabled && appliesToGroup(entry.groups, groupId),
  )

  if (
    domainEntries.some(
      (entry) => entry.type === 'allow' && entry.kind === 'exact',
    )
  ) {
    return 'allowed'
  }

  if (
    domainEntries.some(
      (entry) => entry.type === 'allow' && entry.kind === 'regex',
    )
  ) {
    return 'allowed'
  }

  if (
    domainEntries.some(
      (entry) => entry.type === 'deny' && entry.kind === 'exact',
    )
  ) {
    return 'blocked'
  }

  if (gravityEntries.some((entry) => entry.type === 'allow')) {
    return 'allowed'
  }

  if (gravityEntries.some((entry) => entry.type === 'block')) {
    return 'blocked'
  }

  if (
    domainEntries.some(
      (entry) => entry.type === 'deny' && entry.kind === 'regex',
    )
  ) {
    return 'blocked'
  }

  return 'allowed'
}

export const combineDomainStates = (
  states: DomainBlockingState[],
): DomainBlockingState => {
  if (states.some((state) => state === 'blocked')) {
    return 'blocked'
  }

  if (states.length > 0 && states.every((state) => state === 'allowed')) {
    return 'allowed'
  }

  return 'unknown'
}
