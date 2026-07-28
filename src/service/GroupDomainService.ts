import ApiList from '../api/enum/ApiList'
import type { PiHoleDomain } from '../api/models/PiHoleDomains'
import PiHoleApiService from './PiHoleApiService'
import type { PiHoleSettingsStorage } from './StorageService'

const STORAGE_KEY = 'temporary_group_domain_actions_v2'
const ALARM_PREFIX = 'pihole.temporaryGroupDomain.'
const RESTORE_RETRY_DELAY = 60 * 1000
const TEMPORARY_ALLOW_COMMENT =
  'Temporary group allow by PiHole Browser Extension'
const PERMANENT_RULE_COMMENT = 'From PiHole Extension'

type TemporaryTarget = {
  pi_uri_base: string
  groupId: number
  original: PiHoleDomain | null
  expected: PiHoleDomain
}

type TemporaryAction = {
  domain: string
  groupName: string
  expiresAt: number
  targets: TemporaryTarget[]
}

type TemporaryStorage = {
  actions: Record<string, TemporaryAction>
}

export default class GroupDomainService {
  public static async initialize(): Promise<void> {
    const storage = await this.getStorage()
    const now = Date.now()

    for (const [key, action] of Object.entries(storage.actions)) {
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

  public static async setDomainListForGroup(
    list: ApiList,
    domain: string,
    groupName: string,
  ): Promise<void> {
    this.assertDomainAndGroup(domain, groupName)
    await this.cancelTemporaryAllowForGroup(domain, groupName)

    const oppositeList =
      list === ApiList.whitelist ? ApiList.blacklist : ApiList.whitelist
    const piHoles = await PiHoleApiService.getConfiguredPiHoles()

    for (const piHole of piHoles) {
      const group = await PiHoleApiService.getGroup(piHole, groupName)
      if (!group) {
        throw new Error(`Group ${groupName} is missing on one Pi-hole`)
      }

      await this.removeGroupFromDomain(piHole, oppositeList, domain, group.id)
      await this.addGroupToDomain(piHole, list, domain, group.id)
    }
  }

  public static async temporarilyAllowDomainForGroup(
    domain: string,
    groupName: string,
    durationSeconds: number,
  ): Promise<boolean> {
    this.assertDomainAndGroup(domain, groupName)
    this.assertDuration(durationSeconds)

    const key = this.createActionKey(domain, groupName)
    let storage = await this.getStorage()
    const existingAction = storage.actions[key]

    if (existingAction && existingAction.expiresAt > Date.now()) {
      existingAction.expiresAt = Date.now() + durationSeconds * 1000
      await this.saveStorage(storage)
      await this.createAlarm(`${ALARM_PREFIX}${key}`, existingAction.expiresAt)
      return true
    }

    if (existingAction) {
      await this.restoreAction(key)
      storage = await this.getStorage()
    }

    const action: TemporaryAction = {
      domain,
      groupName,
      expiresAt: Date.now() + durationSeconds * 1000,
      targets: [],
    }

    try {
      const piHoles = await PiHoleApiService.getConfiguredPiHoles()
      for (const piHole of piHoles) {
        const group = await PiHoleApiService.getGroup(piHole, groupName)
        if (!group) {
          throw new Error(`Group ${groupName} is missing on one Pi-hole`)
        }

        const current = await PiHoleApiService.getExactDomain(
          piHole,
          ApiList.whitelist,
          domain,
        )
        if (current?.enabled && current.groups.includes(group.id)) {
          continue
        }

        const payload = {
          comment: current?.comment ?? TEMPORARY_ALLOW_COMMENT,
          groups: current
            ? Array.from(new Set([...current.groups, group.id]))
            : [group.id],
          enabled: true,
        }
        const expected = current
          ? await PiHoleApiService.replaceExactDomain(
              piHole,
              ApiList.whitelist,
              domain,
              payload,
            )
          : await PiHoleApiService.addExactDomain(
              piHole,
              ApiList.whitelist,
              domain,
              payload,
            )

        action.targets.push({
          pi_uri_base: piHole.pi_uri_base!,
          groupId: group.id,
          original: current ? this.cloneDomain(current) : null,
          expected: this.cloneDomain(expected),
        })
        storage.actions[key] = action
        await this.saveStorage(storage)
      }

      if (action.targets.length === 0) {
        return true
      }

      storage.actions[key] = action
      await this.saveStorage(storage)
      await this.createAlarm(`${ALARM_PREFIX}${key}`, action.expiresAt)
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

  public static async cancelTemporaryAllowsForDomain(
    domain: string,
  ): Promise<void> {
    const storage = await this.getStorage()
    const matchingKeys = Object.entries(storage.actions)
      .filter(([, action]) => action.domain === domain)
      .map(([key]) => key)

    for (const key of matchingKeys) {
      delete storage.actions[key]
      await this.clearAlarm(`${ALARM_PREFIX}${key}`)
    }

    if (matchingKeys.length > 0) {
      await this.saveStorage(storage)
    }
  }

  private static async cancelTemporaryAllowForGroup(
    domain: string,
    groupName: string,
  ): Promise<void> {
    const key = this.createActionKey(domain, groupName)
    const storage = await this.getStorage()
    if (!storage.actions[key]) {
      return
    }

    delete storage.actions[key]
    await this.saveStorage(storage)
    await this.clearAlarm(`${ALARM_PREFIX}${key}`)
  }

  private static async addGroupToDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    groupId: number,
  ): Promise<void> {
    const current = await PiHoleApiService.getExactDomain(piHole, list, domain)
    if (!current) {
      await PiHoleApiService.addExactDomain(piHole, list, domain, {
        comment: PERMANENT_RULE_COMMENT,
        groups: [groupId],
        enabled: true,
      })
      return
    }

    if (current.enabled && current.groups.includes(groupId)) {
      return
    }

    await PiHoleApiService.replaceExactDomain(piHole, list, domain, {
      comment: current.comment,
      groups: Array.from(new Set([...current.groups, groupId])),
      enabled: true,
    })
  }

  private static async removeGroupFromDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    groupId: number,
  ): Promise<void> {
    const current = await PiHoleApiService.getExactDomain(piHole, list, domain)
    if (!current?.groups.includes(groupId)) {
      return
    }

    const remainingGroups = current.groups.filter((id) => id !== groupId)
    if (remainingGroups.length === 0) {
      await PiHoleApiService.deleteExactDomain(piHole, list, domain)
      return
    }

    await PiHoleApiService.replaceExactDomain(piHole, list, domain, {
      comment: current.comment,
      groups: remainingGroups,
      enabled: current.enabled,
    })
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
    action: TemporaryAction,
  ): Promise<TemporaryTarget[]> {
    const piHoles = await PiHoleApiService.getConfiguredPiHoles().catch(
      () => [],
    )
    const failedTargets: TemporaryTarget[] = []

    for (const target of action.targets) {
      const piHole = this.findPiHole(piHoles, target.pi_uri_base)
      if (!piHole) {
        failedTargets.push(target)
        continue
      }

      try {
        const current = await PiHoleApiService.getExactDomain(
          piHole,
          ApiList.whitelist,
          action.domain,
        )
        if (!current) {
          continue
        }

        if (this.domainsEqual(current, target.expected)) {
          if (target.original) {
            await PiHoleApiService.replaceExactDomain(
              piHole,
              ApiList.whitelist,
              action.domain,
              {
                comment: target.original.comment,
                groups: target.original.groups,
                enabled: target.original.enabled,
              },
            )
          } else {
            await PiHoleApiService.deleteExactDomain(
              piHole,
              ApiList.whitelist,
              action.domain,
            )
          }
          continue
        }

        const groupWasAddedTemporarily = !target.original?.groups.includes(
          target.groupId,
        )
        const looksLikeManagedOverlap =
          groupWasAddedTemporarily &&
          current.enabled === target.expected.enabled &&
          current.comment === target.expected.comment &&
          current.groups.includes(target.groupId)

        if (!looksLikeManagedOverlap) {
          continue
        }

        const remainingGroups = current.groups.filter(
          (groupId) => groupId !== target.groupId,
        )
        if (remainingGroups.length === 0 && !target.original) {
          await PiHoleApiService.deleteExactDomain(
            piHole,
            ApiList.whitelist,
            action.domain,
          )
          continue
        }

        if (
          target.original &&
          this.numberArraysEqual(remainingGroups, target.original.groups)
        ) {
          await PiHoleApiService.replaceExactDomain(
            piHole,
            ApiList.whitelist,
            action.domain,
            {
              comment: target.original.comment,
              groups: target.original.groups,
              enabled: target.original.enabled,
            },
          )
          continue
        }

        await PiHoleApiService.replaceExactDomain(
          piHole,
          ApiList.whitelist,
          action.domain,
          {
            comment: current.comment,
            groups: remainingGroups,
            enabled: current.enabled,
          },
        )
      } catch (reason) {
        console.warn('Failed to restore temporary group domain allow', reason)
        failedTargets.push(target)
      }
    }

    return failedTargets
  }

  private static createActionKey(domain: string, groupName: string): string {
    return encodeURIComponent(`${domain}::${groupName}`)
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

  private static assertDomainAndGroup(domain: string, groupName: string): void {
    if (!domain) {
      throw new Error("Domain can't be empty")
    }
    if (!groupName) {
      throw new Error('Group name cannot be empty')
    }
  }

  private static assertDuration(durationSeconds: number): void {
    if (!Number.isInteger(durationSeconds) || durationSeconds < 1) {
      throw new Error('Duration must be a positive number of seconds')
    }
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

  private static async saveStorage(storage: TemporaryStorage): Promise<void> {
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
