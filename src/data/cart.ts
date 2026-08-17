import { useSyncExternalStore } from 'react'
import type { MenuItem, StoredImage } from './types'

/**
 * The cart, which now outlives the page it was filled on.
 *
 * It used to be a `useState` inside VentureDetail: one cart per venture, gone
 * the moment you navigated away. That is why there was no cart button in the
 * chrome to put one behind — there was nothing global to show. This module is
 * that global thing.
 *
 * WHY LOCALSTORAGE AND NOT FIRESTORE. A cart is not a record of anything; it
 * is a scratchpad. Putting it in Firestore would mean a write per tap of a
 * stepper, a read on every page load, and rules for a document nobody but its
 * author will ever look at. It would also demand an account before a visitor
 * could add a brownie to a cart, which is the opposite of how the rest of this
 * site treats signing in — browsing costs nothing, only ordering needs a name.
 *
 * WHY EVERY LINE IS COPIED. Name, price and stock are stored on the entry
 * rather than read back from menuItems, so the cart button in the top bar
 * needs no Firestore read on any page. The copy is a cache, not a source of
 * truth: prices go stale, items get deleted, and Cart.tsx reconciles the whole
 * thing against the live menu before anyone can check out. Nothing downstream
 * of this file may treat a stored price as authoritative.
 */

const STORAGE_KEY = 'ventureadda:cart'

export type CartEntry = {
  itemId: string
  ventureId: string
  /** Denormalised so the cart page can group and label without a read. */
  ventureName: string
  name: string
  /** Whole rupees, as of when it was added. Revalidated at the cart page. */
  price: number
  quantity: number
  /** Absent means the seller is not counting units, so there is no ceiling. */
  stock?: number
  photo?: StoredImage
}

/**
 * The parsed cart, kept in a module variable.
 *
 * useSyncExternalStore compares snapshots by identity and re-renders whenever
 * it gets a new one, so parsing localStorage inside getSnapshot would hand it
 * a fresh array every time and loop forever. This is the single array every
 * subscriber sees, replaced only when the cart actually changes.
 */
let snapshot: CartEntry[] | null = null
const listeners = new Set<() => void>()

function isEntry(value: unknown): value is CartEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.itemId === 'string' &&
    entry.itemId !== '' &&
    typeof entry.ventureId === 'string' &&
    entry.ventureId !== '' &&
    typeof entry.name === 'string' &&
    typeof entry.price === 'number' &&
    Number.isFinite(entry.price) &&
    typeof entry.quantity === 'number' &&
    Number.isFinite(entry.quantity) &&
    entry.quantity > 0
  )
}

/**
 * Reads and validates whatever is in storage.
 *
 * Defensive to the same degree as toOrderLines, and for a stronger reason:
 * this string is editable by hand in devtools and survives every deploy, so a
 * cart written by an older version of the app — or by somebody poking at it —
 * must not be able to render "₹NaN" or crash the checkout. Anything that does
 * not parse is discarded rather than repaired.
 */
function read(): CartEntry[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isEntry).map((entry) => ({
      ...entry,
      quantity: Math.floor(entry.quantity),
      ventureName: typeof entry.ventureName === 'string' ? entry.ventureName : '',
    }))
  } catch {
    // Private browsing, a blocked storage partition, or malformed JSON. An
    // empty cart is the right answer to all three: none of them is worth
    // putting an error in front of somebody who came here to buy a brownie.
    return []
  }
}

function write(next: CartEntry[]): void {
  snapshot = next
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // Quota or a blocked partition. The cart still works for this session; it
    // just will not survive a reload, which beats refusing the tap.
  }
  for (const listener of listeners) listener()
}

function getSnapshot(): CartEntry[] {
  if (snapshot === null) snapshot = read()
  return snapshot
}

/** No cart on the server. Vite renders client-side, but the hook contract
 *  requires this and returning the live snapshot here would be a lie. */
const EMPTY: CartEntry[] = []
function getServerSnapshot(): CartEntry[] {
  return EMPTY
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/**
 * Another tab changed the cart. Rare, but the failure it prevents is not
 * subtle: two tabs open on two ventures, and whichever one you check out from
 * silently overwrites the other's additions.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return
    snapshot = read()
    for (const listener of listeners) listener()
  })
}

/** The whole cart, re-rendering the caller whenever it changes. */
export function useCart(): CartEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}

/** How many units of one item are in the cart. Zero when it is not. */
export function cartQuantity(cart: CartEntry[], itemId: string): number {
  return cart.find((entry) => entry.itemId === itemId)?.quantity ?? 0
}

/** Whole rupees. Mirrors orderTotal, over cart entries rather than order lines. */
export function cartTotal(entries: CartEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.price * entry.quantity, 0)
}

/** Units, not lines — the number the badge shows. */
export function cartCount(entries: CartEntry[]): number {
  return entries.reduce((sum, entry) => sum + entry.quantity, 0)
}

/**
 * The single write path for quantities, used by the menu steppers and the cart
 * page alike.
 *
 * Clamped to the item's stock here rather than at each call site: the ceiling
 * has to hold wherever the number comes from, and a `+` that is merely
 * disabled in the UI is not a rule. Zero or less removes the line.
 */
export function setCartQuantity(
  item: Pick<MenuItem, 'id' | 'name' | 'price' | 'stock' | 'photo'>,
  venture: { id: string; name: string },
  quantity: number,
): void {
  const ceiling = item.stock ?? Infinity
  const next = Math.floor(Math.min(quantity, ceiling))
  const current = getSnapshot()

  if (next <= 0) {
    write(current.filter((entry) => entry.itemId !== item.id))
    return
  }

  const entry: CartEntry = {
    itemId: item.id,
    ventureId: venture.id,
    ventureName: venture.name,
    name: item.name,
    price: item.price,
    quantity: next,
    stock: item.stock,
    photo: item.photo,
  }

  const existing = current.findIndex((line) => line.itemId === item.id)
  if (existing === -1) {
    write([...current, entry])
    return
  }
  // Replaced rather than merged, so an item whose price or stock changed since
  // it was added picks the new values up the next time it is touched.
  const updated = [...current]
  updated[existing] = entry
  write(updated)
}

/** Everything from one venture, once its order has been placed. */
export function clearVentureCart(ventureId: string): void {
  write(getSnapshot().filter((entry) => entry.ventureId !== ventureId))
}

export function clearCart(): void {
  write([])
}

/**
 * Replaces the stored copies with what the menu actually says now, and drops
 * anything that is no longer for sale.
 *
 * Called by the cart page once the live menus are in. A cart can sit in
 * localStorage for a week, and checking out against a week-old price is a
 * dispute with a seller who never agreed to it. Returns what was dropped so
 * the page can say so rather than silently shortening the list.
 */
export function reconcileCart(live: Map<string, MenuItem>): {
  removed: string[]
  repriced: string[]
} {
  const removed: string[] = []
  const repriced: string[] = []
  const next: CartEntry[] = []

  for (const entry of getSnapshot()) {
    const item = live.get(entry.itemId)
    // Not in the map at all means the venture's menu has not been fetched —
    // a failed read must not empty somebody's cart, so the entry is kept.
    if (item === undefined) {
      next.push(entry)
      continue
    }
    // Both lists name the item as the menu calls it NOW, not as the cart
    // remembers it. A seller who renamed "beanie" to "Winter beanie" would
    // otherwise have their buyer told a price changed on something that is no
    // longer on screen under that name.
    const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
    if (!sellable) {
      removed.push(item.name)
      continue
    }
    const quantity = Math.min(entry.quantity, item.stock ?? Infinity)
    if (item.price !== entry.price) repriced.push(item.name)
    next.push({
      ...entry,
      name: item.name,
      price: item.price,
      stock: item.stock,
      photo: item.photo,
      quantity,
    })
  }

  if (removed.length > 0 || repriced.length > 0 || next.length !== getSnapshot().length) {
    write(next)
  }
  return { removed, repriced }
}

/** Cart lines grouped by venture, in the order the ventures were first added. */
export function groupByVenture(
  entries: CartEntry[],
): { ventureId: string; ventureName: string; entries: CartEntry[] }[] {
  const groups: { ventureId: string; ventureName: string; entries: CartEntry[] }[] = []
  for (const entry of entries) {
    const group = groups.find((candidate) => candidate.ventureId === entry.ventureId)
    if (group) group.entries.push(entry)
    else
      groups.push({
        ventureId: entry.ventureId,
        ventureName: entry.ventureName,
        entries: [entry],
      })
  }
  return groups
}
