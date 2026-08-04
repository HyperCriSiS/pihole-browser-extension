import SessionService from './SessionService'
import { normalizePiHoleUrl } from './UrlService'

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
export const CURRENT_STORAGE_SCHEMA_VERSION = 2

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
  storage_schema_version?: number
  settings_sync_enabled?: boolean
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
  storage_schema_version = 'storage_schema_version',
  settings_sync_enabled = 'settings_sync_enabled',
  session_storage = 'session_storage',
}

type StorageKey = string

export class StorageService {
  public static async savePiHoleSettingsArray(
    settings: PiHoleSettingsStorage[],
  ): Promise<void> {
    const normalizedSettings = settings
      .filter((value) => String(value.pi_uri_base ?? '').trim())
      .map((setting) => ({
        pi_uri_base: normalizePiHoleUrl(String(setting.pi_uri_base)),
        // Passwords are opaque values. Never trim or otherwise rewrite them.
        api_key: String(setting.api_key ?? ''),
      }))

    // Sessions are intentionally ephemeral and tied to the exact endpoint and
    // password. Clearing them on every connection-settings save prevents stale
    // authentication from surviving endpoint or password changes.
    await SessionService.clear()

    if (normalizedSettings.length < 1) {
      await chrome.storage.local.remove(ExtensionStorageEnum.pi_hole_settings)
      return
    }

    await chrome.storage.local.set({
      pi_hole_settings: normalizedSettings,
    } satisfies ExtensionStorage)
  }

  public static saveDefaultDisableTime(time: number): void {
    if (time < 1) {
      return
    }
    chrome.storage.local.set({ default_disable_time: time } satisfies ExtensionStorage)
  }

  public static getDefaultDisableTime(): Promise<number | undefined> {
    return this.getStorageValue<number>(ExtensionStorageEnum.default_disable_time)
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
    return this.getStorageValue<number[]>(ExtensionStorageEnum.group_pause_times)
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
    await chrome.storage.local.set({ pause_target: target } satisfies ExtensionStorage)
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
    chrome.storage.local.set({ reload_after_disable: state } satisfies ExtensionStorage)
  }

  public static getReloadAfterDisable(): Promise<boolean | undefined> {
    return this.getStorageValue<boolean>(ExtensionStorageEnum.reload_after_disable)
  }

  public static saveReloadAfterWhitelist(state: boolean): void {
    chrome.storage.local.set({
      reload_after_white_list: state,
    } satisfies ExtensionStorage)
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
    return this.getStorageValue<boolean>(ExtensionStorageEnum.disable_list_feature)
  }

  public static saveDisableListFeature(state: boolean): void {
    chrome.storage.local.set({ disable_list_feature: state } satisfies ExtensionStorage)
  }

  public static getDisableContextMenu(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.disable_context_menu,
      false,
    )
  }

  public static saveDisableContextMenu(state: boolean): void {
    chrome.storage.local.set({ disable_context_menu: state } satisfies ExtensionStorage)
  }

  public static getStorageSchemaVersion(): Promise<number> {
    return this.getStorageValue<number>(
      ExtensionStorageEnum.storage_schema_version,
      0,
    )
  }

  public static async saveStorageSchemaVersion(version: number): Promise<void> {
    await chrome.storage.local.set({
      storage_schema_version: version,
    } satisfies ExtensionStorage)
  }

  public static getSettingsSyncEnabled(): Promise<boolean> {
    return this.getStorageValue<boolean>(
      ExtensionStorageEnum.settings_sync_enabled,
      false,
    )
  }

  public static async saveSettingsSyncEnabled(state: boolean): Promise<void> {
    await chrome.storage.local.set({
      settings_sync_enabled: state,
    } satisfies ExtensionStorage)
  }

  public static async getAllLocalValues(): Promise<Record<string, unknown>> {
    return chrome.storage.local.get(null)
  }

  public static async setLocalValues(
    values: Record<string, unknown>,
  ): Promise<void> {
    await chrome.storage.local.set(values)
  }

  /** @deprecated Use SessionService directly. */
  public static async getSid(url: string): Promise<string | undefined> {
    return (await SessionService.get(url))?.sid
  }

  /** @deprecated Use SessionService directly. */
  public static async saveSid(url: string, sid: string): Promise<void> {
    await SessionService.save(url, sid)
  }

  /** @deprecated Use SessionService directly. */
  public static async removeSid(url: string): Promise<void> {
    await SessionService.remove(url)
  }

  public static async removeLegacyPersistentSessions(): Promise<void> {
    const values = await chrome.storage.local.get(null)
    const legacyKeys = Object.keys(values).filter((key) =>
      key.startsWith(`${ExtensionStorageEnum.session_storage}_`),
    )
    if (legacyKeys.length > 0) {
      await chrome.storage.local.remove(legacyKeys)
    }
  }

  public static async clearStorage(): Promise<void> {
    await Promise.all([chrome.storage.local.clear(), SessionService.clear()])
  }

  private static normalizePresetTimes(times: number[]): number[] | undefined {
    const normalizedTimes = times.map(Number)
    const isValid =
      normalizedTimes.length === 3 &&
      normalizedTimes.every((time) => Number.isInteger(time) && time >= 10)

    return isValid ? normalizedTimes : undefined
  }

  private static getStorageValue<T>(key: StorageKey): Promise<T | undefined>
  private static getStorageValue<T>(key: StorageKey, defaultUnsetValue: T): Promise<T>
  private static async getStorageValue<T>(
    key: StorageKey,
    defaultUnsetValue?: T,
  ): Promise<T | undefined> {
    const obj = await chrome.storage.local.get(key)
    const storageValue = obj[key] as T | undefined
    return typeof storageValue === 'undefined' ? defaultUnsetValue : storageValue
  }
}
