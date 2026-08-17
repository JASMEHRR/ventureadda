import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { reportError } from '../lib/errors'
import { orderTotal, toOrderLines } from './orderLines'
import type {
  ContactPreference,
  Order,
  OrderLine,
  OrderStatus,
  PaymentMethod,
  Venture,
} from './types'

export type { ContactPreference, Order, OrderLine, OrderStatus, PaymentMethod }
export { ORDER_STATUS_LABEL, PAYMENT_LABEL } from './types'
// Deliberately NOT re-exported from here as well. `import { orderTotal }` plus
// `export { orderTotal } from './orderLines'` in the same module is a
// duplicate binding that tsc accepts and Vite refuses at runtime — callers
// import it from ./orderLines, which is where it lives.

/**
 * Orders: the one place on this site that records something rather than
 * handing it to WhatsApp.
 *
 * WHAT AN ORDER IS NOT. It is not a transaction. No money moves through this
 * app, there is no gateway, and `status` is the seller's own note about a
 * conversation that happened elsewhere. Treat every field here as a shared
 * record of what two people agreed, not as a ledger.
 *
 * WHY BUYERS MUST BE SIGNED IN. Placing an order obliges a real person to
 * cook, print or fetch something, and it puts a phone number in their hands.
 * The WhatsApp path this sits alongside was safe to leave open because it
 * costs the seller nothing until they reply; a written order is not. Firestore
 * rules pin `buyerUid` to the caller, so every order is attributable and a
 * seller who is being messed about has a name to report.
 */

const ordersRef = collection(db, 'orders')

/** Firestore hands back a Timestamp; a Date is what the UI can format. */
function toDate(value: unknown): Date | null {
  return value instanceof Timestamp ? value.toDate() : null
}

const STATUSES: OrderStatus[] = ['pending', 'paid', 'completed']

function toOrder(snapshot: QueryDocumentSnapshot<DocumentData>): Order {
  const data = snapshot.data()
  const status = data.status as OrderStatus
  return {
    id: snapshot.id,
    ventureId: data.ventureId ?? '',
    ventureName: data.ventureName ?? '',
    ownerId: data.ownerId ?? '',
    buyerUid: data.buyerUid ?? '',
    buyerName: data.buyerName ?? '',
    buyerPhone: data.buyerPhone ?? '',
    lines: toOrderLines(data.lines),
    total: typeof data.total === 'number' ? data.total : 0,
    contactPreference: data.contactPreference === 'sellerContacts' ? 'sellerContacts' : 'buyerContacts',
    payment: data.payment === 'online' ? 'online' : 'cod',
    deliveryAddress: data.deliveryAddress ?? '',
    deliverySlot: data.deliverySlot ?? '',
    // An unrecognised status is treated as the least advanced one rather than
    // rendered raw: this drives a badge and a set of buttons, and an unknown
    // value there would leave the seller with a row they cannot move.
    status: STATUSES.includes(status) ? status : 'pending',
    seen: data.seen === true,
    createdAt: toDate(data.createdAt),
  }
}

export type OrderInput = {
  venture: Pick<Venture, 'id' | 'name' | 'ownerId'>
  buyerUid: string
  buyerName: string
  buyerPhone: string
  lines: OrderLine[]
  contactPreference: ContactPreference
  payment: PaymentMethod
  deliveryAddress: string
  deliverySlot: string
}

/**
 * Writes the order and returns its id.
 *
 * Every field the rules expect is written unconditionally, including the empty
 * ones: the create rule uses `hasOnly` against a fixed key list, and an omitted
 * optional field is the standard way to have that rule start refusing writes
 * six months from now for reasons nobody can reproduce.
 */
export async function createOrder(input: OrderInput): Promise<string> {
  const payload = {
    ventureId: input.venture.id,
    ventureName: input.venture.name,
    ownerId: input.venture.ownerId,
    buyerUid: input.buyerUid,
    buyerName: input.buyerName,
    buyerPhone: input.buyerPhone,
    lines: input.lines,
    total: orderTotal(input.lines),
    contactPreference: input.contactPreference,
    payment: input.payment,
    deliveryAddress: input.deliveryAddress,
    deliverySlot: input.deliverySlot,
    status: 'pending' as OrderStatus,
    seen: false,
    createdAt: serverTimestamp(),
  }

  try {
    const created = await addDoc(ordersRef, payload)
    return created.id
  } catch (cause) {
    console.error('[ventureadda] order payload that was refused', payload)
    throw new Error(reportError('createOrder', cause))
  }
}

/**
 * The seller's own orders, newest first.
 *
 * Sorted in memory rather than with orderBy, which would need a composite
 * index on (ownerId, createdAt) — this codebase deliberately runs without any,
 * and a class-sized order list is nowhere near the size where that hurts.
 *
 * A just-written order has a null createdAt for the moment before the server
 * timestamp lands, so those sort to the top, which is also where they belong.
 */
export async function listOrdersForOwner(ownerId: string): Promise<Order[]> {
  const snapshot = await getDocs(query(ordersRef, where('ownerId', '==', ownerId)))
  return snapshot.docs
    .map(toOrder)
    .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity))
}

/**
 * The buyer's own orders, newest first.
 *
 * Same shape and the same in-memory sort as listOrdersForOwner, for the same
 * reason: an orderBy here would need a composite index on (buyerUid,
 * createdAt) and this codebase deliberately runs without any.
 *
 * The read rule was widened to `buyerUid == uid` to allow this. It was
 * originally seller-only on the grounds that no per-buyer query existed — this
 * is that query, and the document holds the buyer's own name, number and
 * address, so they are reading nothing about themselves they did not type.
 */
export async function listOrdersForBuyer(buyerUid: string): Promise<Order[]> {
  const snapshot = await getDocs(query(ordersRef, where('buyerUid', '==', buyerUid)))
  return snapshot.docs
    .map(toOrder)
    .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity))
}

/**
 * How many of this seller's orders they have not looked at yet.
 *
 * Its own query rather than a count off `listOrdersForOwner`, because the nav
 * badge is rendered on every page and must not drag the whole order history —
 * lines, addresses, phone numbers — into memory to display a number. The
 * `seen == false` filter is a second equality on the same query, which
 * Firestore serves from the automatic single-field indexes with no composite
 * index needed.
 */
export async function countUnseenOrders(ownerId: string): Promise<number> {
  const snapshot = await getDocs(
    query(ordersRef, where('ownerId', '==', ownerId), where('seen', '==', false)),
  )
  return snapshot.size
}

export async function deleteOrder(orderId: string): Promise<void> {
  try {
    await deleteDoc(doc(ordersRef, orderId))
  } catch (cause) {
    throw new Error(reportError(`deleteOrder: ${orderId}`, cause))
  }
}

export async function setOrderStatus(orderId: string, status: OrderStatus): Promise<void> {
  try {
    await updateDoc(doc(ordersRef, orderId), { status })
  } catch (cause) {
    throw new Error(reportError(`setOrderStatus: ${orderId} -> ${status}`, cause))
  }
}

/**
 * Clears the unseen badge for orders the seller has now looked at.
 *
 * Best-effort and never thrown from: this runs as a side effect of rendering
 * the page, and a badge that fails to clear must not put an error banner over
 * the orders the seller came to read. Batched because opening the page after a
 * quiet week should be one round trip, not thirty.
 */
export async function markOrdersSeen(orderIds: string[]): Promise<void> {
  if (orderIds.length === 0) return
  try {
    // Firestore caps a batch at 500 writes. Chunking rather than assuming the
    // list is short, because "nobody will ever have 500 unread" is how that
    // assumption gets found out.
    for (let start = 0; start < orderIds.length; start += 500) {
      const batch = writeBatch(db)
      for (const id of orderIds.slice(start, start + 500)) {
        batch.update(doc(ordersRef, id), { seen: true })
      }
      await batch.commit()
    }
  } catch (cause) {
    reportError('markOrdersSeen', cause)
  }
}
