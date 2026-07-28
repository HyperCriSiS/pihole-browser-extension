import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import {
  combineDomainStates,
  DomainBlockingState,
  evaluateDomainSearch,
} from './DomainStatusEvaluator'
import { BadgeService } from './BadgeService'
import PiHoleApiService from './PiHoleApiService'
import { StorageService } from './StorageService'
import TabService from './TabService'

export type CurrentDomainStatus = {
  domain: string
  state: DomainBlockingState
  groupName: string | null
}

export default class DomainStatusService {
  public static async getDomainStatus(
    domain: string,
    preferredGroupName?: string | null,
  ): Promise<DomainBlockingState> {
    if (!domain) {
      return 'unknown'
    }

    let piHoles
    try {
      piHoles = await PiHoleApiService.getConfiguredPiHoles()
    } catch (reason) {
      console.warn('Could not load configured Pi-hole instances', reason)
      return 'unknown'
    }

    const states = await Promise.all(
      piHoles.map(async (piHole): Promise<DomainBlockingState> => {
        try {
          const blockingStatus =
            await PiHoleApiService.getPiHoleStatusFor(piHole)
          if (blockingStatus.blocking === PiHoleApiStatusEnum.disabled) {
            return 'allowed'
          }
          if (blockingStatus.blocking !== PiHoleApiStatusEnum.enabled) {
            return 'unknown'
          }

          const groups = await PiHoleApiService.getGroups(piHole)
          const preferredGroup = preferredGroupName
            ? groups.find((item) => item.name === preferredGroupName)
            : undefined

          if (preferredGroup && !preferredGroup.enabled) {
            return 'allowed'
          }

          const group =
            preferredGroup ||
            groups.find((item) => item.enabled && item.name === 'Default') ||
            groups.find((item) => item.enabled)

          if (!group) {
            return 'unknown'
          }

          const search = await PiHoleApiService.searchDomain(piHole, domain)
          return evaluateDomainSearch(search, group.id)
        } catch (reason) {
          console.warn(
            `Could not determine the blocking status for ${domain}`,
            reason,
          )
          return 'unknown'
        }
      }),
    )

    return combineDomainStates(states)
  }

  public static async refreshCurrentTabBadge(
    preferredGroupName?: string | null,
  ): Promise<CurrentDomainStatus> {
    const tab = await TabService.getCurrentTab()
    if (!tab) {
      return { domain: '', state: 'unknown', groupName: null }
    }

    return this.refreshTabBadge(tab, preferredGroupName)
  }

  public static async refreshTabBadge(
    tab: chrome.tabs.Tab,
    preferredGroupName?: string | null,
  ): Promise<CurrentDomainStatus> {
    const tabId = tab.id
    const domain = await TabService.getTabUrlCleaned(tab)
    const groupName =
      typeof preferredGroupName === 'undefined'
        ? await this.getBadgeGroupName()
        : preferredGroupName

    if (typeof tabId === 'undefined' || !domain) {
      if (typeof tabId !== 'undefined') {
        await BadgeService.setDomainBlockedBadge(tabId, false)
      }
      return { domain: '', state: 'unknown', groupName }
    }

    const state = await this.getDomainStatus(domain, groupName)
    await BadgeService.setDomainBlockedBadge(tabId, state === 'blocked')
    return { domain, state, groupName }
  }

  public static async refreshActiveTabBadges(): Promise<void> {
    const tabs = await new Promise<chrome.tabs.Tab[]>((resolve) => {
      chrome.tabs.query({ active: true }, resolve)
    })

    await Promise.all(tabs.map((tab) => this.refreshTabBadge(tab)))
  }

  private static async getBadgeGroupName(): Promise<string | null> {
    if (!(await StorageService.getBadgeUsesSelectedGroup())) {
      return null
    }

    return (await StorageService.getPauseTarget()) || null
  }
}
