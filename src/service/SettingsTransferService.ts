import {
  ExtensionStorage,
  PiHoleSettingsStorage,
  StorageService,
} from './StorageService'
import { normalizeStoredPiHoleSettings } from './StorageMigrationService'

const BACKUP_FORMAT = 'wormhole-connector-settings'
const BACKUP_VERSION = 1
const SYNC_KEY = 'wormhole_connector_safe_settings'

const PREFERENCE_KEYS: Array<keyof ExtensionStorage> = [
  'default_disable_time',
  'group_pause_times',
  'temporary_allow_times',
  'pause_target',
  'hide_group_selector_in_popup',
  'hide_group_list_actions_in_popup',
  'badge_uses_selected_group',
  'reload_after_disable',
  'reload_after_white_list',
  'disable_list_feature',
  'disable_context_menu',
]

export type WormholeSettingsBackup = {
  format: typeof BACKUP_FORMAT
  version: typeof BACKUP_VERSION
  createdAt: string
  includesCredentials: boolean
  connections: PiHoleSettingsStorage[]
  preferences: Partial<ExtensionStorage>
}

export type SettingsImportPreview = {
  backup: WormholeSettingsBackup
  connectionCount: number
  preferenceCount: number
  includesCredentials: boolean
}

const pickPreferences = (
  values: Record<string, unknown>,
): Partial<ExtensionStorage> => {
  const preferences: Partial<ExtensionStorage> = {}
  for (const key of PREFERENCE_KEYS) {
    if (typeof values[key] !== 'undefined') {
      ;(preferences as Record<string, unknown>)[key] = values[key]
    }
  }
  return preferences
}

export const parseSettingsBackup = (input: string): SettingsImportPreview => {
  const parsed = JSON.parse(input) as Partial<WormholeSettingsBackup>
  if (parsed.format !== BACKUP_FORMAT || parsed.version !== BACKUP_VERSION) {
    throw new Error('Unsupported Wormhole Connector settings backup')
  }

  const connections = normalizeStoredPiHoleSettings(parsed.connections)
  const preferences = pickPreferences(
    (parsed.preferences ?? {}) as Record<string, unknown>,
  )
  const includesCredentials =
    parsed.includesCredentials === true &&
    connections.some((connection) => Boolean(connection.api_key))

  const backup: WormholeSettingsBackup = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    createdAt:
      typeof parsed.createdAt === 'string'
        ? parsed.createdAt
        : new Date(0).toISOString(),
    includesCredentials,
    connections,
    preferences,
  }

  return {
    backup,
    connectionCount: connections.length,
    preferenceCount: Object.keys(preferences).length,
    includesCredentials,
  }
}

export default class SettingsTransferService {
  public static async createBackup(
    includeCredentials = false,
  ): Promise<WormholeSettingsBackup> {
    const values = await StorageService.getAllLocalValues()
    const connections = normalizeStoredPiHoleSettings(
      values.pi_hole_settings as PiHoleSettingsStorage[] | undefined,
    ).map((connection) => ({
      pi_uri_base: connection.pi_uri_base,
      api_key: includeCredentials ? connection.api_key : '',
    }))

    return {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      createdAt: new Date().toISOString(),
      includesCredentials: includeCredentials,
      connections,
      preferences: pickPreferences(values),
    }
  }

  public static async serializeBackup(
    includeCredentials = false,
  ): Promise<string> {
    return JSON.stringify(await this.createBackup(includeCredentials), null, 2)
  }

  public static previewImport(input: string): SettingsImportPreview {
    return parseSettingsBackup(input)
  }

  public static async applyImport(
    preview: SettingsImportPreview,
  ): Promise<void> {
    const existing =
      (await StorageService.getPiHoleSettingsArray()) ?? []
    const credentials = new Map(
      existing.map((connection) => [connection.pi_uri_base, connection.api_key]),
    )
    const connections = preview.backup.connections.map((connection) => ({
      pi_uri_base: connection.pi_uri_base,
      api_key:
        preview.backup.includesCredentials && connection.api_key
          ? connection.api_key
          : credentials.get(connection.pi_uri_base) ?? '',
    }))

    if (connections.length > 0) {
      await StorageService.savePiHoleSettingsArray(connections)
    }
    await StorageService.setLocalValues(
      preview.backup.preferences as Record<string, unknown>,
    )
  }

  public static async setSyncEnabled(enabled: boolean): Promise<void> {
    await StorageService.saveSettingsSyncEnabled(enabled)
    if (!enabled) {
      await chrome.storage.sync.remove(SYNC_KEY)
      return
    }
    await this.publishSafeSyncSnapshot()
  }

  public static async publishSafeSyncSnapshot(): Promise<void> {
    const backup = await this.createBackup(false)
    backup.includesCredentials = false
    backup.connections = backup.connections.map((connection) => ({
      pi_uri_base: connection.pi_uri_base,
      api_key: '',
    }))
    await chrome.storage.sync.set({ [SYNC_KEY]: backup })
  }

  public static async importSafeSyncSnapshot(): Promise<
    SettingsImportPreview | undefined
  > {
    const values = await chrome.storage.sync.get(SYNC_KEY)
    const snapshot = values[SYNC_KEY]
    if (!snapshot) {
      return undefined
    }

    const preview = parseSettingsBackup(JSON.stringify(snapshot))
    await this.applyImport(preview)
    return preview
  }
}
