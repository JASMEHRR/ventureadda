/**
 * Self-check for order arithmetic and for reading orders back out of Firestore.
 *
 * These two functions are the money path. Everything they can get wrong is
 * silent: a dropped line or a coerced zero shows up as a smaller total on a
 * seller's dashboard, and neither party has any reason to recount it.
 *
 * Run with: node src/data/orders.test.ts   (Node strips the types itself)
 */
import assert from 'node:assert/strict'
import { orderTotal, toOrderLines, visibleToBuyer } from './orderLines.ts'
import type { Order, OrderLine } from './types.ts'

const line = (over: Partial<OrderLine> = {}): OrderLine => ({
  itemId: 'i1',
  name: 'Sticker',
  price: 20,
  quantity: 1,
  ...over,
})

// The ordinary case, and the one the whole feature rests on.
assert.equal(orderTotal([line({ price: 20, quantity: 2 }), line({ price: 50, quantity: 1 })]), 90)

// An empty order is zero, not NaN — the checkout renders this total before
// anything has been added.
assert.equal(orderTotal([]), 0)

// Quantity multiplies. A total that ignored it would look right on every
// single-unit order and be wrong on every other one.
assert.equal(orderTotal([line({ price: 15, quantity: 7 })]), 105)

// Free items are legitimate, and must not be dropped from the line list.
assert.equal(orderTotal([line({ price: 0, quantity: 3 })]), 0)

// Reading back: a well-formed stored order round-trips unchanged.
assert.deepEqual(
  toOrderLines([{ itemId: 'a', name: 'Cake', price: 450, quantity: 2 }]),
  [{ itemId: 'a', name: 'Cake', price: 450, quantity: 2 }],
)

// A line with no readable name is dropped rather than rendered as a blank row
// against a price. THE TOTAL IS STORED SEPARATELY, so the dashboard shows the
// real amount next to fewer lines — which is visible, unlike a nameless row a
// seller reads as an item they forgot they sell.
assert.equal(toOrderLines([{ price: 10, quantity: 1 }]).length, 0)
assert.equal(toOrderLines([{ name: 42, price: 10, quantity: 1 }]).length, 0)

// Malformed numbers become zero rather than NaN. NaN propagates through every
// sum it touches and renders as "₹NaN" across the whole page.
assert.deepEqual(toOrderLines([{ name: 'Odd', price: '10', quantity: null }]), [
  { itemId: '', name: 'Odd', price: 0, quantity: 0 },
])
assert.ok(Number.isFinite(orderTotal(toOrderLines([{ name: 'Odd', price: '10' }]))))

// Anything that is not a list at all — an old document, a partial write — is an
// empty order, not a crash on the seller's dashboard.
assert.deepEqual(toOrderLines(undefined), [])
assert.deepEqual(toOrderLines(null), [])
assert.deepEqual(toOrderLines('two stickers'), [])
assert.deepEqual(toOrderLines([null, 'x', 7]), [])

console.log('order totals and line parsing: all checks passed')

// --- whose list an order belongs in -----------------------------------------
//
// The seller's list must never lose a row to this, so the only thing under
// test is that the flag is read strictly. An order written before the field
// existed has no `hiddenForBuyer` at all, and it has to stay visible: a
// buyer's whole history silently emptying is the failure this guards.
const order = (over: Partial<Order> = {}): Order =>
  ({ id: 'o1', hiddenForBuyer: false, ...over }) as Order

assert.equal(visibleToBuyer(order()), true)
assert.equal(visibleToBuyer(order({ hiddenForBuyer: true })), false)
assert.equal(visibleToBuyer(order({ hiddenForBuyer: undefined as unknown as boolean })), true)

console.log('orders: ok')
