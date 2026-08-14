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

// The row number matches what is on screen, counting blank rows above it.
assert.match(
  err(validateMenuDrafts([draft(), draft({ name: 'Cake', price: '450' }), draft({ price: '99' })])),
  /^Item 3 /,
)

// A named row with no price is refused rather than published at zero.
assert.match(err(validateMenuDrafts([draft({ name: 'Cake' })])), /needs a price/)
assert.match(err(validateMenuDrafts([draft({ name: 'Cake', price: '   ' })])), /needs a price/)
assert.match(err(validateMenuDrafts([draft({ name: 'Cake', price: 'free' })])), /needs a price/)
assert.match(err(validateMenuDrafts([draft({ name: 'Cake', price: '-5' })])), /needs a price/)

// Zero is a legitimate price someone may actually mean, when typed.
assert.equal(ok(validateMenuDrafts([draft({ name: 'Free sample', price: '0' })])).length, 1)

// Nothing started at all.
assert.match(err(validateMenuDrafts([draft(), draft()])), /at least one item/)
assert.match(err(validateMenuDrafts([])), /at least one item/)

console.log('menu draft validation: all checks passed')
