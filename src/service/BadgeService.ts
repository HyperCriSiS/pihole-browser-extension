import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'

export enum ExtensionBadgeTextEnum {
  enabled = 'On',
  disabled = 'Off',
  error = 'Err',
  info = 'Info',
  ok = 'Ok',
}

type BadgeDetails = {
  text: string
  tabId?: number
}

type BadgeColorDetails = {
  color: string
  tabId?: number
}

/**
 * Cross-browser wrapper for the Chromium action and Firefox browserAction APIs.
 */
export class BadgeService {
  private static readonly actionApi = chrome.action || chrome.browserAction

  public static setBadgeText(
    text: ExtensionBadgeTextEnum | string,
    tabId?: number,
  ): void {
    const badgeDetails: BadgeDetails = { text }
    const colorDetails: BadgeColorDetails = {
      color: this.getColorForBadgeTextEnum(text),
    }

    if (typeof tabId !== 'undefined') {
      badgeDetails.tabId = tabId
      colorDetails.tabId = tabId
    }

    if (typeof browser !== 'undefined') {
      const firefoxDetails =
        typeof tabId === 'undefined' ? { color: 'white' } : { color: 'white', tabId }
      browser.browserAction.setBadgeTextColor(firefoxDetails).catch(() => undefined)
    }

    this.actionApi.setBadgeBackgroundColor(colorDetails)
    this.actionApi.setBadgeText(badgeDetails)
  }

  public static clearBadge(tabId?: number): void {
    this.setBadgeText('', tabId)
  }

  public static setDomainBlockedBadge(tabId: number, blocked: boolean): void {
    if (!blocked) {
      this.clearBadge(tabId)
      return
    }

    const details: BadgeColorDetails = { color: '#d32f2f', tabId }
    this.actionApi.setBadgeBackgroundColor(details)

    if (typeof browser !== 'undefined') {
      browser.browserAction
        .setBadgeTextColor({ color: 'white', tabId })
        .catch(() => undefined)
    }

    this.actionApi.setBadgeText({ text: '!', tabId })
  }

  public static getBadgeText(tabId?: number): Promise<ExtensionBadgeTextEnum> {
    return new Promise((resolve) => {
      const details = typeof tabId === 'undefined' ? {} : { tabId }
      this.actionApi.getBadgeText(details, (result: string) => {
        resolve(this.convertStringToBadgeTextEnum(result))
      })
    })
  }

  public static compareBadgeTextToApiStatusEnum(
    badgeText: ExtensionBadgeTextEnum,
    apiStatus: PiHoleApiStatusEnum,
  ): boolean {
    switch (badgeText) {
      case ExtensionBadgeTextEnum.disabled:
        return apiStatus === PiHoleApiStatusEnum.disabled
      case ExtensionBadgeTextEnum.enabled:
        return apiStatus === PiHoleApiStatusEnum.enabled
      default:
        return false
    }
  }

  private static convertStringToBadgeTextEnum(
    input: string,
  ): ExtensionBadgeTextEnum {
    switch (input) {
      case ExtensionBadgeTextEnum.disabled:
        return ExtensionBadgeTextEnum.disabled
      case ExtensionBadgeTextEnum.enabled:
        return ExtensionBadgeTextEnum.enabled
      default:
        return ExtensionBadgeTextEnum.error
    }
  }

  private static getColorForBadgeTextEnum(
    input: ExtensionBadgeTextEnum | string,
  ): string {
    switch (input) {
      case ExtensionBadgeTextEnum.disabled:
        return 'gray'
      case ExtensionBadgeTextEnum.enabled:
        return '#1ea23d'
      case ExtensionBadgeTextEnum.ok:
      case ExtensionBadgeTextEnum.info:
        return '#4577d7'
      default:
        return 'red'
    }
  }
}
