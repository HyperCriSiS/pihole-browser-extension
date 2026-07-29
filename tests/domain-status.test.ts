import assert from 'node:assert/strict'
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
        [domainEntry('allow', 'exact', [2]), domainEntry('deny', 'regex', [2])],
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
    evaluateDomainSearch(response([domainEntry('deny', 'exact', [3])]), 2),
    'allowed',
  )
})

test('combined states are conservative', () => {
  assert.equal(combineDomainStates(['allowed', 'blocked']), 'blocked')
  assert.equal(combineDomainStates(['allowed', 'unknown']), 'unknown')
  assert.equal(combineDomainStates(['allowed', 'allowed']), 'allowed')
})
