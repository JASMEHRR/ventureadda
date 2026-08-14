import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { CATEGORIES } from './types'
import type { Category, MenuItem, StoredImage, Venture, VentureStatus } from './types'

export type { Category, MenuItem, StoredImage, Venture, VentureStatus }
export { CATEGORIES, categoryName } from './types'

/**
 * The whole data boundary. Pages call only these functions.
 *
 * Queries here are shaped to satisfy firestore.rules, which is not incidental:
 * public browsing is only permitted on a query that filters status == 'live',
 * so a read that forgets that filter fails with a permission error rather than
 * quietly returning everything. Category and search filtering happen in memory
 * afterwards, which keeps the app free of composite indexes at class-sized
 * volumes.
 */

const venturesRef = collection(db, 'ventures')
const menuItemsRef = collection(db, 'menuItems')

/**
 * Malformed fields are coerced to a usable default rather than thrown, because
 * one bad document should not take out the whole browse page. The trade is that
 * it fails invisibly — a venture whose photos are not an array renders the
 * ImageOff placeholder and says nothing — so in dev it says something.
 */
function warnMalformed(id: string, field: string, value: unknown): void {
  if (import.meta.env.DEV) {
    console.warn(`[ventures] ${id}: "${field}" is malformed, using a default.`, value)
  }
}

function toVenture(snapshot: QueryDocumentSnapshot<DocumentData>): Venture {
  const data = snapshot.data()
  if (data.photos !== undefined && !Array.isArray(data.photos)) {
    warnMalformed(snapshot.id, 'photos', data.photos)
  }
  return {
    id: snapshot.id,
    ownerId: data.ownerId ?? '',
    ownerUsername: data.ownerUsername ?? '',
    name: data.name ?? '',
    categoryId: data.categoryId ?? 'other',
    description: data.description ?? '',
    hours: data.hours ?? '',
    phone: data.phone ?? '',
    photos: Array.isArray(data.photos) ? (data.photos as StoredImage[]) : [],
    status: (data.status ?? 'pending') as VentureStatus,
    rejectionReason: data.rejectionReason,
    clickCount: typeof data.clickCount === 'number' ? data.clickCount : 0,
  }
}

function toMenuItem(snapshot: QueryDocumentSnapshot<DocumentData>): MenuItem {
  const data = snapshot.data()
  if (data.price !== undefined && typeof data.price !== 'number') {
    warnMalformed(snapshot.id, 'price', data.price)
  }
  return {
    id: snapshot.id,
    ventureId: data.ventureId ?? '',
    name: data.name ?? '',
    description: data.description || undefined,
    price: typeof data.price === 'number' ? data.price : 0,
    photo: data.photo ?? undefined,
    inquiryCount: typeof data.inquiryCount === 'number' ? data.inquiryCount : 0,
  }
}

function matchesQuery(venture: Venture, items: MenuItem[], needle: string): boolean {
  const q = needle.trim().toLowerCase()
  if (!q) return true
  if (venture.name.toLowerCase().includes(q)) return true
  if (venture.description.toLowerCase().includes(q)) return true
  if (venture.ownerUsername.toLowerCase().includes(q)) return true
  // Searching "brownie" should find the venture that sells brownies, not only
  // ventures with "brownie" in their name.
  return items.some((item) => item.name.toLowerCase().includes(q))
}

export async function listCategories(): Promise<Category[]> {
  return CATEGORIES
}

export async function listVentures(
  options: { categoryId?: string; query?: string } = {},
): Promise<Venture[]> {
  const { categoryId, query: needle = '' } = options
  const snapshot = await getDocs(query(venturesRef, where('status', '==', 'live')))
  const ventures = snapshot.docs.map(toVenture)

  const scoped = categoryId
    ? ventures.filter((venture) => venture.categoryId === categoryId)
    : ventures

  if (!needle.trim()) return scoped

  // Only fetch menus when there is actually a search term to match them against.
  const allItems = (await getDocs(menuItemsRef)).docs.map(toMenuItem)
  return scoped.filter((venture) =>
    matchesQuery(
      venture,
      allItems.filter((item) => item.ventureId === venture.id),
      needle,
    ),
  )
}

export async function getVenture(ventureId: string): Promise<Venture | null> {
  try {
    const snapshot = await getDoc(doc(venturesRef, ventureId))
    if (!snapshot.exists()) return null
    return toVenture(snapshot as QueryDocumentSnapshot<DocumentData>)
  } catch {
    // The rules refuse a pending or rejected venture to anyone but its owner
    // and moderators. To everyone else that is indistinguishable from missing,
    // and saying so is the right answer anyway.
    return null
  }
}

export async function listMenuItems(ventureId: string): Promise<MenuItem[]> {
  const snapshot = await getDocs(query(menuItemsRef, where('ventureId', '==', ventureId)))
  return snapshot.docs.map(toMenuItem).sort((a, b) => a.name.localeCompare(b.name))
}

export async function countVenturesByCategory(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const category of CATEGORIES) counts[category.id] = 0
  const snapshot = await getDocs(query(venturesRef, where('status', '==', 'live')))
  for (const document of snapshot.docs) {
    const categoryId = document.data().categoryId ?? 'other'
    counts[categoryId] = (counts[categoryId] ?? 0) + 1
  }
  return counts
}

/** Moderator queue. The rules only allow this query to a moderator. */
export async function listVenturesByStatus(status: VentureStatus): Promise<Venture[]> {
  const snapshot = await getDocs(query(venturesRef, where('status', '==', status)))
  return snapshot.docs.map(toVenture)
}

export async function listVenturesByOwner(ownerId: string): Promise<Venture[]> {
  const snapshot = await getDocs(query(venturesRef, where('ownerId', '==', ownerId)))
  return snapshot.docs.map(toVenture)
}

export type VentureInput = {
  name: string
  categoryId: string
  description: string
  hours: string
  phone: string
  photos: StoredImage[]
}

export type MenuItemInput = {
  id?: string
  name: string
  description: string
  price: number
  photo?: StoredImage
}

/**
 * Creates a venture and its menu in one batch, so a submission never lands
 * half-written if the connection drops between the two.
 *
 * Status is always 'pending' — the rules reject anything else on create, which
 * is what stops an owner publishing straight past the approval queue.
 */
export async function createVenture(
  owner: { uid: string; username: string },
  input: VentureInput,
  items: MenuItemInput[],
): Promise<string> {
  const batch = writeBatch(db)
  const ventureRef = doc(venturesRef)

  batch.set(ventureRef, {
    ownerId: owner.uid,
    ownerUsername: owner.username,
    ...input,
    status: 'pending',
    clickCount: 0,
    createdAt: serverTimestamp(),
  })

  for (const item of items) {
    batch.set(doc(menuItemsRef), {
      ventureId: ventureRef.id,
      name: item.name,
      description: item.description,
      price: item.price,
      ...(item.photo ? { photo: item.photo } : {}),
      inquiryCount: 0,
    })
  }

  await batch.commit()
  return ventureRef.id
}

/**
 * Replaces a venture's details and reconciles its menu.
 *
 * Existing items are updated in place rather than deleted and recreated, so
 * their inquiry counts survive an edit. Items dropped from the form are
 * removed, and their counts go with them.
 */
export async function updateVenture(
  ventureId: string,
  input: VentureInput,
  items: MenuItemInput[],
): Promise<void> {
  const existing = await listMenuItems(ventureId)
  const keptIds = new Set(items.map((item) => item.id).filter(Boolean) as string[])

  const batch = writeBatch(db)
  batch.update(doc(venturesRef, ventureId), { ...input })

  for (const item of items) {
    const payload = {
      ventureId,
      name: item.name,
      description: item.description,
      price: item.price,
      ...(item.photo ? { photo: item.photo } : {}),
    }
    if (item.id) {
      batch.update(doc(menuItemsRef, item.id), payload)
    } else {
      batch.set(doc(menuItemsRef), { ...payload, inquiryCount: 0 })
    }
  }

  for (const item of existing) {
    if (!keptIds.has(item.id)) batch.delete(doc(menuItemsRef, item.id))
  }

  await batch.commit()
}

/** Moderator only, per the rules. */
export async function setVentureStatus(
  ventureId: string,
  status: VentureStatus,
  rejectionReason?: string,
): Promise<void> {
  await updateDoc(doc(venturesRef, ventureId), {
    status,
    rejectionReason: rejectionReason ?? '',
  })
}

/**
 * Removes a venture and its menu.
 *
 * Cloudinary assets are deliberately left behind: deleting them needs the API
 * secret, which must never reach frontend code. They are orphaned, not leaked,
 * and clearing them is a housekeeping job for the Cloudinary console.
 */
export async function deleteVenture(ventureId: string): Promise<void> {
  const items = await listMenuItems(ventureId)
  const batch = writeBatch(db)
  for (const item of items) batch.delete(doc(menuItemsRef, item.id))
  batch.delete(doc(venturesRef, ventureId))
  await batch.commit()
}

/**
 * Records an item-level inquiry tap.
 *
 * Allowed to signed-out visitors by the rules, capped at exactly plus one on
 * this single field. Logged-out people are most of the traffic, and counting
 * only signed-in taps would discard the majority of the evidence the
 * commission conversation later rests on.
 */
export async function recordInquiry(itemId: string): Promise<void> {
  await updateDoc(doc(menuItemsRef, itemId), { inquiryCount: increment(1) })
}

/** Venture-level opens, same public increment path as inquiries. */
export async function recordVentureView(ventureId: string): Promise<void> {
  try {
    await updateDoc(doc(venturesRef, ventureId), { clickCount: increment(1) })
  } catch {
    // A view counter is never worth breaking the page over.
  }
}

export async function deleteMenuItemsForVenture(ventureId: string): Promise<void> {
  const items = await listMenuItems(ventureId)
  const batch = writeBatch(db)
  for (const item of items) batch.delete(doc(menuItemsRef, item.id))
  await batch.commit()
}
