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
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { reportError } from '../lib/errors'
import type { Billboard, BillboardStatus } from './billboardPick'
import type { StoredImage } from './types'

export {
  BILLBOARD_STATUS_LABEL,
  OFFER_LIMIT,
  PITCH_LIMIT,
  BILLBOARD_SECONDS,
  billboardSeconds,
  billboardOrder,
} from './billboardPick'
export type { Billboard, BillboardStatus } from './billboardPick'

/**
 * The Billboard: one paid-attention slot on the front page, shared by the
 * whole campus and approved by a moderator before anybody sees it.
 *
 * THIS IS AN ADVERT AND IT IS CALLED ONE. The first attempt at this derived a
 * "featured" strip from stock counts, so any item down to its last unit
 * promoted itself, on every listing, with nobody's approval. That is not an
 * advert, it is an alarm — and a site that promotes things automatically is a
 * site whose front page is decided by whoever happens to be low on stock.
 *
 * So every part of that is inverted here:
 *
 *   - A SELLER ASKS. Nothing is promoted by inference. They pick one of their
 *     own items, write a line, and submit it.
 *   - A MODERATOR APPROVES. It is pending until then and pending is invisible.
 *     The front page is the site's own voice; a seller cannot write on it
 *     unaided.
 *   - ONE SLOT, EVERY VENTURE. Not a rail per shop. There is a single board
 *     across the top of the main screen and the approved ads take turns on it,
 *     so the small shop with one ad gets the same exposure as the large one.
 *
 * WHY A COLLECTION AND NOT A FLAG ON THE ITEM. An advert has things an item
 * does not: a pitch in the seller's words, an offer that is not the item's
 * real price, a status, a reason it was refused. Putting those on menuItems
 * would mean every read of a menu carries advertising fields, and it would put
 * a moderator-controlled field on a document sellers write freely.
 */

const billboardsRef = collection(db, 'billboards')

function toBillboard(snapshot: QueryDocumentSnapshot<DocumentData>): Billboard {
  const data = snapshot.data()
  const status = data.status as BillboardStatus
  return {
    id: snapshot.id,
    ventureId: data.ventureId ?? '',
    ventureName: data.ventureName ?? '',
    ventureSlug: data.ventureSlug ?? '',
    ownerId: data.ownerId ?? '',
    itemId: data.itemId ?? '',
    itemName: data.itemName ?? '',
    photo: data.photo ?? undefined,
    pitch: data.pitch ?? '',
    offer: data.offer ?? '',
    // An unrecognised status is treated as pending rather than shown: the
    // failure mode of this field is an unapproved advert on the front page.
    status: status === 'live' || status === 'rejected' ? status : 'pending',
    rejectionReason: data.rejectionReason ?? '',
    paused: data.paused === true,
    createdAt: data.createdAt instanceof Timestamp ? data.createdAt.toDate() : null,
  }
}

/** Everything on the board right now. Public — the rules only return live ones
 *  to a stranger, and the query says so explicitly so it passes them. */
export async function listLiveBillboards(): Promise<Billboard[]> {
  const snapshot = await getDocs(query(billboardsRef, where('status', '==', 'live')))
  return snapshot.docs.map(toBillboard)
}

/** The seller's own ads, whatever their status. */
export async function listBillboardsForVenture(ventureId: string): Promise<Billboard[]> {
  const snapshot = await getDocs(query(billboardsRef, where('ventureId', '==', ventureId)))
  return snapshot.docs
    .map(toBillboard)
    .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity))
}

/** The moderator's queue. */
export async function listBillboardsByStatus(status: BillboardStatus): Promise<Billboard[]> {
  const snapshot = await getDocs(query(billboardsRef, where('status', '==', status)))
  return snapshot.docs
    .map(toBillboard)
    .sort((a, b) => (b.createdAt?.getTime() ?? Infinity) - (a.createdAt?.getTime() ?? Infinity))
}

export type BillboardInput = {
  ventureId: string
  ventureName: string
  ventureSlug: string
  ownerId: string
  itemId: string
  itemName: string
  photo?: StoredImage
  pitch: string
  offer: string
}

/**
 * Submits an advert for approval. Always pending, never live.
 *
 * Every key the rules expect is written unconditionally, including the empty
 * ones — the create rule checks a fixed set, and an omitted optional field is
 * the standard way to have that rule start refusing writes months from now for
 * reasons nobody can reproduce.
 */
export async function submitBillboard(input: BillboardInput): Promise<string> {
  const payload = {
    ventureId: input.ventureId,
    ventureName: input.ventureName,
    ventureSlug: input.ventureSlug,
    ownerId: input.ownerId,
    itemId: input.itemId,
    itemName: input.itemName,
    ...(input.photo ? { photo: input.photo } : {}),
    pitch: input.pitch.trim(),
    offer: input.offer.trim(),
    status: 'pending' as BillboardStatus,
    rejectionReason: '',
    paused: false,
    createdAt: serverTimestamp(),
  }
  try {
    const created = await addDoc(billboardsRef, payload)
    return created.id
  } catch (cause) {
    throw new Error(reportError('submitBillboard', cause))
  }
}

/**
 * The seller taking their own advert off the board, or putting it back.
 *
 * Deliberately not a re-approval: the moderator approved this wording and this
 * item, and neither changes here. Editing the words is what sends it back to
 * the queue — see the rules.
 */
export async function setBillboardPaused(id: string, paused: boolean): Promise<void> {
  try {
    await updateDoc(doc(billboardsRef, id), { paused })
  } catch (cause) {
    throw new Error(reportError(`setBillboardPaused: ${id}`, cause))
  }
}

/** The moderator's decision. A reason is required to refuse and cleared on
 *  approval, so a rejected-then-approved ad does not keep the old complaint. */
export async function setBillboardStatus(
  id: string,
  status: BillboardStatus,
  rejectionReason = '',
): Promise<void> {
  try {
    await updateDoc(doc(billboardsRef, id), { status, rejectionReason })
  } catch (cause) {
    throw new Error(reportError(`setBillboardStatus: ${id} -> ${status}`, cause))
  }
}

/**
 * A moderator correcting the wording, without sending it back to the seller.
 *
 * Not a re-approval, because the person doing this IS the approval. Refusing
 * an advert over a typo costs a round trip through somebody who may not come
 * back for a week, and leaves the board emptier for it; the rules therefore
 * let a moderator write pitch and offer directly. `paused` deliberately stays
 * the seller's, and a moderator who wants an advert off the board refuses it,
 * which says so and leaves a reason.
 */
export async function editBillboard(id: string, pitch: string, offer: string): Promise<void> {
  try {
    await updateDoc(doc(billboardsRef, id), { pitch: pitch.trim(), offer: offer.trim() })
  } catch (cause) {
    throw new Error(reportError(`editBillboard: ${id}`, cause))
  }
}

export async function deleteBillboard(id: string): Promise<void> {
  try {
    await deleteDoc(doc(billboardsRef, id))
  } catch (cause) {
    throw new Error(reportError(`deleteBillboard: ${id}`, cause))
  }
}
