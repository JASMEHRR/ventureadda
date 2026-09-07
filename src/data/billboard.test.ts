/**
 * Self-check for what goes on the front page and in what order.
 *
 * Two things here are promises rather than rendering details. An unapproved
 * advert must never be shown, because approval is the only thing standing
 * between a moderator's front page and whatever anybody types. And the order
 * must not let one shop own the board, because "put up as many as you like"
 * and "one shop filled the slider" cannot both be true.
 *
 * Run with: node --experimental-strip-types src/data/billboard.test.ts
 */
import assert from 'node:assert/strict'
import { billboardOrder } from './billboardPick.ts'
import type { Billboard } from './billboardPick.ts'

const ad = (over: Partial<Billboard> = {}): Billboard =>
  ({ id: 'a', ventureId: 'v', status: 'live', paused: false, ...over }) as Billboard

const ids = (ads: Billboard[]) => billboardOrder(ads).map((entry) => entry.id)

// --- nothing unapproved, ever -----------------------------------------------
assert.deepEqual(billboardOrder([ad({ status: 'pending' })]), [])
assert.deepEqual(billboardOrder([ad({ status: 'rejected' })]), [])
// The seller's own switch, which is separate from approval.
assert.deepEqual(billboardOrder([ad({ paused: true })]), [])
// An empty board is an empty board, not a crash.
assert.deepEqual(billboardOrder([]), [])

// A live advert beside unapproved ones is the only one that runs.
assert.deepEqual(
  ids([ad({ id: 'x', ventureId: 'v1', status: 'pending' }), ad({ id: 'y', ventureId: 'v2' })]),
  ['y'],
)

// --- the order does not depend on what came back first ----------------------
assert.deepEqual(
  ids([
    ad({ id: 'c', ventureId: 'v3' }),
    ad({ id: 'a', ventureId: 'v1' }),
    ad({ id: 'b', ventureId: 'v2' }),
  ]),
  ['a', 'b', 'c'],
)

// --- as many adverts as a venture likes, without owning the board -----------
//
// THE POINT OF INTERLEAVING. Sorted naively this is a1, a2, a3, b1: the big
// shop holds three consecutive slides, and anybody watching the top of the
// page for a minute sees one shop. One from each venture per round spreads
// them out, and all four are still shown.
const lopsided = [
  ad({ id: 'a1', ventureId: 'big' }),
  ad({ id: 'a2', ventureId: 'big' }),
  ad({ id: 'a3', ventureId: 'big' }),
  ad({ id: 'b1', ventureId: 'small' }),
]
assert.deepEqual(ids(lopsided), ['a1', 'b1', 'a2', 'a3'])

// Nothing is dropped on the way: every approved advert appears exactly once.
assert.equal(billboardOrder(lopsided).length, 4)
assert.deepEqual([...ids(lopsided)].sort(), ['a1', 'a2', 'a3', 'b1'])

// The small shop is not buried at the end: it is in the first round, which is
// the one most people will still be looking at.
assert.equal(billboardOrder(lopsided)[1].ventureId, 'small')

// Two shops, two adverts each, alternate all the way down.
assert.deepEqual(
  ids([
    ad({ id: 'a1', ventureId: 'x' }),
    ad({ id: 'a2', ventureId: 'x' }),
    ad({ id: 'b1', ventureId: 'y' }),
    ad({ id: 'b2', ventureId: 'y' }),
  ]),
  ['a1', 'b1', 'a2', 'b2'],
)

// One advert is one slide, not a rotation with nothing in it.
assert.deepEqual(ids([ad({ id: 'only' })]), ['only'])

console.log('billboard: ok')
