import OperationLockService from './OperationLockService'

export type TransactionParticipant<TSnapshot, TResult> = {
  id: string
  preflight: () => Promise<TSnapshot>
  apply: (snapshot: TSnapshot) => Promise<TResult>
  rollback: (snapshot: TSnapshot) => Promise<void>
}

export type TransactionRecoveryRecord<TSnapshot = unknown> = {
  operation: string
  startedAt: number
  participantIds: string[]
  snapshots: Record<string, TSnapshot>
  appliedParticipantIds: string[]
  rollbackFailures: string[]
}

export class MultiInstanceTransactionError extends Error {
  public constructor(
    message: string,
    public readonly cause: unknown,
    public readonly rollbackFailures: string[],
  ) {
    super(message)
    this.name = 'MultiInstanceTransactionError'
  }
}

const RECOVERY_KEY = 'wormhole_connector_pending_transaction'

/**
 * Executes a mutation on multiple configured blockers as one best-effort
 * transaction: every target is checked first, mutations are serialized, and a
 * failure rolls already changed targets back in reverse order. A crash-safe
 * recovery record remains available when rollback itself is incomplete.
 */
export default class MultiInstanceTransactionService {
  public static async run<TSnapshot, TResult>(
    operation: string,
    participants: TransactionParticipant<TSnapshot, TResult>[],
  ): Promise<TResult[]> {
    if (participants.length === 0) {
      return []
    }

    return OperationLockService.runExclusive(`transaction:${operation}`, async () => {
      const snapshots = new Map<string, TSnapshot>()
      for (const participant of participants) {
        snapshots.set(participant.id, await participant.preflight())
      }

      const record: TransactionRecoveryRecord<TSnapshot> = {
        operation,
        startedAt: Date.now(),
        participantIds: participants.map(({ id }) => id),
        snapshots: Object.fromEntries(snapshots),
        appliedParticipantIds: [],
        rollbackFailures: [],
      }
      await this.saveRecoveryRecord(record)

      const results: TResult[] = []
      const applied: TransactionParticipant<TSnapshot, TResult>[] = []

      try {
        for (const participant of participants) {
          const snapshot = snapshots.get(participant.id) as TSnapshot
          results.push(await participant.apply(snapshot))
          applied.push(participant)
          record.appliedParticipantIds.push(participant.id)
          await this.saveRecoveryRecord(record)
        }

        await this.clearRecoveryRecord()
        return results
      } catch (cause) {
        for (const participant of [...applied].reverse()) {
          try {
            await participant.rollback(snapshots.get(participant.id) as TSnapshot)
          } catch (rollbackError) {
            console.error(
              `Rollback failed for ${participant.id} during ${operation}`,
              rollbackError,
            )
            record.rollbackFailures.push(participant.id)
          }
        }

        if (record.rollbackFailures.length === 0) {
          await this.clearRecoveryRecord()
        } else {
          await this.saveRecoveryRecord(record)
        }

        throw new MultiInstanceTransactionError(
          `The operation '${operation}' failed and was rolled back where possible.`,
          cause,
          record.rollbackFailures,
        )
      }
    })
  }

  public static async getRecoveryRecord(): Promise<
    TransactionRecoveryRecord | undefined
  > {
    const values = await chrome.storage.local.get(RECOVERY_KEY)
    return values[RECOVERY_KEY] as TransactionRecoveryRecord | undefined
  }

  public static async clearRecoveryRecord(): Promise<void> {
    await chrome.storage.local.remove(RECOVERY_KEY)
  }

  private static async saveRecoveryRecord(
    record: TransactionRecoveryRecord,
  ): Promise<void> {
    await chrome.storage.local.set({ [RECOVERY_KEY]: record })
  }
}
