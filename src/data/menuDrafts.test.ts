/**
 * Self-check for menu draft validation.
 *
 * Every failure this guards against is silent by nature: a dropped row or a
 * zero price submits successfully and goes wrong later, in front of a buyer.
 *
 * Run with: node src/data/menuDrafts.test.ts   (Node strips the types itself)
 */
import assert from 'node:assert/strict'
import { validateMenuDrafts } from './menuDrafts.ts'
import type { MenuItemDraft } from './types.ts'

let seed = 0
const draft = (over: Partial<MenuItemDraft> = {}): MenuItemDraft => ({
  key: `k${(seed += 1)}`,
  name: '',
  description: '',
  price: '',
  category: '',
  stock: '',
  inStock: true,
  ...over,
})

const ok = (result: ReturnType<typeof validateMenuDrafts>) => {
  assert.equal(result.ok, true)
  return result.ok ? result.items : []
}
const err = (result: ReturnType<typeof validateMenuDrafts>) => {
  assert.equal(result.ok, false)
  return result.ok ? '' : result.error
}

// The ordinary case.
assert.deepEqual(
  ok(validateMenuDrafts([draft({ name: 'Brownie', price: '280' })])).map((i) => i.name),
  ['Brownie'],
)

// A wholly blank row is dropped in silence — the spare row is not a mistake.
assert.equal(ok(validateMenuDrafts([draft({ name: 'Tea', price: '20' }), draft()])).length, 1)

// THE BUG THIS EXISTS FOR: a row with details but no name is refused, not
// quietly discarded.
assert.match(err(validateMenuDrafts([draft({ price: '250' })])), /has details but no name/)
assert.match(err(validateMenuDrafts([draft({ description: 'Six pieces' })])), /no name/)
assert.match(
  err(validateMenuDrafts([draft({ photo: { url: 'x', publicId: '' } })])),
  /no name/,
)
assert.match(err(validateMenuDrafts([draft({ category: 'Snacks' })])), /no name/)

// The row number matches what is on screen, counting blank rows above it.
assert.match(
  err(validateMenuDrafts([draft(), draft({ name: 'Cake', price: '450' }), draft({ price: '99' })])),
  /^Item 3 /,
)

// A PRICE IS OPTIONAL. A blank one means "ask the seller" — a custom cake or
// an embroidered jacket has no number until somebody asks, and refusing those
// items refused the listing. It is published without a price, and the venture
// page shows "Ask" and no Add button rather than a cart line built on a guess.
assert.equal(ok(validateMenuDrafts([draft({ name: 'Cake' })])).length, 1)
assert.equal(ok(validateMenuDrafts([draft({ name: 'Cake', price: '   ' })])).length, 1)

// A price that was TYPED and is not a whole non-negative number is still
// refused: that is a mistake, not a decision.
assert.match(err(validateMenuDrafts([draft({ name: 'Cake', price: 'free' })])), /not a whole number/)
assert.match(err(validateMenuDrafts([draft({ name: 'Cake', price: '-5' })])), /not a whole number/)

// Zero is a legitimate price someone may actually mean, when typed.
assert.equal(ok(validateMenuDrafts([draft({ name: 'Free sample', price: '0' })])).length, 1)

// Stock is optional. Blank means the seller is not counting, which is the
// common case and must not be mistaken for "none left".
assert.equal(ok(validateMenuDrafts([draft({ name: 'Cake', price: '450' })])).length, 1)
assert.equal(
  ok(validateMenuDrafts([draft({ name: 'Cake', price: '450', stock: '  ' })])).length,
  1,
)

// Zero stock is a real answer: the seller counted and has none.
assert.equal(
  ok(validateMenuDrafts([draft({ name: 'Cake', price: '450', stock: '0' })])).length,
  1,
)

// A typed count that is not a whole non-negative number is refused, because it
// becomes the ceiling on the buyer's stepper.
assert.match(
  err(validateMenuDrafts([draft({ name: 'Cake', price: '450', stock: '-2' })])),
  /whole number of units/,
)
assert.match(
  err(validateMenuDrafts([draft({ name: 'Cake', price: '450', stock: '2.5' })])),
  /whole number of units/,
)
assert.match(
  err(validateMenuDrafts([draft({ name: 'Cake', price: '450', stock: 'lots' })])),
  /whole number of units/,
)

// A row whose only content is a stock count still counts as started, so it is
// caught by the no-name rule rather than silently dropped.
assert.match(err(validateMenuDrafts([draft({ stock: '5' })])), /no name/)

// inStock defaults to true and is NOT content: a spare row left alone is still
// blank and still dropped in silence.
assert.equal(
  ok(validateMenuDrafts([draft({ name: 'Tea', price: '20' }), draft({ inStock: true })])).length,
  1,
)

// Sold out is not the same as invalid — it publishes, it just cannot be added.
assert.equal(
  ok(validateMenuDrafts([draft({ name: 'Cake', price: '450', inStock: false })])).length,
  1,
)

// Nothing started at all.
assert.match(err(validateMenuDrafts([draft(), draft()])), /at least one item/)
assert.match(err(validateMenuDrafts([])), /at least one item/)

console.log('menu draft validation: all checks passed')
