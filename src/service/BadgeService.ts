import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import {
  composeToolbarIconState,
  type GlobalToolbarIconState,
  type ToolbarIconState,
} from './BadgeState'

export enum ExtensionBadgeTextEnum {
  enabled = 'On',
  enabledBlocked = 'On!',
  disabled = 'Off',
  error = 'Err',
  info = 'Info',
  ok = 'Ok',
}

type IconDetails = {
  path: Record<number, string>
  tabId?: number
}

type BadgeDetails = {
  text: string
  tabId?: number
}

type ToolbarActionApi = {
  setIcon: (details: IconDetails) => void | Promise<void>
  setBadgeText: (details: BadgeDetails) => void | Promise<void>
}

/**
 * Cross-browser toolbar icon service.
 *
 * Status markers are rendered into dedicated icons because native browser
 * badges are disproportionately large in some Firefox-based browsers.
 *
 * The legacy class and method names remain available so existing callers do not
 * break.
 */
export class BadgeService {
  private static readonly actionApi = (chrome.action ||
    chrome.browserAction) as ToolbarActionApi

  private static readonly iconPaths: Record<
    ToolbarIconState,
    Record<number, string>
  > = {
    unknown: {
      16: 'icon/toolbar/unknown-16.png',
      32: 'icon/toolbar/unknown-32.png',
      48: 'icon/toolbar/unknown-48.png',
    },
    active: {
      16: 'icon/toolbar/active-16.png',
      32: 'icon/toolbar/active-32.png',
      48: 'icon/toolbar/active-48.png',
    },
    blocked: {
      16: 'icon/toolbar/blocked-16.png',
      32: 'icon/toolbar/blocked-32.png',
      48: 'icon/toolbar/blocked-48.png',
    },
    temporary: {
      16: 'icon/toolbar/temporary-16.png',
      32: 'icon/toolbar/temporary-32.png',
      48: 'icon/toolbar/temporary-48.png',
    },
    disabled: {
      16: 'icon/toolbar/disabled-16.png',
      32: 'icon/toolbar/disabled-32.png',
      48: 'icon/toolbar/disabled-48.png',
    },
    error: {
      16: 'icon/toolbar/error-16.png',
      32: 'icon/toolbar/error-32.png',
      48: 'icon/toolbar/error-48.png',
    },
  }

  private static globalState: GlobalToolbarIconState = 'unknown'

  private static readonly tabStates = new Map<number, ToolbarIconState>()

  public static setBadgeText(
    text: ExtensionBadgeTextEnum | string,
    tabId?: number,
  ): void {
    if (text === ExtensionBadgeTextEnum.info) {
      this.clearVisibleBadge(tabId)
      return
    }

    const state = this.convertBadgeTextToIconState(text)

    if (typeof tabId === 'undefined') {
      this.globalState = state === 'blocked' ? 'active' : state
    }

    this.setIconState(state, tabId)
  }

  public static setGlobalStatus(status: PiHoleApiStatusEnum): void {
    this.globalState = this.convertApiStatusToIconState(status)
    this.setIconState(this.globalState)
  }

  public static clearBadge(tabId?: number): void {
    if (typeof tabId === 'undefined') {
      this.globalState = 'unknown'
    }

    this.setIconState('unknown', tabId)
  }

  public static async setDomainBlockedBadge(
    tabId: number,
    blocked: boolean,
  ): Promise<void> {
    await this.setDomainStatusIcon(
      tabId,
      blocked ? 'blocked' : 'allowed',
      false,
    )
  }

  public static setDomainStatusIcon(
    tabId: number,
    domainState: 'allowed' | 'blocked' | 'unknown',
    temporary: boolean,
  ): Promise<void> {
    const iconState = composeToolbarIconState(
      this.globalState,
      temporary ? 'temporary' : domainState,
    )
    this.setIconState(iconState, tabId)
    return Promise.resolve()
  }

  public static getBadgeText(tabId?: number): Promise<ExtensionBadgeTextEnum> {
    const state =
      typeof tabId === 'undefined'
        ? this.globalState
        : this.tabStates.get(tabId) || this.globalState

    return Promise.resolve(this.convertIconStateToBadgeText(state))
  }

  public static compareBadgeTextToApiStatusEnum(
    badgeText: ExtensionBadgeTextEnum,
    apiStatus: PiHoleApiStatusEnum,
  ): boolean {
    switch (badgeText) {
      case ExtensionBadgeTextEnum.enabled:
      case ExtensionBadgeTextEnum.enabledBlocked:
        return apiStatus === PiHoleApiStatusEnum.enabled
      case ExtensionBadgeTextEnum.disabled:
        return apiStatus === PiHoleApiStatusEnum.disabled
      default:
        return false
    }
  }

  private static setIconState(state: ToolbarIconState, tabId?: number): void {
    const details: IconDetails = {
      path: this.iconPaths[state],
    }

    if (typeof tabId !== 'undefined') {
      details.tabId = tabId
      this.tabStates.set(tabId, state)
    }

    this.clearVisibleBadge(tabId)
    this.actionApi.setIcon(details)
  }

  private static clearVisibleBadge(tabId?: number): void {
    const details: BadgeDetails = { text: '' }
    if (typeof tabId !== 'undefined') {
      details.tabId = tabId
    }
    this.actionApi.setBadgeText(details)
  }

  private static convertApiStatusToIconState(
    status: PiHoleApiStatusEnum,
  ): GlobalToolbarIconState {
    if (status === PiHoleApiStatusEnum.enabled) {
      return 'active'
    }
    if (status === PiHoleApiStatusEnum.disabled) {
      return 'disabled'
    }
    if (status === PiHoleApiStatusEnum.error) {
      return 'error'
    }
    return 'unknown'
  }

  private static convertBadgeTextToIconState(
    input: ExtensionBadgeTextEnum | string,
  ): GlobalToolbarIconState | 'blocked' {
    switch (input) {
      case ExtensionBadgeTextEnum.enabled:
      case ExtensionBadgeTextEnum.ok:
        return 'active'
      case ExtensionBadgeTextEnum.enabledBlocked:
        return 'blocked'
      case ExtensionBadgeTextEnum.disabled:
        return 'disabled'
      case ExtensionBadgeTextEnum.error:
        return 'error'
      default:
        return 'unknown'
    }
  }

  private static convertIconStateToBadgeText(
    state: ToolbarIconState,
  ): ExtensionBadgeTextEnum {
    switch (state) {
      case 'active':
      case 'temporary':
        return ExtensionBadgeTextEnum.enabled
      case 'blocked':
        return ExtensionBadgeTextEnum.enabledBlocked
      case 'disabled':
        return ExtensionBadgeTextEnum.disabled
      default:
        return ExtensionBadgeTextEnum.error
    }
  }
}
