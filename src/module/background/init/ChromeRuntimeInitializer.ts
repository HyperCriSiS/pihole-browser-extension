import { Initializer } from '../../general/Initializer'
import { LinkConfig } from '../../../service/i18NService'
import {
  GroupPauseTimeDefaults,
  PiHoleSettingsDefaults,
  StorageService,
  TemporaryAllowTimeDefaults,
} from '../../../service/StorageService'

export default class ChromeRuntimeInitializer implements Initializer {
  public init(): void {
    this.initializePresetTimes()

    chrome.runtime.onInstalled.addListener((details) => {
      if (details.reason === 'install') {
        StorageService.saveDefaultDisableTime(
          Number(PiHoleSettingsDefaults.default_disable_time),
        )
        StorageService.saveGroupPauseTimes([...GroupPauseTimeDefaults])
        StorageService.saveTemporaryAllowTimes([...TemporaryAllowTimeDefaults])
        StorageService.saveReloadAfterDisable(true)
        StorageService.saveReloadAfterWhitelist(true)
      } else if (details.reason === 'update' && details.previousVersion) {
        const previousVersion = Number(
          details.previousVersion.split('.').join(''),
        )
        const thisVersion = Number(
          chrome.runtime.getManifest().version.split('.').join(''),
        )
        console.log(`Updated from ${previousVersion} to ${thisVersion}!`)

        if (previousVersion < 400 && thisVersion >= 400) {
          StorageService.clearStorage().then(() => {
            StorageService.saveDefaultDisableTime(
              Number(PiHoleSettingsDefaults.default_disable_time),
            )
            StorageService.saveGroupPauseTimes([...GroupPauseTimeDefaults])
            StorageService.saveTemporaryAllowTimes([
              ...TemporaryAllowTimeDefaults,
            ])
            StorageService.saveReloadAfterDisable(true)
            StorageService.saveReloadAfterWhitelist(true)
          })
        }
      }
    })

    chrome.runtime.setUninstallURL(LinkConfig.uninstall_survey)
  }

  private initializePresetTimes(): void {
    StorageService.getGroupPauseTimes().then((times) => {
      if (typeof times === 'undefined') {
        StorageService.saveGroupPauseTimes([...GroupPauseTimeDefaults])
      }
    })

    StorageService.getTemporaryAllowTimes().then((times) => {
      if (typeof times === 'undefined') {
        StorageService.saveTemporaryAllowTimes([...TemporaryAllowTimeDefaults])
      }
    })
  }
}
