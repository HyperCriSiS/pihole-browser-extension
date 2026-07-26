import {
  BadgeService,
  ExtensionBadgeTextEnum,
} from '../../../service/BadgeService'
import ContextMenuInitializer from './ContextMenuInitializer'
import ChromeRuntimeInitializer from './ChromeRuntimeInitializer'
import { Initializer } from '../../general/Initializer'
import PiHoleApiService from '../../../service/PiHoleApiService'
import PiHoleApiStatusEnum from '../../../api/enum/PiHoleApiStatusEnum'
import HotKeyInitializer from './HotKeyInitializer'
import TemporaryActionService from '../../../service/TemporaryActionService'

export default class BackgroundInitializer implements Initializer {
  private readonly ALARM_NAME = 'pihole.checkStatus'

  private readonly INTERVAL_TIMEOUT = 30000

  public init(): void {
    BadgeService.setBadgeText('')

    new ContextMenuInitializer().init()
    new ChromeRuntimeInitializer().init()
    new HotKeyInitializer().init()

    this.addAlarmListener()
    this.checkStatus()
    this.createAlarm().catch(() => {
      console.error('Failed to create status alarm')
    })
    TemporaryActionService.initialize().catch((reason) => {
      console.error('Failed to initialize temporary actions', reason)
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
        this.checkStatus()
        return
      }

      TemporaryActionService.handleAlarm(alarm.name).catch((reason) => {
        console.error('Failed to handle temporary action alarm', reason)
      })
    }

    if (typeof browser !== 'undefined') {
      browser.alarms.onAlarm.addListener(alarmHandler)
    } else {
      chrome.alarms.onAlarm.addListener(alarmHandler)
    }
  }

  /**
   * Checking the current status of the PiHole(s)
   */
  private async checkStatus(): Promise<void> {
    const value = await PiHoleApiService.getPiHoleStatusCombined()
    const result = await BadgeService.getBadgeText()

    if (!BadgeService.compareBadgeTextToApiStatusEnum(result, value)) {
      if (value === PiHoleApiStatusEnum.disabled) {
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.disabled)
      } else if (value === PiHoleApiStatusEnum.enabled) {
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.enabled)
      } else {
        BadgeService.setBadgeText(ExtensionBadgeTextEnum.error)
      }
    }
  }
}
