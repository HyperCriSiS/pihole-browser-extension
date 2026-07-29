export interface PiHoleSettingsStorage {
  pi_uri_base?: string
  api_key?: string
}

export enum PiHoleSettingsDefaults {
  pi_uri_base = 'http://pi.hole/admin',
  default_disable_time = 10,
}

export const GroupPauseTimeDefaults = [60, 300, 900]
export const TemporaryAllowTimeDefaults = [60, 300, 900]

export interface ExtensionStorage {
  pi_hole_settings?: PiHoleSettingsStorage[]
  default_disable_time?: number
  group_pause_times?: number[]
  temporary_allow_times?: number[]
  pause_target?: string
  hide_group_selector_in_popup?: boolean
  hide_group_list_actions_in_popup?: boolean
  badge_uses_selected_group?: boolean
  reload_after_disable?: boolean
  reload_after_white_list?: boolean
  disable_list_feature?: boolean
  disable_update_notification?: boolean
  beta_feature_flag?: boolean
  disable_context_menu?: boolean
}

export enum ExtensionStorageEnum {
  pi_hole_settings = 'pi_hole_settings',
  default_disable_time = 'default_disable_time',
  group_pause_times = 'group_pause_times',
  temporary_allow_times = 'temporary_allow_times',
  pause_target = 'pause_target',
  hide_group_selector_in_popup = 'hide_group_selector_in_popup',
  hide_group_list_actions_in_popup = 'hide_group_list_actions_in_popup',
  badge_uses_selected_group = 'badge_uses_selected_group',
  reload_after_disable = 'reload_after_disable',
  reload_after_white_list = 'reload_after_white_list',
  disable_list_feature = 'disable_list_feature',
  disable_update_notification = 'disable_update_notification',
  disable_context_menu = 'disable_context_menu',
  session_storage = 'session_storage',
}

type StorageKey = string
type StorageValue<T> = {
  value: T
}

export class StorageService {
  public static async savePiHoleSettingsArray(
    settings: PiHoleSettingsStorage[],
  ): Promise<void> {
    const filteredSettings = settings.filter((value) => value.pi_uri_base)

    if (filteredSettings.length < 1) {
      await chrome.storage.local.remove(ExtensionStorageEnum.pi_hole_settings)
      return
    }

    const secureSettings: PiHoleSettingsStorage[] = []

    for (const setting of filteredSettings) {
      const secureSetting: PiHoleSettingsStorage = {
        pi_uri_base: String(setting.pi_uri_base),
        api_key: String(setting.api_key ?? ''),
      }

      secureSettings.push(secureSetting)
      await this.removeSid(setting.pi_uri_base!)
    }

    await chrome.storage.local.set({
      pi_hole_settings: secureSettings,
    } satisfies ExtensionStorage)
  }

  public static saveDefaultDisableTime(time: number): void {
    if (time < 1) {
      return
    }
    const storage: ExtensionStorage = {
      default_disable_time: time,
    }
    chrome.storage.local.set(storage)
  }

  public static getDefaultDisableTime(): Promise<number | undefined> {
    return this.getStorageValue<number>(
      ExtensionStorageEnum.default_disable_time,
    )
  }

  public static saveGroupPauseTimes(times: number[]): void {
    const normalizedTimes = this.normalizePresetTimes(times)
    if (!normalizedTimes) {
      return
    }

    chrome.storage.local.set({
      group_pause_times: normalizedTimes,
    } satisfies ExtensionStorage)
  }

  public static getGroupPauseTimes(): Promise<number[] | undefined> {
    return this.getStorageValue<number[]>(
      ExtensionStorageEnum.group_pause_times,
    )
  }

  public static saveTemporaryAllowTimes(times: number[]): void {
    const normalizedTimes = this.normalizePresetTimes(times)
    if (!normalizedTimes) {
      return
    }

    chrome.storage.local.set({
      temporary_allow_times: normalizedTimes,
    } satisfies ExtensionStorage)
  }

  public static getTemporaryAllowTimes(): Promise<number[] | undefined> {
    return this.getStorageValue<number[]>(
      ExtensionStorageEnum.temporary_allow_times,
    )
  }

  public static async savePauseTarget(target: string): Promise<void> {
    if (!target) {
      return
    }

    const storage: ExtensionStorage = {
      pause_target: target,
    }
    await chrome.storage.local.set(storage)
  }

  public static getPauseTarget(): Promise<string | undefined> {
    return this.getStorageValue<string>(ExtensionStorageEnum.pause_target)
  }

  public static saveHideGroupSelectorInPopup(state: boolean): void {
    chrome.storage.local.set({
      hide_group_selector_in_popup: state,
    } satisfies ExtensionStorage)
  }

  public static getHideGroupSelectorInPopup(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.hide_group_selector_in_popup,
      false,
    )
  }

  public static saveHideGroupListActionsInPopup(state: boolean): void {
    chrome.storage.local.set({
      hide_group_list_actions_in_popup: state,
    } satisfies ExtensionStorage)
  }

  public static getHideGroupListActionsInPopup(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.hide_group_list_actions_in_popup,
      false,
    )
  }

  public static saveBadgeUsesSelectedGroup(state: boolean): void {
    chrome.storage.local.set({
      badge_uses_selected_group: state,
    } satisfies ExtensionStorage)
  }

  public static getBadgeUsesSelectedGroup(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.badge_uses_selected_group,
      false,
    )
  }

  public static saveReloadAfterDisable(state: boolean): void {
    const storage: ExtensionStorage = {
      reload_after_disable: state,
    }
    chrome.storage.local.set(storage)
  }

  public static getReloadAfterDisable(): Promise<boolean | undefined> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.reload_after_disable,
    )
  }

  public static saveReloadAfterWhitelist(state: boolean): void {
    const storage: ExtensionStorage = {
      reload_after_white_list: state,
    }
    chrome.storage.local.set(storage)
  }

  public static getReloadAfterWhitelist(): Promise<boolean | undefined> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.reload_after_white_list,
    )
  }

  public static getPiHoleSettingsArray(): Promise<
    PiHoleSettingsStorage[] | undefined
  > {
    return this.getStorageValue<PiHoleSettingsStorage[]>(
      ExtensionStorageEnum.pi_hole_settings,
    )
  }

  public static getDisableListFeature(): Promise<boolean | undefined> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.disable_list_feature,
    )
  }

  public static saveDisableListFeature(state: boolean): void {
    const storage: ExtensionStorage = {
      disable_list_feature: state,
    }
    chrome.storage.local.set(storage)
  }

  public static getDisableContextMenu(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.disable_context_menu,
      false,
    )
  }

  public static saveDisableContextMenu(state: boolean): void {
    const storage: ExtensionStorage = {
      disable_context_menu: state,
    }
    chrome.storage.local.set(storage)
  }

  public static async getSid(url: string): Promise<string | undefined> {
    const baseUrl = new URL(url).origin
    const key: StorageKey = `${ExtensionStorageEnum.session_storage}_${baseUrl}`
    const value = await this.getStorageValue<StorageValue<string>>(key)

    return value?.value
  }

  public static async saveSid(url: string, sid: string): Promise<void> {
    const baseUrl = new URL(url).origin
    const key: StorageKey = `${ExtensionStorageEnum.session_storage}_${baseUrl}`
    const value: StorageValue<string> = {
      value: sid,
    }
    await chrome.storage.local.set({ [key]: value })
  }

  public static async removeSid(url: string): Promise<void> {
    const baseUrl = new URL(url).origin
    const key: StorageKey = `${ExtensionStorageEnum.session_storage}_${baseUrl}`
    await chrome.storage.local.remove(key)
  }

  public static async clearStorage() {
    return chrome.storage.local.clear()
  }

  private static normalizePresetTimes(times: number[]): number[] | undefined {
    const normalizedTimes = times.map(Number)
    const isValid =
      normalizedTimes.length === 3 &&
      normalizedTimes.every((time) => Number.isInteger(time) && time >= 10)

    return isValid ? normalizedTimes : undefined
  }

  private static getStorageValue<T>(key: StorageKey): Promise<T | undefined>

  private static getStorageValue<T>(
    key: StorageKey,
    defaultUnsetValue: T,
  ): Promise<T>

  private static getStorageValue<T>(
    key: StorageKey,
    defaultUnsetValue?: T,
  ): Promise<T | undefined> | Promise<T> {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (obj) => {
        const storageValue = obj[key] as T | undefined

        if (
          typeof defaultUnsetValue !== 'undefined' &&
          typeof storageValue === 'undefined'
        ) {
          resolve(defaultUnsetValue)
          return
        }

        resolve(storageValue)
      })
    })
  }
}
