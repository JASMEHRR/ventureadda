/**
 * Self-check for what the site puts in front of everybody.
 *
 * This decides which items get a strip across the top of a venture and across
 * the front page. Every failure is a promise made to a buyer on the seller's
 * behalf: an item promoted as "last one" that is actually sold out, or a
 * limited time offer that never appears because the seller never counted units.
 *
 * Run with: node --experimental-strip-types src/data/spotlight.test.ts
 */
import assert from 'node:assert/strict'
import {
  LOW_STOCK,
  spotlightAcross,
  spotlightLabel,
  spotlightOf,
  spotlightReason,
} from './spotlight.ts'
import type { MenuItem } from './types.ts'
import type { ItemMatch } from './ventures.ts'

const item = (over: Partial<MenuItem> = {}): MenuItem =>
  ({ id: 'i1', name: 'Rose', inStock: true, inquiryCount: 0, ...over }) as MenuItem

// --- what earns a place -----------------------------------------------------
assert.deepEqual(spotlightReason(item({ stock: 1 })), { kind: 'almostGone', left: 1 })
assert.deepEqual(spotlightReason(item({ limitedTime: true })), { kind: 'limitedTime' })

// The ordinary item, which is most of them, is not featured.
assert.equal(spotlightReason(item()), null)
assert.equal(spotlightReason(item({ stock: 40 })), null)

// The boundary, both sides of it.
assert.notEqual(spotlightReason(item({ stock: LOW_STOCK })), null)
assert.equal(spotlightReason(item({ stock: LOW_STOCK + 1 })), null)

// NOTHING SOLD OUT, EVER. Zero units is gone, not almost gone, and the
// sold-out switch overrules a stock number the seller forgot to zero.
assert.equal(spotlightReason(item({ stock: 0 })), null)
assert.equal(spotlightReason(item({ stock: 1, inStock: false })), null)
assert.equal(spotlightReason(item({ limitedTime: true, inStock: false })), null)

// An item written before this field existed has no `limitedTime` at all, and
// must not be promoted on the strength of an undefined.
assert.equal(spotlightReason(item({ limitedTime: undefined })), null)

// The seller's own claim outranks the quieter one when an item is both.
assert.deepEqual(spotlightReason(item({ limitedTime: true, stock: 2 })), { kind: 'limitedTime' })

// --- what the buyer reads ---------------------------------------------------
assert.equal(spotlightLabel({ kind: 'limitedTime' }), 'Limited time')
assert.equal(spotlightLabel({ kind: 'almostGone', left: 1 }), 'Last one')
assert.equal(spotlightLabel({ kind: 'almostGone', left: 2 }), 'Only 2 left')

// --- one venture's strip ----------------------------------------------------
const ordered = spotlightOf([
  item({ name: 'Lily', stock: 2 }),
  item({ name: 'Boring', stock: 99 }),
  item({ name: 'Rose', stock: 1 }),
  item({ name: 'Offer', limitedTime: true, stock: 50 }),
])
assert.deepEqual(
  ordered.map((entry) => entry.name),
  ['Offer', 'Rose', 'Lily'],
)

// The common case: nobody counts units and nobody has ticked anything, so
// there is no strip at all rather than an empty one.
assert.deepEqual(spotlightOf([item(), item({ name: 'Other' })]), [])

// --- the site-wide strip ----------------------------------------------------
const match = (ventureId: string, over: Partial<MenuItem> = {}): ItemMatch =>
  ({ item: item(over), venture: { id: ventureId } }) as ItemMatch

// One shop marking everything as limited time must not take the whole row:
// every other venture gets a place before that shop gets a second.
const across = spotlightAcross([
  match('a', { name: 'A1', limitedTime: true }),
  match('a', { name: 'A2', limitedTime: true }),
  match('a', { name: 'A3', limitedTime: true }),
  match('b', { name: 'B1', stock: 1 }),
])
assert.deepEqual(
  across.map((entry) => entry.venture.id),
  ['a', 'b', 'a', 'a'],
)

// The limit is a limit.
assert.equal(spotlightAcross([match('a', { stock: 1 }), match('b', { stock: 1 })], 1).length, 1)

// Nothing eligible is an empty row, not a crash.
assert.deepEqual(spotlightAcross([match('a'), match('b')]), [])

console.log('spotlight: ok')
