import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { composeTabBadgeText } from './BadgeState'

export enum ExtensionBadgeTextEnum {
  enabled = 'On',
  enabledBlocked = 'On!',
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
        typeof tabId === 'undefined'
          ? { color: 'white' }
          : { color: 'white', tabId }
      browser.browserAction
        .setBadgeTextColor(firefoxDetails)
        .catch(() => undefined)
    }

    this.actionApi.setBadgeBackgroundColor(colorDetails)
    this.actionApi.setBadgeText(badgeDetails)
  }

  public static setGlobalStatus(status: PiHoleApiStatusEnum): void {
    if (status === PiHoleApiStatusEnum.enabled) {
      this.setBadgeText(ExtensionBadgeTextEnum.enabled)
      return
    }
    if (status === PiHoleApiStatusEnum.disabled) {
      this.setBadgeText(ExtensionBadgeTextEnum.disabled)
      return
    }
    this.setBadgeText(ExtensionBadgeTextEnum.error)
  }

  public static clearBadge(tabId?: number): void {
    this.setBadgeText('', tabId)
  }

  public static async setDomainBlockedBadge(
    tabId: number,
    blocked: boolean,
  ): Promise<void> {
    const globalText = await this.getRawBadgeText()
    this.setBadgeText(composeTabBadgeText(globalText, blocked), tabId)
  }

  public static getBadgeText(tabId?: number): Promise<ExtensionBadgeTextEnum> {
    return this.getRawBadgeText(tabId).then((result) =>
      this.convertStringToBadgeTextEnum(result),
    )
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

  private static getRawBadgeText(tabId?: number): Promise<string> {
    return new Promise((resolve) => {
      const details = typeof tabId === 'undefined' ? {} : { tabId }
      this.actionApi.getBadgeText(details, (result: string) => resolve(result))
    })
  }

  private static convertStringToBadgeTextEnum(
    input: string,
  ): ExtensionBadgeTextEnum {
    switch (input) {
      case ExtensionBadgeTextEnum.disabled:
        return ExtensionBadgeTextEnum.disabled
      case ExtensionBadgeTextEnum.enabledBlocked:
        return ExtensionBadgeTextEnum.enabledBlocked
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
      case ExtensionBadgeTextEnum.enabledBlocked:
      case ExtensionBadgeTextEnum.error:
      default:
        return 'red'
    }
  }
}
