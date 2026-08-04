import {
  CURRENT_STORAGE_SCHEMA_VERSION,
  ExtensionStorage,
  GroupPauseTimeDefaults,
  PiHoleSettingsStorage,
  StorageService,
  TemporaryAllowTimeDefaults,
} from './StorageService'
import { normalizePiHoleUrl } from './UrlService'

export const normalizeStoredPiHoleSettings = (
  settings: PiHoleSettingsStorage[] | undefined,
): PiHoleSettingsStorage[] => {
  const unique = new Map<string, PiHoleSettingsStorage>()

  for (const setting of settings ?? []) {
    const rawUrl = String(setting?.pi_uri_base ?? '').trim()
    if (!rawUrl) {
      continue
    }

    try {
      const pi_uri_base = normalizePiHoleUrl(rawUrl)
      unique.set(pi_uri_base, {
        pi_uri_base,
        api_key: String(setting.api_key ?? ''),
      })
    } catch {
      // Invalid legacy entries are ignored individually instead of causing the
      // complete settings store to be deleted.
    }
  }

  return [...unique.values()]
}

/**
 * Incremental, non-destructive storage migrations. Existing user preferences
 * and credentials are preserved; only invalid individual connection records
 * and obsolete persistent session tokens are removed.
 */
export default class StorageMigrationService {
  public static async run(): Promise<void> {
    const currentVersion = await StorageService.getStorageSchemaVersion()
    if (currentVersion >= CURRENT_STORAGE_SCHEMA_VERSION) {
      await StorageService.removeLegacyPersistentSessions()
      return
    }

    const values = await StorageService.getAllLocalValues()
    const updates: ExtensionStorage = {}

    if (currentVersion < 1) {
      const normalizedSettings = normalizeStoredPiHoleSettings(
        values.pi_hole_settings as PiHoleSettingsStorage[] | undefined,
      )
      if (normalizedSettings.length > 0) {
        updates.pi_hole_settings = normalizedSettings
      }

      if (typeof values.default_disable_time !== 'number') {
        updates.default_disable_time = 10
      }
      if (!Array.isArray(values.group_pause_times)) {
        updates.group_pause_times = [...GroupPauseTimeDefaults]
      }
      if (!Array.isArray(values.temporary_allow_times)) {
        updates.temporary_allow_times = [...TemporaryAllowTimeDefaults]
      }
      if (typeof values.reload_after_disable !== 'boolean') {
        updates.reload_after_disable = true
      }
      if (typeof values.reload_after_white_list !== 'boolean') {
        updates.reload_after_white_list = true
      }
    }

    if (currentVersion < 2) {
      updates.storage_schema_version = CURRENT_STORAGE_SCHEMA_VERSION
      if (typeof values.settings_sync_enabled !== 'boolean') {
        updates.settings_sync_enabled = false
      }
    }

    if (Object.keys(updates).length > 0) {
      await StorageService.setLocalValues(updates as Record<string, unknown>)
    }
    await StorageService.removeLegacyPersistentSessions()
  }
}
