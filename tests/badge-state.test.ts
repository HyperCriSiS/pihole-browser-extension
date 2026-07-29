import assert from 'node:assert/strict'
import test from 'node:test'
import { composeTabBadgeText } from '../src/service/BadgeState.ts'

test('blocked domains extend an enabled Pi-hole badge', () => {
  assert.equal(composeTabBadgeText('On', true), 'On!')
})

test('allowed domains keep the enabled Pi-hole badge', () => {
  assert.equal(composeTabBadgeText('On', false), 'On')
})

test('disabled and error states are never replaced by a domain badge', () => {
  assert.equal(composeTabBadgeText('Off', true), 'Off')
  assert.equal(composeTabBadgeText('Err', true), 'Err')
})

test('an unset global badge remains unset', () => {
  assert.equal(composeTabBadgeText('', false), '')
  assert.equal(composeTabBadgeText('', true), '')
})
