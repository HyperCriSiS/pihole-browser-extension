import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
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

      await DomainStatusService.refreshActiveTabBadges()
      if (await StorageService.getReloadAfterDisable()) {
        TabService.reloadCurrentTab(1500)
      }
    } catch (reason) {
      console.warn(reason)
    }
  }

  public static async blacklistCurrentDomain(): Promise<void> {
    const domain = await TabService.getCurrentTabUrlCleaned()
    if (!domain) {
      await DomainStatusService.refreshCurrentTabBadge()
      return
    }

    try {
      await PiHoleApiService.subDomainFromList(ApiList.whitelist, domain)
      await PiHoleApiService.addDomainToList(ApiList.blacklist, domain)
      await DomainStatusService.refreshCurrentTabBadge()
    } catch (reason) {
      console.warn(reason)
    }
  }

  public static async whitelistCurrentDomain(): Promise<void> {
    const domain = await TabService.getCurrentTabUrlCleaned()
    if (!domain) {
      await DomainStatusService.refreshCurrentTabBadge()
      return
    }

    try {
      await PiHoleApiService.subDomainFromList(ApiList.blacklist, domain)
      await PiHoleApiService.addDomainToList(ApiList.whitelist, domain)
      await DomainStatusService.refreshCurrentTabBadge()

      if (await StorageService.getReloadAfterWhitelist()) {
        TabService.reloadCurrentTab(1500)
      }
    } catch (reason) {
      console.warn(reason)
    }
  }

  public static openOptions(): void {
    chrome.runtime.openOptionsPage()
  }
}
