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

export type DomainMutationPayload = {
  comment: string | null
  groups: number[]
  enabled: boolean
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

  public static async getPiHoleStatusCombined(): Promise<PiHoleApiStatusEnum> {
    try {
      const results = await this.getPiHoleStatus()
      const hasError = results.some(
        (result) => result.data.blocking === PiHoleApiStatusEnum.error,
      )
      if (hasError) {
        return PiHoleApiStatusEnum.error
      }

      const hasDisabled = results.some(
        (result) => result.data.blocking === PiHoleApiStatusEnum.disabled,
      )
      return hasDisabled
        ? PiHoleApiStatusEnum.disabled
        : PiHoleApiStatusEnum.enabled
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
    const piHoleSettingsArray = await this.getConfiguredPiHoles()

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

    return Promise.all(
      piHoleSettingsArray.map((piHole) =>
        this.getAxiosInstance(
          piHole.pi_uri_base!,
          piHole.api_key,
        ).post<PiHoleApiStatus>('/dns/blocking', {
          blocking,
          timer: time === 0 || blocking ? null : time,
        }),
      ),
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

  public static async getCommonGroups(): Promise<PiHoleGroup[]> {
    const piHoles = await this.getConfiguredPiHoles()
    const responses = await Promise.all(
      piHoles.map((piHole) =>
        this.getAxiosInstance(
          piHole.pi_uri_base!,
          piHole.api_key,
        ).get<PiHoleGroups>('/groups'),
      ),
    )

    const firstGroups = responses[0].data.groups
    if (responses.length === 1) {
      return firstGroups
    }

    const remainingGroupNames = responses
      .slice(1)
      .map(
        (response) => new Set(response.data.groups.map((group) => group.name)),
      )

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
    const piHoleSettingsArray = await this.getConfiguredPiHoles()

    if (domain.length < 1) {
      return Promise.reject("Domain can't be empty")
    }

    await Promise.all(
      piHoleSettingsArray.map(async (piHole) => {
        if (mode === ApiListMode.add) {
          const current = await this.getExactDomain(piHole, list, domain)
          if (!current) {
            await this.addExactDomain(piHole, list, domain, {
              comment: 'From PiHole Extension',
              groups: [0],
              enabled: true,
            })
            return
          }

          if (!current.enabled || !current.groups.includes(0)) {
            await this.replaceExactDomain(piHole, list, domain, {
              comment: current.comment,
              groups: Array.from(new Set([...current.groups, 0])),
              enabled: true,
            })
          }
          return
        }

        try {
          await this.deleteExactDomain(piHole, list, domain)
        } catch (reason) {
          if (!this.isNotFound(reason)) {
            throw reason
          }
        }
      }),
    )
  }

  private static requireDomain(
    response: PiHoleDomains,
    domain: string,
  ): PiHoleDomain {
    const updatedDomain = response.domains.find(
      (item) => item.domain === domain,
    )
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
      baseURL: new URL('/api', new URL(domain)).toString(),
      adapter: 'fetch',
      withCredentials: false,
    })
  }

  private static getAxiosInstance(
    domain: string,
    apiKey?: string,
  ): AxiosInstance {
    const instance = this.createAxiosBaseInstance(domain)

    const acquireSid = async () => {
      const axiosInstance = this.createAxiosBaseInstance(domain)
      const auth = await axiosInstance.post<PiHoleAuth>('/auth', {
        password: apiKey,
      })
      return auth.data.session
    }

    instance.interceptors.request.use(async (config) => {
      if (!apiKey) {
        return config
      }

      const sid = await StorageService.getSid(domain)
      if (sid) {
        config.headers['X-FTL-SID'] = sid
        return config
      }

      const session = await acquireSid()
      await StorageService.saveSid(domain, session.sid)

      config.headers['X-FTL-SID'] = session.sid
      return config
    })

    instance.interceptors.response.use(undefined, async (error) => {
      const requestConfig = error.config as typeof error.config & {
        piholeAuthRetried?: boolean
      }
      const isAuthRoute = requestConfig?.url === '/auth'
      const isUnauthorized = error.response?.status === 401

      if (
        isUnauthorized &&
        !isAuthRoute &&
        requestConfig &&
        !requestConfig.piholeAuthRetried
      ) {
        requestConfig.piholeAuthRetried = true
        console.warn('Session expired, acquiring new session')
        const session = await acquireSid()
        await StorageService.saveSid(domain, session.sid)
        requestConfig.headers['X-FTL-SID'] = session.sid
        return instance.request(requestConfig)
      }
      return Promise.reject(error)
    })

    return instance
  }
}
