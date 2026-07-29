import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { BadgeService } from './BadgeService'
import { StorageService } from './StorageService'
import PiHoleApiService from './PiHoleApiService'
import TabService from './TabService'
import ApiList from '../api/enum/ApiList'
import DomainStatusService from './DomainStatusService'

export default class BackgroundService {
  public static async togglePiHole(): Promise<void> {
    try {
      const currentStatus = await PiHoleApiService.getPiHoleStatusCombined()
      if (currentStatus === PiHoleApiStatusEnum.error) {
        BadgeService.setGlobalStatus(PiHoleApiStatusEnum.error)
        return
      }

      const newStatus =
        currentStatus === PiHoleApiStatusEnum.enabled
          ? PiHoleApiStatusEnum.disabled
          : PiHoleApiStatusEnum.enabled
      const responses = await PiHoleApiService.changePiHoleStatus(newStatus, 0)
      if (responses.some((response) => response.data.blocking !== newStatus)) {
        throw new Error('One Pi-hole returned an unexpected blocking state')
      }

      BadgeService.setGlobalStatus(newStatus)
      await DomainStatusService.refreshActiveTabBadges()
      if (await StorageService.getReloadAfterDisable()) {
        TabService.reloadCurrentTab(1500)
      }
    } catch (reason) {
      console.warn(reason)
      BadgeService.setGlobalStatus(PiHoleApiStatusEnum.error)
    }
  }

  public static async blacklistCurrentDomain(): Promise<void> {
    const domain = await TabService.getCurrentTabUrlCleaned()
    if (!domain) {
      await this.refreshBadges()
      return
    }

    try {
      await PiHoleApiService.subDomainFromList(ApiList.whitelist, domain)
      await PiHoleApiService.addDomainToList(ApiList.blacklist, domain)
      await this.refreshBadges()
    } catch (reason) {
      console.warn(reason)
      BadgeService.setGlobalStatus(PiHoleApiStatusEnum.error)
    }
  }

  public static async whitelistCurrentDomain(): Promise<void> {
    const domain = await TabService.getCurrentTabUrlCleaned()
    if (!domain) {
      await this.refreshBadges()
      return
    }

    try {
      await PiHoleApiService.subDomainFromList(ApiList.blacklist, domain)
      await PiHoleApiService.addDomainToList(ApiList.whitelist, domain)
      await this.refreshBadges()

      if (await StorageService.getReloadAfterWhitelist()) {
        TabService.reloadCurrentTab(1500)
      }
    } catch (reason) {
      console.warn(reason)
      BadgeService.setGlobalStatus(PiHoleApiStatusEnum.error)
    }
  }

  public static openOptions(): void {
    chrome.runtime.openOptionsPage()
  }

  private static async refreshBadges(): Promise<void> {
    const status = await PiHoleApiService.getPiHoleStatusCombined()
    BadgeService.setGlobalStatus(status)
    await DomainStatusService.refreshActiveTabBadges()
  }
}
