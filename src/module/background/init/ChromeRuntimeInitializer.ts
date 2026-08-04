import { Initializer } from '../../general/Initializer'
import {
  GroupPauseTimeDefaults,
  PiHoleSettingsDefaults,
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../service/StorageService'
import StorageMigrationService from '../../../service/StorageMigrationService'

export default class ChromeRuntimeInitializer implements Initializer {
  public init(): void {
    this.initializeStorage().catch((reason) => {
      console.error('Failed to initialize Wormhole Connector storage', reason)
    })

    chrome.runtime.onInstalled.addListener((details) => {
      this.handleInstalled(details).catch((reason) => {
        console.error('Failed to handle extension installation or update', reason)
      })
    })
  }

  private async handleInstalled(
    details: chrome.runtime.InstalledDetails,
  ): Promise<void> {
    await StorageMigrationService.run()
    await this.initializePresetTimes()

    if (details.reason === 'install') {
      if (typeof (await StorageService.getDefaultDisableTime()) === 'undefined') {
        StorageService.saveDefaultDisableTime(
          Number(PiHoleSettingsDefaults.default_disable_time),
        )
      }
      if (typeof (await StorageService.getReloadAfterDisable()) === 'undefined') {
        StorageService.saveReloadAfterDisable(true)
      }
      if (typeof (await StorageService.getReloadAfterWhitelist()) === 'undefined') {
        StorageService.saveReloadAfterWhitelist(true)
      }
      return
    }

    if (details.reason === 'update' && details.previousVersion) {
      console.info(
        `Wormhole Connector updated from ${details.previousVersion} to ${chrome.runtime.getManifest().version}`,
      )
    }
  }

  private async initializeStorage(): Promise<void> {
    await StorageMigrationService.run()
    await this.initializePresetTimes()
  }

  private async initializePresetTimes(): Promise<void> {
    const [groupPauseTimes, temporaryAllowTimes] = await Promise.all([
      StorageService.getGroupPauseTimes(),
      StorageService.getTemporaryAllowTimes(),
    ])

    if (typeof groupPauseTimes === 'undefined') {
      StorageService.saveGroupPauseTimes([...GroupPauseTimeDefaults])
    }
    if (typeof temporaryAllowTimes === 'undefined') {
      StorageService.saveTemporaryAllowTimes([...TemporaryAllowTimeDefaults])
    }
  }
}
