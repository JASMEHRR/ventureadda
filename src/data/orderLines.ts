import type { OrderLine } from './types'

/**
 * The money path of an order, kept free of Firestore.
 *
 * Split out of orders.ts for the same reason menuDrafts.ts is split out of
 * ventures.ts: this is the logic worth testing, and orders.ts imports
 * lib/firebase, which cannot be loaded by `node` on its own. Nothing here
 * touches the network or the clock.
 *
 * Everything these two can get wrong is silent. A dropped line or a coerced
 * zero shows up as a smaller number on a seller's dashboard, and neither the
 * buyer nor the seller has any reason to recount it.
 */

/** Whole rupees. No fractional currency anywhere in this product. */
export function orderTotal(lines: OrderLine[]): number {
  return lines.reduce((sum, line) => sum + line.price * line.quantity, 0)
}

/**
 * Turns whatever is stored on the document back into lines.
 *
 * Defensive rather than trusting, because firestore.rules cannot iterate a
 * list and so does not validate the shape of the elements — see the comment on
 * the orders create rule. A line with no readable name is dropped; malformed
 * numbers become zero rather than NaN, which would otherwise propagate through
 * every sum it touches and render the whole page as "₹NaN".
 */
export function toOrderLines(value: unknown): OrderLine[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((raw) => {
    if (!raw || typeof raw !== 'object') return []
    const line = raw as Record<string, unknown>
    if (typeof line.name !== 'string') return []
    return [
      {
        itemId: typeof line.itemId === 'string' ? line.itemId : '',
        name: line.name,
        price: typeof line.price === 'number' ? line.price : 0,
        quantity: typeof line.quantity === 'number' ? line.quantity : 0,
      },
    ]
  })
}
