import assert from 'node:assert/strict'
import test from 'node:test'
import type { MenuItem } from './types.ts'

/**
 * The cart's money path, with a stubbed localStorage.
 *
 * Same reasoning as orders.test.ts: this is the logic worth testing, and
 * everything it can get wrong is silent. A dropped line or a price that fails
 * to update shows up as a different number on a seller's dashboard, and
 * neither side has any reason to recount it.
 *
 * cart.ts reads `window.localStorage` lazily, so the stub only has to exist
 * before the first call — but it is installed before the import anyway, so the
 * module-level `addEventListener` guard takes its real branch.
 */
const store = new Map<string, string>()
const fakeWindow = {
  localStorage: {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  },
  addEventListener: () => {},
}
;(globalThis as unknown as { window: unknown }).window = fakeWindow

const {
  cartCount,
  cartTotal,
  clearVentureCart,
  groupByVenture,
  reconcileCart,
  setCartQuantity,
  clearCart,
} = await import('./cart.ts')

const VENTURE = { id: 'v1', name: 'Loopberry' }

function item(overrides: Partial<MenuItem> & { id: string }): MenuItem {
  return {
    ventureId: VENTURE.id,
    name: overrides.id,
    price: 100,
    inStock: true,
    inquiryCount: 0,
    ...overrides,
  } as MenuItem
}

test('cart quantities, totals and grouping', () => {
  clearCart()

  setCartQuantity(item({ id: 'a', price: 100 }), VENTURE, 2)
  setCartQuantity(item({ id: 'b', price: 50 }), VENTURE, 1)
  setCartQuantity(item({ id: 'c', price: 30 }), { id: 'v2', name: 'Glood' }, 3)

  const cart = JSON.parse(store.get('ventureadda:cart') ?? '[]')
  assert.equal(cartTotal(cart), 100 * 2 + 50 + 30 * 3, 'total sums price × quantity')
  assert.equal(cartCount(cart), 6, 'the badge counts units, not lines')

  const groups = groupByVenture(cart)
  assert.equal(groups.length, 2, 'two sellers, two groups')
  assert.equal(groups[0].entries.length, 2)
  assert.equal(groups[1].ventureName, 'Glood')

  // Zero removes rather than storing a zero-quantity line, which would show up
  // as an empty row in the cart and an empty line on the order.
  setCartQuantity(item({ id: 'b' }), VENTURE, 0)
  assert.equal(JSON.parse(store.get('ventureadda:cart') ?? '[]').length, 2)

  clearVentureCart('v2')
  const left = JSON.parse(store.get('ventureadda:cart') ?? '[]')
  assert.deepEqual(
    left.map((entry: { itemId: string }) => entry.itemId),
    ['a'],
    'clearing one seller leaves the others alone',
  )
})

test('stock is a ceiling wherever the number comes from', () => {
  clearCart()
  setCartQuantity(item({ id: 'a', stock: 3 }), VENTURE, 10)
  assert.equal(JSON.parse(store.get('ventureadda:cart') ?? '[]')[0].quantity, 3)

  // Absent stock means the seller is not counting, so there is no ceiling.
  setCartQuantity(item({ id: 'b' }), VENTURE, 40)
  assert.equal(JSON.parse(store.get('ventureadda:cart') ?? '[]')[1].quantity, 40)
})

test('reconcile against the live menu', () => {
  clearCart()
  setCartQuantity(item({ id: 'a', price: 100 }), VENTURE, 2)
  setCartQuantity(item({ id: 'sold', price: 60 }), VENTURE, 1)
  setCartQuantity(item({ id: 'gone', price: 20 }), VENTURE, 1)
  setCartQuantity(item({ id: 'capped', price: 10, stock: 9 }), VENTURE, 5)

  const live = new Map<string, MenuItem>([
    ['a', item({ id: 'a', name: 'Beanie', price: 130 })],
    ['sold', item({ id: 'sold', price: 60, inStock: false })],
    ['capped', item({ id: 'capped', price: 10, stock: 2 })],
  ])

  const { removed, repriced } = reconcileCart(live)

  assert.deepEqual(removed, ['sold'], 'a sold-out item leaves the cart and is named')
  assert.deepEqual(repriced, ['Beanie'], 'a changed price is reported under its current name')

  const cart = JSON.parse(store.get('ventureadda:cart') ?? '[]')
  const byId = Object.fromEntries(
    cart.map((entry: { itemId: string }) => [entry.itemId, entry]),
  ) as Record<string, { price: number; quantity: number; name: string }>

  assert.equal(byId.a.price, 130, 'the stored price is replaced, not kept')
  assert.equal(byId.a.name, 'Beanie', 'so is the name')
  assert.equal(byId.capped.quantity, 2, 'quantity drops to what is left in stock')
  assert.ok(
    byId.gone !== undefined,
    'an item missing from the map is a menu that was not fetched, not a deletion — a failed read must never empty a cart',
  )
})

console.log('cart totals, ceilings and reconciliation: all checks passed')
