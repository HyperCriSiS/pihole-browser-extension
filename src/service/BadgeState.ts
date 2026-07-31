export type GlobalToolbarIconState = 'active' | 'disabled' | 'error' | 'unknown'

export type DomainToolbarIconState =
  | 'allowed'
  | 'blocked'
  | 'temporary'
  | 'unknown'

export type ToolbarIconState = GlobalToolbarIconState | 'blocked' | 'temporary'

export const composeToolbarIconState = (
  globalState: GlobalToolbarIconState,
  domainState: DomainToolbarIconState,
): ToolbarIconState => {
  if (globalState === 'disabled' || globalState === 'error') {
    return globalState
  }

  if (globalState !== 'active') {
    return 'unknown'
  }

  if (domainState === 'temporary') {
    return 'temporary'
  }

  if (domainState === 'blocked') {
    return 'blocked'
  }

  if (domainState === 'allowed') {
    return 'active'
  }

  return 'unknown'
}
