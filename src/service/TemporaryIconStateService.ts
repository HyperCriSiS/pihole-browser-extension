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
    if (!domain) {
      return false
    }

    const storage = await this.getStorage()
    const now = Date.now()

    return Object.values(storage.actions).some(
      (action) =>
        action.domain === domain &&
        action.expiresAt > now &&
        (!groupName || action.groupName === groupName),
    )
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
