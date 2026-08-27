import assert from 'node:assert/strict'
import test from 'node:test'
import { isDown } from './maintenance.ts'

/**
 * The one branch that decides whether the whole site is reachable, so it is
 * worth more than a glance. Every case here is a state the stored document can
 * actually be in, including the two malformed ones a hand edit in the Firebase
 * console can produce.
 */
test('a maintenance window closes the site only while it is running', () => {
  const from = Date.parse('2026-03-01T02:00:00Z')
  const until = Date.parse('2026-03-01T04:00:00Z')
  const window = { from, until }

  // Before, during, and after.
  assert.equal(isDown(window, from - 1), false)
  assert.equal(isDown(window, from), true, 'closes exactly at the start')
  assert.equal(isDown(window, until - 1), true)
  assert.equal(isDown(window, until), false, 'reopens exactly at the end')
  assert.equal(isDown(window, until + 86_400_000), false, 'stays open a day later')

  // Nothing scheduled.
  assert.equal(isDown(undefined, from + 1), false)

  // Hand-edited rubbish must never take a working site down.
  assert.equal(isDown({ from: 'soon', until } as never, from + 1), false)
  assert.equal(isDown({ from, until: null } as never, from + 1), false)
})
