import { PiHoleSettingsStorage, StorageService } from './StorageService'
import Tab = chrome.tabs.Tab

export default class TabService {
  public static getCurrentTab(): Promise<Tab | undefined> {
    return new Promise((resolve) => {
      chrome.tabs.query(
        { active: true, lastFocusedWindow: true, currentWindow: true },
        (tabs) => resolve(tabs[0]),
      )
    })
  }

  public static async getCurrentTabUrlCleaned(): Promise<string> {
    const tab = await this.getCurrentTab()
    return tab ? this.getTabUrlCleaned(tab) : ''
  }

  public static async getTabUrlCleaned(tab: Tab): Promise<string> {
    return this.getUrlCleaned(tab.url ?? '')
  }

  public static async getUrlCleaned(fullUrl: string): Promise<string> {
    let excludedDomains = ['localhost', '127.0.0.1', 'pi.hole']
    const piHoleSettings = await StorageService.getPiHoleSettingsArray()
    const configuredHosts: string[] = []

    if (piHoleSettings) {
      piHoleSettings.forEach((value: PiHoleSettingsStorage) => {
        if (!value.pi_uri_base) {
          return
        }

        try {
          configuredHosts.push(new URL(value.pi_uri_base).hostname)
        } catch {
          // Invalid configuration values are handled by the options validation.
        }
      })
    }

    excludedDomains = excludedDomains.concat(configuredHosts)

    try {
      const parsedUrl = new URL(fullUrl)
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        return ''
      }

      return excludedDomains.includes(parsedUrl.hostname) ? '' : parsedUrl.hostname
    } catch {
      return ''
    }
  }

  public static reloadCurrentTab(delay: number = 0): void {
    const reload = async () => {
      const tab = await this.getCurrentTab()
      if (!tab?.id || !(await this.getTabUrlCleaned(tab))) {
        return
      }
      chrome.tabs.reload(tab.id)
    }

    if (delay > 0) {
      setTimeout(reload, delay)
    } else {
      reload()
    }
  }
}
