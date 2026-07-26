import ApiList from '../api/enum/ApiList'
import { PiHoleDomain } from '../api/models/PiHoleDomains'
import PiHoleApiService from './PiHoleApiService'
import { PiHoleSettingsStorage } from './StorageService'

const STORAGE_KEY = 'group_pause_actions_v1'
const ALARM_PREFIX = 'pihole.groupPause.'
const RESTORE_RETRY_DELAY = 60 * 1000
const GROUP_PAUSE_COMMENT =
  'Client-group pause by PiHole Browser Extension'

type GroupPauseTarget = {
  pi_uri_base: string
  original: PiHoleDomain | null
  expected: PiHoleDomain
}

type GroupPauseAction = {
  groupName: string
  pattern: string
  expiresAt: number | null
  targets: GroupPauseTarget[]
}

type GroupPauseStorage = {
  actions: Record<string, GroupPauseAction>
}

export default class GroupPauseService {
  public static async initialize(): Promise<void> {
    const storage = await this.getStorage()
    const now = Date.now()

    for (const [key, action] of Object.entries(storage.actions)) {
      if (action.expiresAt === null) {
        continue
      }

      if (action.expiresAt <= now) {
        await this.restoreAction(key)
      } else {
        await this.createAlarm(`${ALARM_PREFIX}${key}`, action.expiresAt)
      }
    }
  }

  public static async handleAlarm(alarmName: string): Promise<boolean> {
    if (!alarmName.startsWith(ALARM_PREFIX)) {
      return false
    }

    await this.restoreAction(alarmName.slice(ALARM_PREFIX.length))
    return true
  }

  public static async isGroupPaused(groupName: string): Promise<boolean> {
    if (!groupName) {
      return false
    }

    const pattern = this.createPausePattern(groupName)
    const piHoles = await PiHoleApiService.getConfiguredPiHoles()
    const states = await Promise.all(
      piHoles.map(async (piHole) => {
        const group = await PiHoleApiService.getGroup(piHole, groupName)
        if (!group) {
          throw new Error(`Group ${groupName} is missing on one Pi-hole`)
        }

        const domain = await PiHoleApiService.getRegexDomain(
          piHole,
          ApiList.whitelist,
          pattern,
        )
        return Boolean(domain?.enabled && domain.groups.includes(group.id))
      }),
    )

    return states.every(Boolean)
  }

  public static async pauseGroup(
    groupName: string,
    durationSeconds: number,
  ): Promise<boolean> {
    this.assertDuration(durationSeconds)
    if (!groupName) {
      throw new Error('Group name cannot be empty')
    }

    const key = encodeURIComponent(groupName)
    let storage = await this.getStorage()
    const existingAction = storage.actions[key]

    if (existingAction && (await this.isGroupPaused(groupName))) {
      existingAction.expiresAt = this.getExpiry(durationSeconds)
      await this.saveStorage(storage)
      await this.scheduleAction(key, existingAction.expiresAt)
      return true
    }

    if (existingAction) {
      delete storage.actions[key]
      await this.saveStorage(storage)
      await this.clearAlarm(`${ALARM_PREFIX}${key}`)
      storage = await this.getStorage()
    }

    const pattern = this.createPausePattern(groupName)
    const action: GroupPauseAction = {
      groupName,
      pattern,
      expiresAt: this.getExpiry(durationSeconds),
      targets: [],
    }

    try {
      const piHoles = await PiHoleApiService.getConfiguredPiHoles()
      for (const piHole of piHoles) {
        const group = await PiHoleApiService.getGroup(piHole, groupName)
        if (!group) {
          throw new Error(`Group ${groupName} is missing on one Pi-hole`)
        }

        const current = await PiHoleApiService.getRegexDomain(
          piHole,
          ApiList.whitelist,
          pattern,
        )
        if (current && current.comment !== GROUP_PAUSE_COMMENT) {
          throw new Error(
            `The reserved pause rule for group ${groupName} already exists`,
          )
        }

        const original =
          current?.comment === GROUP_PAUSE_COMMENT
            ? null
            : current
              ? this.cloneDomain(current)
              : null
        const payload = {
          comment: GROUP_PAUSE_COMMENT,
          groups: current
            ? Array.from(new Set([...current.groups, group.id]))
            : [group.id],
          enabled: true,
        }
        const expected = current
          ? await PiHoleApiService.replaceRegexDomain(
              piHole,
              ApiList.whitelist,
              pattern,
              payload,
            )
          : await PiHoleApiService.addRegexDomain(
              piHole,
              ApiList.whitelist,
              pattern,
              payload,
            )

        action.targets.push({
          pi_uri_base: piHole.pi_uri_base!,
          original,
          expected: this.cloneDomain(expected),
        })
        storage.actions[key] = action
        await this.saveStorage(storage)
      }

      if (action.targets.length < 1) {
        return false
      }

      storage.actions[key] = action
      await this.saveStorage(storage)
      await this.scheduleAction(key, action.expiresAt)
      return true
    } catch (reason) {
      const failedTargets = await this.restoreTargets(action)
      storage = await this.getStorage()

      if (failedTargets.length > 0) {
        action.targets = failedTargets
        action.expiresAt = Date.now() + RESTORE_RETRY_DELAY
        storage.actions[key] = action
        await this.saveStorage(storage)
        await this.createAlarm(`${ALARM_PREFIX}${key}`, action.expiresAt)
      } else {
        delete storage.actions[key]
        await this.saveStorage(storage)
      }

      throw reason
    }
  }

  public static async resumeGroup(groupName: string): Promise<void> {
    if (!groupName) {
      throw new Error('Group name cannot be empty')
    }

    const key = encodeURIComponent(groupName)
    const storage = await this.getStorage()
    const action = storage.actions[key]

    if (action) {
      const failedTargets = await this.restoreTargets(action)
      if (failedTargets.length > 0) {
        action.targets = failedTargets
        action.expiresAt = Date.now() + RESTORE_RETRY_DELAY
        storage.actions[key] = action
        await this.saveStorage(storage)
        await this.createAlarm(`${ALARM_PREFIX}${key}`, action.expiresAt)
        throw new Error(`Failed to resume blocking for group ${groupName}`)
      }

      delete storage.actions[key]
      await this.saveStorage(storage)
      await this.clearAlarm(`${ALARM_PREFIX}${key}`)
      return
    }

    await this.removeOrphanedPauseRule(groupName)
  }

  private static async restoreAction(key: string): Promise<void> {
    const storage = await this.getStorage()
    const action = storage.actions[key]
    if (!action) {
      return
    }

    const failedTargets = await this.restoreTargets(action)
    if (failedTargets.length > 0) {
      action.targets = failedTargets
      action.expiresAt = Date.now() + RESTORE_RETRY_DELAY
      storage.actions[key] = action
      await this.saveStorage(storage)
      await this.createAlarm(`${ALARM_PREFIX}${key}`, action.expiresAt)
      return
    }

    delete storage.actions[key]
    await this.saveStorage(storage)
    await this.clearAlarm(`${ALARM_PREFIX}${key}`)
  }

  private static async restoreTargets(
    action: GroupPauseAction,
  ): Promise<GroupPauseTarget[]> {
    const piHoles = await PiHoleApiService.getConfiguredPiHoles().catch(
      () => [],
    )
    const failedTargets: GroupPauseTarget[] = []

    for (const target of action.targets) {
      const piHole = this.findPiHole(piHoles, target.pi_uri_base)
      if (!piHole) {
        failedTargets.push(target)
        continue
      }

      try {
        const current = await PiHoleApiService.getRegexDomain(
          piHole,
          ApiList.whitelist,
          action.pattern,
        )

        // A newer manual change wins over the recorded temporary state.
        if (!current || !this.domainsEqual(current, target.expected)) {
          continue
        }

        if (target.original) {
          await PiHoleApiService.replaceRegexDomain(
            piHole,
            ApiList.whitelist,
            action.pattern,
            {
              comment: target.original.comment,
              groups: target.original.groups,
              enabled: target.original.enabled,
            },
          )
        } else {
          await PiHoleApiService.deleteRegexDomain(
            piHole,
            ApiList.whitelist,
            action.pattern,
          )
        }
      } catch (reason) {
        console.warn('Failed to restore client-group blocking', reason)
        failedTargets.push(target)
      }
    }

    return failedTargets
  }

  private static async removeOrphanedPauseRule(
    groupName: string,
  ): Promise<void> {
    const pattern = this.createPausePattern(groupName)
    const piHoles = await PiHoleApiService.getConfiguredPiHoles()

    await Promise.all(
      piHoles.map(async (piHole) => {
        const current = await PiHoleApiService.getRegexDomain(
          piHole,
          ApiList.whitelist,
          pattern,
        )
        if (current?.comment !== GROUP_PAUSE_COMMENT) {
          return
        }

        await PiHoleApiService.deleteRegexDomain(
          piHole,
          ApiList.whitelist,
          pattern,
        )
      }),
    )
  }

  private static createPausePattern(groupName: string): string {
    const suffix = Array.from(groupName)
      .map((character) => character.codePointAt(0)!.toString(16))
      .join('_')
    return `^.*$|^__pihole_browser_extension_pause_${suffix}__$`
  }

  private static getExpiry(durationSeconds: number): number | null {
    return durationSeconds === 0
      ? null
      : Date.now() + durationSeconds * 1000
  }

  private static async scheduleAction(
    key: string,
    expiresAt: number | null,
  ): Promise<void> {
    await this.clearAlarm(`${ALARM_PREFIX}${key}`)
    if (expiresAt !== null) {
      await this.createAlarm(`${ALARM_PREFIX}${key}`, expiresAt)
    }
  }

  private static findPiHole(
    piHoles: PiHoleSettingsStorage[],
    baseUrl: string,
  ): PiHoleSettingsStorage | undefined {
    return piHoles.find((piHole) => piHole.pi_uri_base === baseUrl)
  }

  private static domainsEqual(
    left: PiHoleDomain,
    right: PiHoleDomain,
  ): boolean {
    return (
      left.domain === right.domain &&
      left.type === right.type &&
      left.kind === right.kind &&
      left.comment === right.comment &&
      left.enabled === right.enabled &&
      this.numberArraysEqual(left.groups, right.groups)
    )
  }

  private static numberArraysEqual(left: number[], right: number[]): boolean {
    if (left.length !== right.length) {
      return false
    }

    const leftSorted = [...left].sort((a, b) => a - b)
    const rightSorted = [...right].sort((a, b) => a - b)
    return leftSorted.every((value, index) => value === rightSorted[index])
  }

  private static cloneDomain(domain: PiHoleDomain): PiHoleDomain {
    return { ...domain, groups: [...domain.groups] }
  }

  private static assertDuration(durationSeconds: number): void {
    if (!Number.isInteger(durationSeconds) || durationSeconds < 0) {
      throw new Error('Duration must be zero or a positive number of seconds')
    }
  }

  private static async getStorage(): Promise<GroupPauseStorage> {
    return new Promise((resolve) => {
      chrome.storage.local.get(STORAGE_KEY, (values) => {
        resolve(
          (values[STORAGE_KEY] as GroupPauseStorage | undefined) || {
            actions: {},
          },
        )
      })
    })
  }

  private static async saveStorage(storage: GroupPauseStorage): Promise<void> {
    await chrome.storage.local.set({ [STORAGE_KEY]: storage })
  }

  private static async createAlarm(name: string, when: number): Promise<void> {
    if (typeof browser !== 'undefined') {
      browser.alarms.create(name, { when })
      return
    }
    await chrome.alarms.create(name, { when })
  }

  private static async clearAlarm(name: string): Promise<void> {
    if (typeof browser !== 'undefined') {
      await browser.alarms.clear(name)
      return
    }
    await chrome.alarms.clear(name)
  }
}
