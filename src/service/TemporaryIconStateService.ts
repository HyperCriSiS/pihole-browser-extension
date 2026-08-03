const STORAGE_KEY = 'temporary_group_domain_actions_v2'

type TemporaryAction = {
  domain: string
  groupName: string
  expiresAt: number
}

type TemporaryStorage = {
  actions: Record<string, TemporaryAction>
}

export default class TemporaryIconStateService {
  public static async isActive(
    domain: string,
    groupName?: string | null,
  ): Promise<boolean> {
    return (await this.getRemainingSeconds(domain, groupName)) !== null
  }

  public static async getRemainingSeconds(
    domain: string,
    groupName?: string | null,
  ): Promise<number | null> {
    if (!domain) {
      return null
    }

    const storage = await this.getStorage()
    const now = Date.now()

    const matchingExpiryTimes = Object.values(storage.actions)
      .filter(
        (action) =>
          action.domain === domain &&
          action.expiresAt > now &&
          (!groupName || action.groupName === groupName),
      )
      .map((action) => action.expiresAt)

    if (matchingExpiryTimes.length === 0) {
      return null
    }

    return Math.ceil((Math.max(...matchingExpiryTimes) - now) / 1000)
  }

  private static async getStorage(): Promise<TemporaryStorage> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (values) => {
        resolve(
          (values[STORAGE_KEY] as TemporaryStorage | undefined) || {
            actions: {},
          },
        )
      })
    })
  }
}
