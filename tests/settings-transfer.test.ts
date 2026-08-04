import assert from 'node:assert/strict'
import test from 'node:test'
import { parseSettingsBackup } from '../src/service/SettingsTransferService.ts'

test('previews a valid credential-free backup', () => {
  const preview = parseSettingsBackup(
    JSON.stringify({
      format: 'wormhole-connector-settings',
      version: 1,
      createdAt: '2026-08-04T00:00:00.000Z',
      includesCredentials: false,
      connections: [
        {
          pi_uri_base: 'https://example.test/pihole/admin/',
          api_key: '',
        },
      ],
      preferences: {
        reload_after_disable: true,
        unrelated_key: 'ignored',
      },
    }),
  )

  assert.equal(preview.connectionCount, 1)
  assert.equal(preview.preferenceCount, 1)
  assert.equal(preview.includesCredentials, false)
  assert.equal(
    preview.backup.connections[0].pi_uri_base,
    'https://example.test/pihole/admin',
  )
})

test('does not trust a credentials flag without an actual credential', () => {
  const preview = parseSettingsBackup(
    JSON.stringify({
      format: 'wormhole-connector-settings',
      version: 1,
      includesCredentials: true,
      connections: [{ pi_uri_base: 'http://pi.hole/admin', api_key: '' }],
      preferences: {},
    }),
  )
  assert.equal(preview.includesCredentials, false)
})

test('rejects unknown backup formats and versions', () => {
  assert.throws(() =>
    parseSettingsBackup(
      JSON.stringify({
        format: 'other-product',
        version: 99,
        connections: [],
        preferences: {},
      }),
    ),
  )
})
