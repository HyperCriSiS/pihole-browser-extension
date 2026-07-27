import json
from pathlib import Path

api_path = Path('src/service/PiHoleApiService.ts')
api = api_path.read_text()
if 'public static async getPiHoleStatusFor(' not in api:
    anchor = '  public static async getPiHoleVersion('
    method = '''  public static async getPiHoleStatusFor(
    piHole: PiHoleSettingsStorage,
  ): Promise<PiHoleApiStatus> {
    this.assertValidPiHole(piHole)
    const response = await this.getAxiosInstance(
      piHole.pi_uri_base!,
      piHole.api_key,
    ).get<PiHoleApiStatus>('/dns/blocking')
    return response.data
  }

'''
    api = api.replace(anchor, method + anchor)
if 'public static async searchDomain(' not in api:
    anchor = '  public static async getGroups('
    method = '''  public static async searchDomain(
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

'''
    api = api.replace(anchor, method + anchor)
api_path.write_text(api)

translations = {
    'de': {
        'popup_second_card_whitelist': 'Whitelist',
        'popup_second_card_blacklist': 'Blacklist',
        'popup_global_title': 'Pi-hole global',
        'popup_group_manual': 'Manuell',
        'popup_domain_status_checking': 'Prüfe…',
        'popup_domain_status_blocked': 'Blockiert',
        'popup_domain_status_allowed': 'Nicht blockiert',
        'popup_domain_status_unknown': 'Status unbekannt',
        'popup_domain_action_error': 'Die Domain-Aktion ist fehlgeschlagen.',
    },
    'en': {
        'popup_second_card_whitelist': 'Whitelist',
        'popup_second_card_blacklist': 'Blacklist',
        'popup_global_title': 'Global Pi-hole',
        'popup_group_manual': 'Manual',
        'popup_domain_status_checking': 'Checking…',
        'popup_domain_status_blocked': 'Blocked',
        'popup_domain_status_allowed': 'Not blocked',
        'popup_domain_status_unknown': 'Status unknown',
        'popup_domain_action_error': 'The domain action failed.',
    },
}
for locale, values in translations.items():
    path = Path(f'_locales/{locale}/messages.json')
    data = json.loads(path.read_text())
    for key, message in values.items():
        data[key] = {'message': message}
    path.write_text(json.dumps(data, ensure_ascii=False, indent='\t') + '\n')

package_path = Path('package.json')
package_data = json.loads(package_path.read_text())
package_data['scripts']['test:domain-status'] = (
    'node --experimental-strip-types --experimental-default-type=module '
    '--test tests/domain-status.test.ts'
)
package_path.write_text(json.dumps(package_data, ensure_ascii=False, indent='\t') + '\n')

tests = Path('tests')
tests.mkdir(exist_ok=True)
Path('tests/domain-status.test.ts').write_text('''import assert from 'node:assert/strict'
import test from 'node:test'
import {
  combineDomainStates,
  evaluateDomainSearch,
} from '../src/service/DomainStatusEvaluator.ts'
import type { PiHoleSearchResponse } from '../src/api/models/PiHoleSearch.ts'

const response = (
  domains: PiHoleSearchResponse['search']['domains'] = [],
  gravity: PiHoleSearchResponse['search']['gravity'] = [],
): PiHoleSearchResponse => ({
  search: {
    domains,
    gravity,
    results: {
      domains: { exact: 0, regex: 0 },
      gravity: { allow: 0, block: 0 },
      total: domains.length + gravity.length,
    },
  },
})

const domainEntry = (
  type: 'allow' | 'deny',
  kind: 'exact' | 'regex',
  groups: number[],
) => ({
  domain: 'example.com',
  comment: null,
  enabled: true,
  type,
  kind,
  id: 1,
  groups,
})

const gravityEntry = (type: 'allow' | 'block', groups: number[]) => ({
  domain: 'example.com',
  address: 'list',
  comment: null,
  enabled: true,
  id: 1,
  type,
  groups,
})

test('exact allow wins over every deny source', () => {
  assert.equal(
    evaluateDomainSearch(
      response(
        [
          domainEntry('allow', 'exact', [2]),
          domainEntry('deny', 'regex', [2]),
        ],
        [gravityEntry('block', [2])],
      ),
      2,
    ),
    'allowed',
  )
})

test('exact deny wins over subscribed allow', () => {
  assert.equal(
    evaluateDomainSearch(
      response(
        [domainEntry('deny', 'exact', [2])],
        [gravityEntry('allow', [2])],
      ),
      2,
    ),
    'blocked',
  )
})

test('subscribed allow wins over subscribed block and regex deny', () => {
  assert.equal(
    evaluateDomainSearch(
      response(
        [domainEntry('deny', 'regex', [2])],
        [gravityEntry('allow', [2]), gravityEntry('block', [2])],
      ),
      2,
    ),
    'allowed',
  )
})

test('rules from another client group are ignored', () => {
  assert.equal(
    evaluateDomainSearch(
      response([domainEntry('deny', 'exact', [3])]),
      2,
    ),
    'allowed',
  )
})

test('combined states are conservative', () => {
  assert.equal(combineDomainStates(['allowed', 'blocked']), 'blocked')
  assert.equal(combineDomainStates(['allowed', 'unknown']), 'unknown')
  assert.equal(combineDomainStates(['allowed', 'allowed']), 'allowed')
})
''')
