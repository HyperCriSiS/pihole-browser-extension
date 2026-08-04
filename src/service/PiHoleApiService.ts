import axios, { AxiosInstance, AxiosResponse } from 'axios'
import { PiHoleApiStatus } from '../api/models/PiHoleApiStatus'
import { PiHoleSettingsStorage, StorageService } from './StorageService'
import { PiHoleVersionsV6 } from '../api/models/PiHoleVersions'
import ApiListMode from '../api/enum/ApiListMode'
import ApiList from '../api/enum/ApiList'
import PiHoleApiStatusEnum from '../api/enum/PiHoleApiStatusEnum'
import { PiHoleAuth } from '../api/models/PiHoleAuth'
import { PiHoleDomain, PiHoleDomains } from '../api/models/PiHoleDomains'
import { PiHoleGroup, PiHoleGroups } from '../api/models/PiHoleGroups'
import { PiHoleSearchResponse } from '../api/models/PiHoleSearch'
import SessionService from './SessionService'
import {
  getPiHoleApiBaseUrl,
  getPiHoleEndpointKey,
} from './UrlService'
import MultiInstanceTransactionService from './MultiInstanceTransactionService'

export type DomainMutationPayload = {
  comment: string | null
  groups: number[]
  enabled: boolean
}

export type CombinedPiHoleStatus =
  | PiHoleApiStatusEnum.enabled
  | PiHoleApiStatusEnum.disabled
  | PiHoleApiStatusEnum.error
  | PiHoleApiStatusEnum.unknown
  | 'mixed'

export type PiHoleStatusSummary = {
  status: CombinedPiHoleStatus
  instances: Array<{
    endpoint: string
    status: PiHoleApiStatusEnum
  }>
}

type DomainListSnapshot = {
  current?: PiHoleDomain
  groupIds: number[]
}

export default class PiHoleApiService {
  public static async getConfiguredPiHoles(): Promise<PiHoleSettingsStorage[]> {
    const piHoleSettingsArray = await StorageService.getPiHoleSettingsArray()
    if (!piHoleSettingsArray || piHoleSettingsArray.length < 1) {
      return Promise.reject('PiHoleSettings empty')
    }

    for (const piHole of piHoleSettingsArray) {
      if (!piHole.pi_uri_base || typeof piHole.api_key === 'undefined') {
        return Promise.reject('Some PiHoleSettings are undefined.')
      }
    }

    return piHoleSettingsArray
  }

  public static async getPiHoleStatusSummary(): Promise<PiHoleStatusSummary> {
    const piHoles = await this.getConfiguredPiHoles()
    const instances = await Promise.all(
      piHoles.map(async (piHole) => {
        try {
          const status = await this.getPiHoleStatusFor(piHole)
          return {
            endpoint: getPiHoleEndpointKey(piHole.pi_uri_base!),
            status: status.blocking,
          }
        } catch (reason) {
          console.warn(reason)
          return {
            endpoint: getPiHoleEndpointKey(piHole.pi_uri_base!),
            status: PiHoleApiStatusEnum.error,
          }
        }
      }),
    )

    const uniqueStates = new Set(instances.map(({ status }) => status))
    return {
      status:
        uniqueStates.size === 1
          ? instances[0].status
          : uniqueStates.has(PiHoleApiStatusEnum.error)
            ? PiHoleApiStatusEnum.error
            : 'mixed',
      instances,
    }
  }

  public static async getPiHoleStatusCombined(): Promise<PiHoleApiStatusEnum> {
    try {
      const summary = await this.getPiHoleStatusSummary()
      return summary.status === 'mixed'
        ? PiHoleApiStatusEnum.unknown
        : summary.status
    } catch (reason) {
      console.warn(reason)
      return PiHoleApiStatusEnum.error
    }
  }

  public static async getPiHoleStatus(): Promise<
    AxiosResponse<PiHoleApiStatus>[]
  > {
    const piHoleSettingsArray = await this.getConfiguredPiHoles()
    return Promise.all(
      piHoleSettingsArray.map((piHole) =>
        this.getAxiosInstance(
          piHole.pi_uri_base!,
          piHole.api_key,
        ).get<PiHoleApiStatus>('/dns/blocking'),
      ),
    )
  }

  public static async getPiHoleStatusFor(
    piHole: PiHoleSettingsStorage,
  ): Promise<PiHoleApiStatus> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).get<PiHoleApiStatus>('/dns/blocking')
    return response.data
  }

  public static async getPiHoleVersion(
    piHole: PiHoleSettingsStorage,
  ): Promise<AxiosResponse<PiHoleVersionsV6>> {
    this.assertValidPiHole(piHole)
    return this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).get<PiHoleVersionsV6>('/info/version')
  }

  public static async changePiHoleStatus(
    mode: PiHoleApiStatusEnum,
    time: number,
  ): Promise<AxiosResponse<PiHoleApiStatus>[]> {
    const piHoles = await this.getConfiguredPiHoles()

    if (time < 0) {
      return Promise.reject(`Disable time smaller than allowed:${time}`)
    }

    let blocking: boolean
    if (mode === PiHoleApiStatusEnum.disabled) {
      blocking = false
    } else if (mode === PiHoleApiStatusEnum.enabled) {
      blocking = true
    } else {
      return Promise.reject(`Mode ${mode} not allowed for this function.`)
    }

    return MultiInstanceTransactionService.run(
      `global-blocking:${blocking ? 'enable' : 'disable'}`,
      piHoles.map((piHole) => ({
        id: getPiHoleEndpointKey(piHole.pi_uri_base!),
        preflight: async () => {
          const status = await this.getPiHoleStatusFor(piHole)
          if (
            status.blocking !== PiHoleApiStatusEnum.enabled &&
            status.blocking !== PiHoleApiStatusEnum.disabled
          ) {
            throw new Error(
              `Unable to determine blocking state for ${piHole.pi_uri_base}`,
            )
          }
          return status
        },
        apply: () =>
          this.getAxiosInstance(
            piHole.pi_uri_base!,
            piHole.api_key,
          ).post<PiHoleApiStatus>('/dns/blocking', {
            blocking,
            timer: time === 0 || blocking ? null : time,
          }),
        rollback: async (snapshot) => {
          await this.getAxiosInstance(
            piHole.pi_uri_base!,
            piHole.api_key,
          ).post<PiHoleApiStatus>('/dns/blocking', {
            blocking: snapshot.blocking === PiHoleApiStatusEnum.enabled,
            timer: null,
          })
        },
      })),
    )
  }

  public static async addDomainToList(
    list: ApiList,
    domain: string,
  ): Promise<void> {
    return this.changeDomainOnList(list, ApiListMode.add, domain)
  }

  public static async subDomainFromList(
    list: ApiList,
    domain: string,
  ): Promise<void> {
    return this.changeDomainOnList(list, ApiListMode.sub, domain)
  }

  public static async getExactDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
  ): Promise<PiHoleDomain | undefined> {
    return this.getDomain(piHole, list, 'exact', domain)
  }

  public static async addExactDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    return this.addDomain(piHole, list, 'exact', domain, payload)
  }

  public static async replaceExactDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    return this.replaceDomain(piHole, list, 'exact', domain, payload)
  }

  public static async deleteExactDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
  ): Promise<void> {
    return this.deleteDomain(piHole, list, 'exact', domain)
  }

  public static async getRegexDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
  ): Promise<PiHoleDomain | undefined> {
    return this.getDomain(piHole, list, 'regex', domain)
  }

  public static async addRegexDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    return this.addDomain(piHole, list, 'regex', domain, payload)
  }

  public static async replaceRegexDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    return this.replaceDomain(piHole, list, 'regex', domain, payload)
  }

  public static async deleteRegexDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
  ): Promise<void> {
    return this.deleteDomain(piHole, list, 'regex', domain)
  }

  public static async searchDomain(
    piHole: PiHoleSettingsStorage,
    domain: string,
  ): Promise<PiHoleSearchResponse> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).get<PiHoleSearchResponse>(
      `/search/${encodeURIComponent(domain)}?partial=false&N=100`,
    )
    return response.data
  }

  public static async getGroups(
    piHole: PiHoleSettingsStorage,
  ): Promise<PiHoleGroup[]> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).get<PiHoleGroups>('/groups')
    return response.data.groups
  }

  public static async getCommonGroups(): Promise<PiHoleGroup[]> {
    const piHoles = await this.getConfiguredPiHoles()
    const groupSets = await Promise.all(
      piHoles.map((piHole) => this.getGroups(piHole)),
    )

    const firstGroups = groupSets[0]
    if (groupSets.length === 1) {
      return firstGroups
    }

    const remainingGroupNames = groupSets
      .slice(1)
      .map((groups) => new Set(groups.map((group) => group.name)))

    return firstGroups.filter((group) =>
      remainingGroupNames.every((names) => names.has(group.name)),
    )
  }

  public static async getGroup(
    piHole: PiHoleSettingsStorage,
    name: string,
  ): Promise<PiHoleGroup | undefined> {
    this.assertValidPiHole(piHole)

    try {
      const response = await this.getAxiosInstance(
        piHole.pi_uri_base!,
        piHole.api_key,
      ).get<PiHoleGroups>(`/groups/${encodeURIComponent(name)}`)
      return response.data.groups[0]
    } catch (reason) {
      if (this.isNotFound(reason)) {
        return undefined
      }
      throw reason
    }
  }

  public static async replaceGroup(
    piHole: PiHoleSettingsStorage,
    originalName: string,
    group: Pick<PiHoleGroup, 'name' | 'comment' | 'enabled'>,
  ): Promise<PiHoleGroup> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).put<PiHoleGroups>(`/groups/${encodeURIComponent(originalName)}`, group)

    const updatedGroup = response.data.groups[0]
    if (!updatedGroup) {
      throw new Error(`Pi-hole did not return updated group ${originalName}`)
    }
    return updatedGroup
  }

  public static async closeSession(
    piHole: PiHoleSettingsStorage,
  ): Promise<void> {
    if (!piHole.pi_uri_base) {
      return
    }

    const session = await SessionService.get(piHole.pi_uri_base)
    if (!session) {
      return
    }

    try {
      await this.createAxiosBaseInstance(piHole.pi_uri_base).delete('/auth', {
        headers: { 'X-FTL-SID': session.sid },
      })
    } catch (reason) {
      console.warn('Unable to close Pi-hole session cleanly', reason)
    } finally {
      await SessionService.remove(piHole.pi_uri_base)
    }
  }

  public static async closeAllSessions(
    piHoles?: PiHoleSettingsStorage[],
  ): Promise<void> {
    const configured =
      piHoles ?? (await StorageService.getPiHoleSettingsArray()) ?? []
    await Promise.all(configured.map((piHole) => this.closeSession(piHole)))
    await SessionService.clear()
  }

  private static async getDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    kind: 'exact' | 'regex',
    domain: string,
  ): Promise<PiHoleDomain | undefined> {
    this.assertValidPiHole(piHole)

    try {
      const response = await this.getAxiosInstance(
        piHole.pi_uri_base!,
        piHole.api_key,
      ).get<PiHoleDomains>(
        `/domains/${list}/${kind}/${encodeURIComponent(domain)}`,
      )
      return response.data.domains[0]
    } catch (reason) {
      if (this.isNotFound(reason)) {
        return undefined
      }
      throw reason
    }
  }

  private static async addDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    kind: 'exact' | 'regex',
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).post<PiHoleDomains>(`/domains/${list}/${kind}`, {
      domain,
      ...payload,
    })
    return this.requireDomain(response.data, domain)
  }

  private static async replaceDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    kind: 'exact' | 'regex',
    domain: string,
    payload: DomainMutationPayload,
  ): Promise<PiHoleDomain> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).put<PiHoleDomains>(
      `/domains/${list}/${kind}/${encodeURIComponent(domain)}`,
      {
        type: list,
        kind,
        ...payload,
      },
    )
    return this.requireDomain(response.data, domain)
  }

  private static async deleteDomain(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    kind: 'exact' | 'regex',
    domain: string,
  ): Promise<void> {
    this.assertValidPiHole(piHole)
    await this.getAxiosInstance(piHole.pi_uri_base!, piHole.api_key).delete(
      `/domains/${list}/${kind}/${encodeURIComponent(domain)}`,
    )
  }

  private static async changeDomainOnList(
    list: ApiList,
    mode: ApiListMode,
    domain: string,
  ): Promise<void> {
    const piHoles = await this.getConfiguredPiHoles()
    if (domain.length < 1) {
      return Promise.reject("Domain can't be empty")
    }

    await MultiInstanceTransactionService.run<DomainListSnapshot, void>(
      `domain-list:${list}:${mode}:${domain}`,
      piHoles.map((piHole) => ({
        id: getPiHoleEndpointKey(piHole.pi_uri_base!),
        preflight: async () => {
          const [current, groups] = await Promise.all([
            this.getExactDomain(piHole, list, domain),
            mode === ApiListMode.add
              ? this.getGroups(piHole)
              : Promise.resolve([] as PiHoleGroup[]),
          ])
          const groupIds = groups.map((group) => group.id)
          if (mode === ApiListMode.add && groupIds.length < 1) {
            throw new Error('Pi-hole did not return any client groups')
          }
          return { current, groupIds }
        },
        apply: async ({ current, groupIds }) => {
          if (mode === ApiListMode.add) {
            if (!current) {
              await this.addExactDomain(piHole, list, domain, {
                comment: 'From Wormhole Connector',
                groups: groupIds,
                enabled: true,
              })
              return
            }

            const hasExactlyAllGroups =
              current.groups.length === groupIds.length &&
              groupIds.every((groupId) => current.groups.includes(groupId))
            if (!current.enabled || !hasExactlyAllGroups) {
              await this.replaceExactDomain(piHole, list, domain, {
                comment: current.comment,
                groups: groupIds,
                enabled: true,
              })
            }
            return
          }

          if (current) {
            await this.deleteExactDomain(piHole, list, domain)
          }
        },
        rollback: (snapshot) =>
          this.restoreExactDomainSnapshot(piHole, list, domain, snapshot.current),
      })),
    )
  }

  private static async restoreExactDomainSnapshot(
    piHole: PiHoleSettingsStorage,
    list: ApiList,
    domain: string,
    snapshot?: PiHoleDomain,
  ): Promise<void> {
    const current = await this.getExactDomain(piHole, list, domain)
    if (!snapshot) {
      if (current) {
        await this.deleteExactDomain(piHole, list, domain)
      }
      return
    }

    const payload: DomainMutationPayload = {
      comment: snapshot.comment,
      groups: snapshot.groups,
      enabled: snapshot.enabled,
    }
    if (current) {
      await this.replaceExactDomain(piHole, list, domain, payload)
    } else {
      await this.addExactDomain(piHole, list, domain, payload)
    }
  }

  private static requireDomain(
    response: PiHoleDomains,
    domain: string,
  ): PiHoleDomain {
    const updatedDomain = response.domains.find((item) => item.domain === domain)
    if (!updatedDomain) {
      throw new Error(`Pi-hole did not return updated domain ${domain}`)
    }
    return updatedDomain
  }

  private static assertValidPiHole(piHole: PiHoleSettingsStorage): void {
    if (!piHole.pi_uri_base || typeof piHole.api_key === 'undefined') {
      throw new Error('Some PiHoleSettings are undefined.')
    }
  }

  private static isNotFound(reason: unknown): boolean {
    return Boolean(
      reason &&
        typeof reason === 'object' &&
        'response' in reason &&
        (reason as { response?: { status?: number } }).response?.status === 404,
    )
  }

  private static createAxiosBaseInstance(domain: string): AxiosInstance {
    return axios.create({
      baseURL: getPiHoleApiBaseUrl(domain),
      adapter: 'fetch',
      withCredentials: false,
    })
  }

  private static getAxiosInstance(
    domain: string,
    apiKey?: string,
  ): AxiosInstance {
    const instance = this.createAxiosBaseInstance(domain)

    const acquireSid = async (force = false) =>
      SessionService.acquire(
        domain,
        async () => {
          const auth = await this.createAxiosBaseInstance(domain).post<PiHoleAuth>(
            '/auth',
            { password: apiKey },
          )
          return auth.data.session.sid
        },
        force,
      )

    instance.interceptors.request.use(async (config) => {
      if (!apiKey || config.url === '/auth') {
        return config
      }

      const session = await acquireSid()
      config.headers['X-FTL-SID'] = session.sid
      return config
    })

    instance.interceptors.response.use(undefined, async (error) => {
      const requestConfig = error.config as typeof error.config & {
        wormholeAuthRetried?: boolean
      }
      const isAuthRoute = requestConfig?.url === '/auth'
      const isUnauthorized = error.response?.status === 401

      if (
        isUnauthorized &&
        !isAuthRoute &&
        requestConfig &&
        !requestConfig.wormholeAuthRetried
      ) {
        requestConfig.wormholeAuthRetried = true
        console.warn('Session expired, acquiring a new Pi-hole session')
        const session = await acquireSid(true)
        requestConfig.headers['X-FTL-SID'] = session.sid
        return instance.request(requestConfig)
      }
      return Promise.reject(error)
    })

    return instance
  }
}
