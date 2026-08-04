import assert from 'node:assert/strict'
import test from 'node:test'
import { normalizeStoredPiHoleSettings } from '../src/service/StorageMigrationService.ts'

test('normalizes legacy URLs without modifying passwords', () => {
  assert.deepEqual(
    normalizeStoredPiHoleSettings([
      {
        pi_uri_base: ' https://example.test/pihole/admin/ ',
        api_key: ' password with spaces ',
      },
    ]),
    [
      {
        pi_uri_base: 'https://example.test/pihole/admin',
        api_key: ' password with spaces ',
      },
    ],
  )
})

test('drops only invalid entries and preserves valid settings', () => {
  assert.deepEqual(
    normalizeStoredPiHoleSettings([
      { pi_uri_base: 'not a url', api_key: 'broken' },
      { pi_uri_base: 'http://pi.hole/admin', api_key: 'valid' },
    ]),
    [{ pi_uri_base: 'http://pi.hole/admin', api_key: 'valid' }],
  )
})

test('deduplicates identical normalized endpoints', () => {
  assert.deepEqual(
    normalizeStoredPiHoleSettings([
      { pi_uri_base: 'http://pi.hole/admin/', api_key: 'old' },
      { pi_uri_base: 'http://pi.hole/admin', api_key: 'new' },
    ]),
    [{ pi_uri_base: 'http://pi.hole/admin', api_key: 'new' }],
  )
})
