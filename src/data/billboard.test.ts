/**
 * Self-check for whose advert is on the front page.
 *
 * Two things here are promises to sellers rather than rendering details. An
 * unapproved advert must never be shown, because approval is the only thing
 * standing between a moderator's front page and whatever anybody types. And
 * the turn-taking must actually take turns, because "your ad ran, you were
 * just unlucky" is not something anybody can be told.
 *
 * Run with: node --experimental-strip-types src/data/billboard.test.ts
 */
import assert from 'node:assert/strict'
import { ROTATE_MS, pickBillboard } from './billboardPick.ts'
import type { Billboard } from './billboardPick.ts'

const ad = (over: Partial<Billboard> = {}): Billboard =>
  ({ id: 'a', ventureId: 'v', status: 'live', paused: false, ...over }) as Billboard

const at = (slots: number) => new Date(slots * ROTATE_MS)

// --- nothing unapproved, ever -----------------------------------------------
assert.equal(pickBillboard([ad({ status: 'pending' })]), null)
assert.equal(pickBillboard([ad({ status: 'rejected' })]), null)
// The seller's own switch, which is separate from approval.
assert.equal(pickBillboard([ad({ paused: true })]), null)
// An empty board is an empty board, not a crash.
assert.equal(pickBillboard([]), null)

// A live ad beside unapproved ones is the one that runs.
assert.equal(
  pickBillboard(
    [ad({ id: 'x', ventureId: 'v1', status: 'pending' }), ad({ id: 'y', ventureId: 'v2' })],
    at(0),
  )?.id,
  'y',
)

// --- taking turns -----------------------------------------------------------
const three = [
  ad({ id: 'c', ventureId: 'v3' }),
  ad({ id: 'a', ventureId: 'v1' }),
  ad({ id: 'b', ventureId: 'v2' }),
]

// Sorted by id, so the running order does not depend on what came back first.
assert.equal(pickBillboard(three, at(0))?.id, 'a')
assert.equal(pickBillboard(three, at(1))?.id, 'b')
assert.equal(pickBillboard(three, at(2))?.id, 'c')
// And it wraps rather than stopping on the last one.
assert.equal(pickBillboard(three, at(3))?.id, 'a')

// EVERY AD GETS A TURN. The failure this guards is a rotation that favours one
// venture: over one full cycle each of the three must appear exactly once.
const cycle = [0, 1, 2].map((slot) => pickBillboard(three, at(slot))?.id)
assert.deepEqual([...cycle].sort(), ['a', 'b', 'c'])

// Stable WITHIN a slot: two people loading the page a minute apart see the
// same advert, so the board does not flicker as somebody navigates back.
assert.equal(
  pickBillboard(three, new Date(0))?.id,
  pickBillboard(three, new Date(60_000))?.id,
)

// A paused ad is skipped without leaving a gap in the rotation — the others
// share the slot rather than the board going blank on its turn.
const paused = [
  ad({ id: 'a', ventureId: 'v1', paused: true }),
  ad({ id: 'b', ventureId: 'v2' }),
  ad({ id: 'c', ventureId: 'v3' }),
]
assert.equal(pickBillboard(paused, at(0))?.id, 'b')
assert.equal(pickBillboard(paused, at(1))?.id, 'c')
assert.equal(pickBillboard(paused, at(2))?.id, 'b')

// One approved ad holds the slot at every moment rather than alternating with
// nothing.
const alone = [ad({ id: 'only' })]
assert.equal(pickBillboard(alone, at(0))?.id, 'only')
assert.equal(pickBillboard(alone, at(7))?.id, 'only')

// --- as many adverts as a venture likes, without buying the board -----------
//
// THE POINT OF ROTATING BY VENTURE. A shop with three adverts and a shop with
// one must each hold the slot half the time; cycling every advert instead
// would give the first shop three turns out of four.
const lopsided = [
  ad({ id: 'a1', ventureId: 'big' }),
  ad({ id: 'a2', ventureId: 'big' }),
  ad({ id: 'a3', ventureId: 'big' }),
  ad({ id: 'b1', ventureId: 'small' }),
]
const owners = [0, 1, 2, 3, 4, 5].map((slot) => pickBillboard(lopsided, at(slot))?.ventureId)
assert.deepEqual(owners, ['big', 'small', 'big', 'small', 'big', 'small'])

// And the big shop's three adverts take it in turns across its own slots, so
// submitting more buys different things to say rather than more airtime.
const shown = [0, 2, 4, 6].map((slot) => pickBillboard(lopsided, at(slot))?.id)
assert.deepEqual(shown, ['a1', 'a2', 'a3', 'a1'])

console.log('billboard: ok')
