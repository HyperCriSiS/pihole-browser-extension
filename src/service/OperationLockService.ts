type LockManagerLike = {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>
}

/**
 * Serializes mutating actions across extension pages. The Web Locks API is
 * shared by the extension origin and therefore coordinates popup, options and
 * background contexts. A per-context queue is retained as a compatibility
 * fallback.
 */
export default class OperationLockService {
  private static readonly fallbackQueues = new Map<string, Promise<unknown>>()

  public static async runExclusive<T>(
    resource: string,
    action: () => Promise<T>,
  ): Promise<T> {
    const lockManager = (navigator as Navigator & { locks?: LockManagerLike })
      .locks
    const name = `wormhole-connector:${resource}`

    if (lockManager) {
      return lockManager.request(name, action)
    }

    const previous = this.fallbackQueues.get(name) ?? Promise.resolve()
    let release: () => void = () => undefined
    const gate = new Promise<void>((resolve) => {
      release = resolve
    })
    const queued = previous.catch(() => undefined).then(() => gate)
    this.fallbackQueues.set(name, queued)

    await previous.catch(() => undefined)
    try {
      return await action()
    } finally {
      release()
      if (this.fallbackQueues.get(name) === queued) {
        this.fallbackQueues.delete(name)
      }
    }
  }
}
