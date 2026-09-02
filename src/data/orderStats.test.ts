/**
 * Self-check for the moderator's order and usage figures.
 *
 * These drive judgements rather than a render: whether the site is actually
 * being used, and which venture is carrying it. Every way they can be wrong is
 * quiet, so each case below is one a real order list produces.
 *
 * Run with: node --experimental-strip-types src/data/orderStats.test.ts
 */
import assert from 'node:assert/strict'
import { distinctBuyers, ordersByVenture, ordersSince, usageLadder } from './orderStats.ts'
import type { Order } from './types.ts'

const order = (over: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    ventureId: 'v1',
    ventureName: 'Glood',
    buyerUid: 'u1',
    total: 100,
    createdAt: new Date('2026-09-01T10:00:00Z'),
    ...over,
  }) as Order

// --- grouping ---------------------------------------------------------------
const grouped = ordersByVenture([
  order({ ventureId: 'v1', ventureName: 'Glood', total: 100, buyerUid: 'a' }),
  order({ ventureId: 'v1', ventureName: 'Glood', total: 50, buyerUid: 'b' }),
  order({ ventureId: 'v2', ventureName: 'Loopberry', total: 300, buyerUid: 'a' }),
])
assert.deepEqual(grouped, [
  { ventureId: 'v1', ventureName: 'Glood', orders: 2, revenue: 150, buyers: 2 },
  { ventureId: 'v2', ventureName: 'Loopberry', orders: 1, revenue: 300, buyers: 1 },
])

// Two orders from the SAME account are two orders and one buyer. Conflating
// them would make one enthusiastic friend look like an audience.
const repeat = ordersByVenture([
  order({ buyerUid: 'a', total: 10 }),
  order({ buyerUid: 'a', total: 10 }),
])
assert.equal(repeat[0].orders, 2)
assert.equal(repeat[0].buyers, 1)

// A renamed venture is ONE row, not two. Grouping on the denormalised name
// instead of the id is the bug this guards.
const renamed = ordersByVenture([
  order({ ventureId: 'v1', ventureName: 'Old Name' }),
  order({ ventureId: 'v1', ventureName: 'New Name' }),
])
assert.equal(renamed.length, 1)
assert.equal(renamed[0].orders, 2)
assert.equal(renamed[0].ventureName, 'New Name')

// An order that lost its venture name still gets a row, labelled by id.
assert.equal(ordersByVenture([order({ ventureName: '' })])[0].ventureName, 'v1')

// Nothing in, nothing out — the moderator page renders this on a quiet day.
assert.deepEqual(ordersByVenture([]), [])

// --- buyers -----------------------------------------------------------------
assert.equal(distinctBuyers([]), 0)
assert.equal(distinctBuyers([order({ buyerUid: 'a' }), order({ buyerUid: 'a' })]), 1)
assert.equal(distinctBuyers([order({ buyerUid: 'a' }), order({ buyerUid: 'b' })]), 2)
// A blank uid is not an account, and must not be counted as one.
assert.equal(distinctBuyers([order({ buyerUid: '' })]), 0)

// --- the window -------------------------------------------------------------
const cutoff = new Date('2026-09-01T00:00:00Z')
assert.equal(ordersSince([order({ createdAt: new Date('2026-08-31T23:59:00Z') })], cutoff).length, 0)
assert.equal(ordersSince([order({ createdAt: new Date('2026-09-02T00:00:00Z') })], cutoff).length, 1)
// A just-written order has no server timestamp yet and must not vanish from
// today's figures because of it.
assert.equal(ordersSince([order({ createdAt: null })], cutoff).length, 1)

// --- the ladder -------------------------------------------------------------
const ladder = usageLadder({
  visits: 200,
  ventureOpens: 60,
  asks: 8,
  orders: [order({ buyerUid: 'a' }), order({ buyerUid: 'a' }), order({ buyerUid: 'b' })],
})
assert.equal(ladder.orders, 3)
assert.equal(ladder.buyers, 2)
assert.equal(ladder.ordersPer100Visits, 1.5)

// No visits is not a zero rate, it is no rate. Printing 0% for a site nobody
// has opened says something false about the orders it did get.
assert.equal(usageLadder({ visits: 0, ventureOpens: 0, asks: 0, orders: [] }).ordersPer100Visits, null)

// The quiet case this panel exists to make obvious: plenty of visits, nobody
// doing anything that costs an account.
const quiet = usageLadder({ visits: 400, ventureOpens: 12, asks: 0, orders: [] })
assert.equal(quiet.orders, 0)
assert.equal(quiet.buyers, 0)
assert.equal(quiet.ordersPer100Visits, 0)

console.log('orderStats: ok')
