import { BadgeService } from '../../../service/BadgeService'
import ContextMenuInitializer from './ContextMenuInitializer'
import ChromeRuntimeInitializer from './ChromeRuntimeInitializer'
import { Initializer } from '../../general/Initializer'
import HotKeyInitializer from './HotKeyInitializer'
import TemporaryActionService from '../../../service/TemporaryActionService'
import GroupPauseService from '../../../service/GroupPauseService'
import DomainStatusService from '../../../service/DomainStatusService'
import { ExtensionStorageEnum } from '../../../service/StorageService'

export default class BackgroundInitializer implements Initializer {
  private readonly ALARM_NAME = 'pihole.refreshDomainBadge'

  private readonly INTERVAL_TIMEOUT = 30000

  public init(): void {
    BadgeService.clearBadge()

    new ContextMenuInitializer().init()
    new ChromeRuntimeInitializer().init()
    new HotKeyInitializer().init()

    this.addAlarmListener()
    this.addTabListeners()
    this.addStorageListener()
    DomainStatusService.refreshActiveTabBadges().catch((reason) => {
      console.error('Failed to initialize domain badges', reason)
    })
    this.createAlarm().catch(() => {
      console.error('Failed to create domain badge alarm')
    })
    TemporaryActionService.initialize().catch((reason) => {
      console.error('Failed to initialize temporary actions', reason)
    })
    GroupPauseService.initialize().catch((reason) => {
      console.error('Failed to initialize client-group pauses', reason)
    })
  }

  private async createAlarm(): Promise<void> {
    if (typeof browser !== 'undefined') {
      browser.alarms.create(this.ALARM_NAME, {
        periodInMinutes: this.INTERVAL_TIMEOUT / 60000,
      })
      return
    }

    await chrome.alarms.create(this.ALARM_NAME, {
      periodInMinutes: this.INTERVAL_TIMEOUT / 60000,
    })
  }

  private addAlarmListener(): void {
    const alarmHandler = (alarm: { name: string }) => {
      if (alarm.name === this.ALARM_NAME) {
        DomainStatusService.refreshActiveTabBadges().catch((reason) => {
          console.error('Failed to refresh domain badges', reason)
        })
        return
      }

      Promise.all([
        GroupPauseService.handleAlarm(alarm.name),
        TemporaryActionService.handleAlarm(alarm.name),
      ])
        .then(() => DomainStatusService.refreshActiveTabBadges())
        .catch((reason) => {
          console.error('Failed to handle extension alarm', reason)
        })
    }

    if (typeof browser !== 'undefined') {
      browser.alarms.onAlarm.addListener(alarmHandler)
    } else {
      chrome.alarms.onAlarm.addListener(alarmHandler)
    }
  }

  private addTabListeners(): void {
    chrome.tabs.onActivated.addListener(({ tabId }) => {
      chrome.tabs.get(tabId, (tab) => {
        DomainStatusService.refreshTabBadge(tab).catch((reason) => {
          console.error('Failed to refresh the activated tab badge', reason)
        })
      })
    })

    chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
      if (!changeInfo.url && changeInfo.status !== 'complete') {
        return
      }

      DomainStatusService.refreshTabBadge(tab).catch((reason) => {
        console.error('Failed to refresh the updated tab badge', reason)
      })
    })

    chrome.windows.onFocusChanged.addListener(() => {
      DomainStatusService.refreshActiveTabBadges().catch((reason) => {
        console.error('Failed to refresh focused-window badges', reason)
      })
    })
  }

  private addStorageListener(): void {
    chrome.storage.onChanged.addListener((changes, areaName) => {
      if (
        areaName !== 'local' ||
        (!changes[ExtensionStorageEnum.pause_target] &&
          !changes[ExtensionStorageEnum.pi_hole_settings])
      ) {
        return
      }

      DomainStatusService.refreshActiveTabBadges().catch((reason) => {
        console.error('Failed to refresh badges after a settings change', reason)
      })
    })
  }
}
