import { getPiHoleEndpointKey } from './UrlService'

export type PiHoleSessionRecord = {
  sid: string
  endpoint: string
  createdAt: number
}

const SESSION_PREFIX = 'wormhole_connector_session:'

/**
 * Stores Pi-hole sessions in browser session storage so credentials never
 * become persistent extension data. Concurrent authentication attempts for the
 * same endpoint share one request across the current extension context.
 */
export default class SessionService {
  private static readonly pendingAcquisitions = new Map<
    string,
    Promise<PiHoleSessionRecord>
  >()

  public static async get(url: string): Promise<PiHoleSessionRecord | undefined> {
    const endpoint = getPiHoleEndpointKey(url)
    const result = await this.getSessionStorage().get(this.getKey(endpoint))
    const record = result[this.getKey(endpoint)] as
      | PiHoleSessionRecord
      | undefined

    return record?.endpoint === endpoint && record.sid ? record : undefined
  }

  public static async save(
    url: string,
    sid: string,
  ): Promise<PiHoleSessionRecord> {
    const endpoint = getPiHoleEndpointKey(url)
    const record: PiHoleSessionRecord = {
      sid,
      endpoint,
      createdAt: Date.now(),
    }
    await this.getSessionStorage().set({ [this.getKey(endpoint)]: record })
    return record
  }

  public static async remove(url: string): Promise<void> {
    const endpoint = getPiHoleEndpointKey(url)
    this.pendingAcquisitions.delete(endpoint)
    await this.getSessionStorage().remove(this.getKey(endpoint))
  }

  public static async clear(): Promise<void> {
    this.pendingAcquisitions.clear()
    const storage = this.getSessionStorage()
    const values = await storage.get(null)
    const keys = Object.keys(values).filter((key) => key.startsWith(SESSION_PREFIX))
    if (keys.length > 0) {
      await storage.remove(keys)
    }
  }

  public static async acquire(
    url: string,
    factory: () => Promise<string>,
    force = false,
  ): Promise<PiHoleSessionRecord> {
    const endpoint = getPiHoleEndpointKey(url)

    if (!force) {
      const existing = await this.get(url)
      if (existing) {
        return existing
      }
    } else {
      await this.remove(url)
    }

    const pending = this.pendingAcquisitions.get(endpoint)
    if (pending) {
      return pending
    }

    const acquisition = factory()
      .then((sid) => this.save(url, sid))
      .finally(() => {
        this.pendingAcquisitions.delete(endpoint)
      })

    this.pendingAcquisitions.set(endpoint, acquisition)
    return acquisition
  }

  private static getKey(endpoint: string): string {
    return `${SESSION_PREFIX}${endpoint}`
  }

  private static getSessionStorage(): chrome.storage.StorageArea {
    // Modern Firefox and Chromium expose storage.session. The in-memory-like
    // session area is mandatory for supported releases and is intentionally not
    // replaced by persistent local storage.
    if (!chrome.storage.session) {
      throw new Error('Browser session storage is unavailable')
    }
    return chrome.storage.session
  }
}
