import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getPiHoleApiBaseUrl,
  getPiHoleEndpointKey,
  normalizePiHoleUrl,
} from '../src/service/UrlService.ts'

test('normalizes whitespace and removes query and fragment data', () => {
  assert.equal(
    normalizePiHoleUrl('  https://example.test/pihole/admin/?x=1#section  '),
    'https://example.test/pihole/admin',
  )
})

test('maps the conventional admin path to the API path', () => {
  assert.equal(getPiHoleApiBaseUrl('http://pi.hole/admin'), 'http://pi.hole/api/')
})

test('preserves a reverse-proxy prefix when resolving the API', () => {
  assert.equal(
    getPiHoleApiBaseUrl('https://example.test/dns/pihole/admin'),
    'https://example.test/dns/pihole/api/',
  )
  assert.equal(
    getPiHoleApiBaseUrl('https://example.test/dns/pihole'),
    'https://example.test/dns/pihole/api/',
  )
})

test('does not append a second API segment', () => {
  assert.equal(
    getPiHoleApiBaseUrl('https://example.test/dns/pihole/api/'),
    'https://example.test/dns/pihole/api/',
  )
})

test('session keys distinguish reverse-proxy endpoints on the same origin', () => {
  assert.notEqual(
    getPiHoleEndpointKey('https://example.test/one/admin'),
    getPiHoleEndpointKey('https://example.test/two/admin'),
  )
})

test('rejects non-http protocols', () => {
  assert.throws(() => normalizePiHoleUrl('file:///etc/passwd'))
})
