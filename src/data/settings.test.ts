import assert from 'node:assert/strict'
import test from 'node:test'
import { isDown, nextEdge } from './maintenance.ts'
import { BILLBOARD_SECONDS, billboardSeconds } from './billboardPick.ts'

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

/**
 * The scheduling half, which a live two-minute window caught and the test
 * above could not: `isDown` was right at every instant and the site still
 * never reopened, because only the first edge was ever waited for.
 */
test('the next edge walks from the start to the end and then stops', () => {
  const from = Date.parse('2026-03-01T02:00:00Z')
  const until = Date.parse('2026-03-01T04:00:00Z')
  const window = { from, until }

  assert.equal(nextEdge(window, from - 1000), from, 'before it starts, wait for the start')
  assert.equal(nextEdge(window, from), until, 'standing on the start, wait for the end')
  assert.equal(nextEdge(window, from + 60_000), until, 'mid-window, wait for the end')
  assert.equal(nextEdge(window, until), null, 'once it has ended there is nothing left to wait for')
  assert.equal(nextEdge(undefined, from), null)
  assert.equal(nextEdge({ from: 'soon', until } as never, from), null)

  // Numeric ordering, not the string ordering a bare .sort() would give. These
  // two differ in length, which is where that bug shows up.
  assert.equal(nextEdge({ from: 9, until: 100 }, 0), 9)
})

/**
 * The billboard's slide interval, which a moderator types into a box.
 *
 * Clamped on the way OUT as well as in, so a value written before these bounds
 * existed — or by hand in the Firebase console — cannot stall the board or set
 * it spinning. Every case below is something that document can really hold.
 */
test('the slide interval is clamped whatever the document says', () => {
  assert.equal(billboardSeconds(undefined), BILLBOARD_SECONDS.default, 'unset means the default')
  assert.equal(billboardSeconds(null), BILLBOARD_SECONDS.default)

  // The ordinary case.
  assert.equal(billboardSeconds(20), 20)

  // Both ends, and past both ends.
  assert.equal(billboardSeconds(BILLBOARD_SECONDS.min), BILLBOARD_SECONDS.min)
  assert.equal(billboardSeconds(1), BILLBOARD_SECONDS.min)
  assert.equal(billboardSeconds(0), BILLBOARD_SECONDS.min, 'never zero, which would spin')
  assert.equal(billboardSeconds(-5), BILLBOARD_SECONDS.min)
  assert.equal(billboardSeconds(9000), BILLBOARD_SECONDS.max)

  // Hand edits in the console, which is where the malformed ones come from.
  assert.equal(billboardSeconds('ten' as unknown as number), BILLBOARD_SECONDS.default)
  assert.equal(billboardSeconds(NaN), BILLBOARD_SECONDS.default)
  assert.equal(billboardSeconds(Infinity), BILLBOARD_SECONDS.default)

  // A fraction is a whole number of seconds, not a timer that drifts.
  assert.equal(billboardSeconds(12.6), 13)
})
