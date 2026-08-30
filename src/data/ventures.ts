import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { reportError } from '../lib/errors'
import { CATEGORIES, MENU_DENSITIES } from './types'
import { looksLikeDocumentId, slugWithSuffix, slugify } from './slug'
import type { Category, MenuDensity, MenuItem, StoredImage, Venture, VentureStatus } from './types'

export type { Category, MenuDensity, MenuItem, StoredImage, Venture, VentureStatus }
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
    // Cleared logos are stored as null by updateVenture, so absent and cleared
    // both have to come back as undefined rather than as a falsy StoredImage.
    logo: (data.logo as StoredImage | null | undefined) ?? undefined,
    // Absent on every venture written before slots existed, and an empty list
    // is the honest reading of that: this seller has not published any.
    deliverySlots: Array.isArray(data.deliverySlots)
      ? (data.deliverySlots as unknown[]).filter(
          (slot): slot is string => typeof slot === 'string' && slot.trim() !== '',
        )
      : [],
    slug: typeof data.slug === 'string' && data.slug !== '' ? data.slug : undefined,
    // Absent on every venture written before co-owners existed.
    managerEmails: Array.isArray(data.managerEmails)
      ? (data.managerEmails as unknown[]).filter(
          (email): email is string => typeof email === 'string' && email.trim() !== '',
        )
      : [],
    kind: typeof data.kind === 'string' ? data.kind.trim() : '',
    // Firestore hands back a Timestamp, and null in the instant before a
    // server timestamp resolves on the writer's own screen.
    updatedAt: data.updatedAt?.toDate?.() ?? null,
    // Absent on every venture written before this setting existed, and off is
    // the behaviour those had.
    brandLogos: data.brandLogos === true,
    menuDensity: MENU_DENSITIES.includes(data.menuDensity as MenuDensity)
      ? (data.menuDensity as MenuDensity)
      : 'default',
    status: (data.status ?? 'pending') as VentureStatus,
    rejectionReason: data.rejectionReason,
    clickCount: typeof data.clickCount === 'number' ? data.clickCount : 0,
    isDemo: data.isDemo === true,
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
    // Absent stays absent — 0 would publish a free item, which is a different
    // claim from "ask".
    price: typeof data.price === 'number' ? data.price : undefined,
    photo: data.photo ?? undefined,
    category: data.category || undefined,
    // Absent means in stock. Every item written before this field existed has
    // no value here, and defaulting those to false would empty every menu on
    // the site the moment this deploys.
    inStock: data.inStock !== false,
    // Zero is meaningful — the seller counted and has none — so this cannot
    // collapse to a falsy check.
    stock: typeof data.stock === 'number' && data.stock >= 0 ? data.stock : undefined,
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

/** A menu item with enough of its seller attached to render a result row. */
export type ItemMatch = {
  item: MenuItem
  venture: Venture
}

/**
 * Products across every live venture, for a directory-wide search.
 *
 * listVentures already matched item names — searching "brownie" has always
 * found the venture that sells brownies — but it returned only the venture,
 * so the buyer landed on a page of forty items still hunting for the one they
 * typed. This returns the items themselves.
 *
 * Sold-out items are kept rather than filtered. "Brownies, sold out today" is
 * an answer; silently returning nothing tells somebody this campus has no
 * brownies at all, which is a different and wrong claim.
 *
 * The same two reads listVentures does, and the caller runs them together, so
 * a search costs no more round trips than it used to. This is a
 * class-sized dataset read whole and filtered in memory — the honest ceiling
 * on that is a few thousand items, well past anything this site will hold, and
 * the alternative is a search product for a directory of forty sellers.
 */
export async function searchMenuItems(needle: string): Promise<ItemMatch[]> {
  if (!needle.trim()) return []
  return listProducts({ query: needle })
}

/**
 * EVERY product on the site, which is what /products is.
 *
 * The directory has always been a list of shops, and finding a thing meant
 * knowing which shop sold it or typing its name into a search box — fine for
 * "brownie", useless for "what is actually on sale here". This is the other
 * way in: one grid of items, filterable, that nobody has to guess a word to
 * open.
 *
 * Same two reads as searchMenuItems, which is now a caller of this: the whole
 * menuItems collection and every live venture, joined and filtered in memory.
 * See the note above for why that is the right shape at this size and where
 * the ceiling is.
 *
 * Sold-out items are kept, and for a stronger reason here than in search: a
 * page claiming to be everything on campus that quietly drops today's
 * sold-out cakes is lying about the campus.
 */
export async function listProducts(
  options: { query?: string; categoryId?: string } = {},
): Promise<ItemMatch[]> {
  const q = (options.query ?? '').trim().toLowerCase()

  const [ventureSnapshot, itemSnapshot] = await Promise.all([
    getDocs(query(venturesRef, where('status', '==', 'live'))),
    getDocs(menuItemsRef),
  ])

  // Live ventures only. A pending or rejected listing is one no moderator has
  // approved, and its menu must not be reachable through a search box or a
  // products page.
  const live = new Map(
    ventureSnapshot.docs
      .map(toVenture)
      .filter((venture) => !options.categoryId || venture.categoryId === options.categoryId)
      .map((venture) => [venture.id, venture]),
  )

  return itemSnapshot.docs
    .map(toMenuItem)
    .filter(
      (item) =>
        q === '' ||
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q) ||
        (item.category ?? '').toLowerCase().includes(q),
    )
    .flatMap((item) => {
      const venture = live.get(item.ventureId)
      return venture ? [{ item, venture }] : []
    })
    .sort((a, b) => {
      // A name match beats a description match: someone typing "beanie" wants
      // the beanie, not the scarf whose description mentions one. With no
      // search term both sides are false and this falls through to the name,
      // which is the stable order an unfiltered grid needs — Firestore's own
      // document order differs between reads.
      const aName = q !== '' && a.item.name.toLowerCase().includes(q)
      const bName = q !== '' && b.item.name.toLowerCase().includes(q)
      if (aName !== bName) return aName ? -1 : 1
      return a.item.name.localeCompare(b.item.name)
    })
}

const slugsRef = collection(db, 'slugs')

/**
 * Claims a readable link for a venture, or returns null if it cannot.
 *
 * A CLAIM IS FOREVER, which is the whole design and mirrors how usernames
 * work here. firestore.rules refuses update and delete on a claim, so a slug
 * can never be handed to a different venture — links pasted into group chats
 * months ago keep pointing where they pointed, and nobody can inherit somebody
 * else's audience by taking a name they stopped using.
 *
 * The consequence, stated plainly: renaming a venture earns it a new link and
 * leaves the old one working. That is the right way round. The alternative
 * breaks every share of the old name to tidy up a database row.
 *
 * Never throws. A venture with no slug has a longer link, which is exactly
 * what it had before this existed — not worth failing a save over.
 */
async function claimSlug(ventureId: string, name: string): Promise<string | null> {
  const base = slugify(name)
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const candidate = attempt === 0 ? base : slugWithSuffix(base, attempt + 1)
    try {
      const ref = doc(slugsRef, candidate)
      const existing = await getDoc(ref)
      if (existing.exists()) {
        // Already ours: re-saving a venture without renaming it lands here
        // every time, and that is a success, not a collision.
        if (existing.data().ventureId === ventureId) return candidate
        continue
      }
      await setDoc(ref, { ventureId })
      return candidate
    } catch {
      // Refused by the rules or offline. Either way the venture keeps its
      // document-id link.
      return null
    }
  }
  return null
}

/** Where this venture lives, by its readable name when it has one. */
export function venturePath(venture: Pick<Venture, 'id' | 'slug'>): string {
  return `/venture/${venture.slug ?? venture.id}`
}

/**
 * Resolves whatever is in the URL — a slug or a document id — to a venture.
 *
 * Both are tried, always, so every link ever shared keeps working: the id
 * links that were the only kind before this existed, and the readable ones
 * from here on. `looksLikeDocumentId` only decides which to attempt first, so
 * a wrong guess costs one extra read rather than a missing page.
 */
export async function getVenture(idOrSlug: string): Promise<Venture | null> {
  const byId = async (): Promise<Venture | null> => {
    try {
      const snapshot = await getDoc(doc(venturesRef, idOrSlug))
      if (!snapshot.exists()) return null
      return toVenture(snapshot as QueryDocumentSnapshot<DocumentData>)
    } catch {
      // The rules refuse a pending or rejected venture to anyone but its owner
      // and moderators. To everyone else that is indistinguishable from
      // missing, and saying so is the right answer anyway.
      return null
    }
  }

  const bySlug = async (): Promise<Venture | null> => {
    try {
      const claim = await getDoc(doc(slugsRef, idOrSlug))
      if (!claim.exists()) return null
      const snapshot = await getDoc(doc(venturesRef, claim.data().ventureId as string))
      if (!snapshot.exists()) return null
      return toVenture(snapshot as QueryDocumentSnapshot<DocumentData>)
    } catch {
      return null
    }
  }

  return looksLikeDocumentId(idOrSlug)
    ? ((await byId()) ?? (await bySlug()))
    : ((await bySlug()) ?? (await byId()))
}

/**
 * Category first (uncategorised items sort last, after every named group),
 * then name within it — so a venture's own sections read as sections instead
 * of an alphabetised jumble.
 */
export async function listMenuItems(ventureId: string): Promise<MenuItem[]> {
  const snapshot = await getDocs(query(menuItemsRef, where('ventureId', '==', ventureId)))
  return snapshot.docs.map(toMenuItem).sort((a, b) => {
    if (Boolean(a.category) !== Boolean(b.category)) return a.category ? -1 : 1
    const category = (a.category ?? '').localeCompare(b.category ?? '')
    return category !== 0 ? category : a.name.localeCompare(b.name)
  })
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

/**
 * Rewrites the seller name stored on this owner's own listings.
 *
 * The name is denormalised onto every venture so a directory page can show it
 * without a read per card. That is the right trade until somebody renames
 * themselves, at which point their listings are the one place still showing a
 * name they have stopped using — a live shopfront, unlike a chat message or a
 * review, which are records of something said at a time and keep the name it
 * was said under.
 *
 * Best effort by design: the rename itself has already committed, and a
 * listing carrying a stale display name for a while is a far smaller problem
 * than a rename that fails halfway and leaves the account and its claim
 * disagreeing.
 */
export async function renameVentureOwner(ownerId: string, username: string): Promise<void> {
  const snapshot = await getDocs(query(venturesRef, where('ownerId', '==', ownerId)))
  if (snapshot.empty) return
  const batch = writeBatch(db)
  for (const document of snapshot.docs) batch.update(document.ref, { ownerUsername: username })
  await batch.commit()
}

/**
 * Gives a readable link to every live venture that predates slugs.
 *
 * A moderator action rather than something that happens on read: claiming a
 * slug is a write, and a page that quietly writes to the database because
 * somebody looked at it is a page that surprises whoever debugs it later.
 * Runs as a moderator, which is what lets it write claims for ventures it
 * does not own.
 *
 * Returns how many it named, so the button can say something true rather than
 * "done".
 */
export async function backfillSlugs(): Promise<number> {
  const snapshot = await getDocs(query(venturesRef, where('status', '==', 'live')))
  let named = 0
  for (const document of snapshot.docs) {
    const venture = toVenture(document)
    if (venture.slug) continue
    const slug = await claimSlug(venture.id, venture.name)
    if (!slug) continue
    await updateDoc(document.ref, { slug })
    named += 1
  }
  return named
}

/**
 * "Yes, this is still right" — the whole of it.
 *
 * One field, so a seller can answer the staleness question in a tap instead of
 * opening a form of thirty items to change nothing and press Save. The rules
 * treat it as an ordinary owner edit, which it is.
 */
export async function touchVenture(ventureId: string): Promise<void> {
  await updateDoc(doc(venturesRef, ventureId), { updatedAt: serverTimestamp() })
}

export async function listVenturesByOwner(ownerId: string): Promise<Venture[]> {
  const snapshot = await getDocs(query(venturesRef, where('ownerId', '==', ownerId)))
  return snapshot.docs.map(toVenture)
}

/**
 * Every listing this person can edit: their own, and the ones they have been
 * added to as a co-owner.
 *
 * Two queries rather than one, because Firestore has no OR across different
 * fields — and both are shapes the read rule allows on its own. The second is
 * skipped for an account with no address at all, which is not a case that
 * exists today but costs nothing to not ask about.
 */
export async function listVenturesForUser(
  ownerId: string,
  email: string | null | undefined,
): Promise<Venture[]> {
  const own = await listVenturesByOwner(ownerId)
  if (!email) return own

  const managed = await getDocs(
    query(venturesRef, where('managerEmails', 'array-contains', email.toLowerCase())),
  )
  const seen = new Set(own.map((venture) => venture.id))
  return [...own, ...managed.docs.filter((doc) => !seen.has(doc.id)).map(toVenture)]
}

export type VentureInput = {
  name: string
  categoryId: string
  description: string
  hours: string
  phone: string
  photos: StoredImage[]
  deliverySlots: string[]
  managerEmails: string[]
  kind: string
  brandLogos: boolean
  menuDensity: MenuDensity
  logo?: StoredImage
}

export type MenuItemInput = {
  id?: string
  name: string
  description: string
  /** Absent means the buyer asks. */
  price?: number
  category?: string
  inStock: boolean
  /** Undefined means the seller is not counting units. */
  stock?: number
  photo?: StoredImage
}

/**
 * The stored shape of one menu item, minus the counter.
 *
 * Shared by create and update so the two cannot drift — the previous pair of
 * inline object literals differed only by `inquiryCount`, which is exactly the
 * kind of duplication that lets a new field land on one path and not the other.
 *
 * `stock` is omitted rather than written as null when the seller is not
 * counting, because on update an omitted key leaves the old value in place —
 * so it is written as null there instead, and the reader treats a non-number
 * as absent. Firestore rejects `undefined` outright either way.
 */
function menuItemPayload(ventureId: string, item: MenuItemInput) {
  return {
    ventureId,
    name: item.name,
    description: item.description,
    inStock: item.inStock,
    // Omitted rather than written as null: the rules accept a missing price
    // and refuse a non-number, and an absent field is what the reader turns
    // back into "ask".
    ...(typeof item.price === 'number' ? { price: item.price } : {}),
    ...(item.photo ? { photo: item.photo } : {}),
    ...(item.category ? { category: item.category } : {}),
  }
}

/**
 * Creates a venture, then its menu. Two writes, deliberately not one batch.
 *
 * This used to be a single writeBatch, and that was why nothing could be
 * listed. The menuItems create rule ends in:
 *
 *   get(/databases/$(db)/documents/ventures/$(request.resource.data.ventureId))
 *     .data.ownerId == request.auth.uid
 *
 * Rules `get()` resolves against *committed* state. A document written earlier
 * in the same batch is not visible to a rule evaluating another document in
 * that batch, so the get() found nothing, the rule errored, and Firestore
 * rejected the whole batch — venture included. Every submission carrying at
 * least one menu item failed, which is every submission the form permits: it
 * refuses to submit with an empty menu.
 *
 * So the venture is committed first and its items follow, by which point the
 * parent exists and the rule can see it.
 *
 * WHAT THIS COSTS. The old docblock promised a submission never lands
 * half-written. It cannot promise that any more. If the connection drops
 * between the two calls, the venture exists with no menu. That is the right
 * trade — the venture is the useful unit, a missing menu is editable, and the
 * alternative is a transaction whose read would hit the same committed-state
 * problem. The owner's own listing view flags a venture with no items so the
 * failure is visible and fixable rather than silent.
 *
 * Status is always 'pending' — the rules reject anything else on create, which
 * is what stops an owner publishing straight past the approval queue.
 */
export async function createVenture(
  owner: { uid: string; username: string },
  input: VentureInput,
  items: MenuItemInput[],
  options: { isDemo?: boolean } = {},
): Promise<string> {
  const ventureRef = doc(venturesRef)

  // Pulled out of the spread because Firestore rejects an undefined field
  // value outright, and a venture with no logo is the common case.
  const { logo, ...details } = input

  const payload = {
    ownerId: owner.uid,
    ownerUsername: owner.username,
    ...details,
    ...(logo ? { logo } : {}),
    status: 'pending',
    clickCount: 0,
    updatedAt: serverTimestamp(),
    // Only written when true, so real submissions carry no such field at all.
    ...(options.isDemo ? { isDemo: true } : {}),
    createdAt: serverTimestamp(),
  }

  try {
    await setDoc(ventureRef, payload)
  } catch (cause) {
    // The payload goes in the log too. Half of diagnosing a rules rejection is
    // knowing exactly which fields were sent, and reconstructing that from the
    // form afterwards is guesswork.
    console.error('[ventureadda] venture payload that was refused', payload)
    throw new Error(reportError('createVenture: venture document', cause))
  }

  // After the venture document exists, never before: the slugs rule checks
  // that the claimer owns the venture it points at, and rules `get()` only
  // sees committed state. A claim written first would be refused.
  const slug = await claimSlug(ventureRef.id, input.name)
  if (slug) {
    // Best effort, like the claim itself. A venture whose document did not
    // record its slug still resolves by that slug — the claim is what the
    // lookup reads — it just builds longer links until its next save.
    await updateDoc(doc(venturesRef, ventureRef.id), { slug }).catch(() => {})
  }

  // The items still go together: they are all children of a venture that now
  // exists, so the get() above resolves for every one of them.
  const batch = writeBatch(db)
  for (const item of items) {
    batch.set(doc(menuItemsRef), {
      ...menuItemPayload(ventureRef.id, item),
      ...(item.stock === undefined ? {} : { stock: item.stock }),
      inquiryCount: 0,
    })
  }

  try {
    await batch.commit()
  } catch (cause) {
    // The venture is already committed at this point, so this is the
    // half-written case the docblock warns about, not a total failure.
    throw new Error(
      reportError(`createVenture: ${items.length} menu items for ${ventureRef.id}`, cause),
    )
  }
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

  /**
   * A renamed venture earns a link matching its new name and keeps the old one
   * working, because a claim is never released. Claimed before the batch so
   * the new slug is written in the same update as the name it belongs to —
   * the two disagreeing, even briefly, is a card linking somewhere its title
   * does not match.
   *
   * Re-saving without renaming re-finds the venture's own existing claim and
   * writes the same value back, which costs one read and keeps this path free
   * of a "did the name change" comparison that would have to be right forever.
   */
  const slug = await claimSlug(ventureId, input.name)

  const batch = writeBatch(db)
  // null rather than an omitted key, so removing a logo actually removes it —
  // an update that leaves the field out keeps whatever was there before.
  batch.update(doc(venturesRef, ventureId), {
    ...input,
    logo: input.logo ?? null,
    // Only when a claim succeeded. Writing null would strip a slug the
    // venture already has because today's claim happened to fail.
    ...(slug ? { slug } : {}),
    // See Venture.updatedAt. Stamped on every save rather than only on the
    // ones that changed something, because "I looked at it and it is still
    // right" is exactly the confirmation this field exists to record.
    updatedAt: serverTimestamp(),
  })

  for (const item of items) {
    const payload = menuItemPayload(ventureId, item)
    if (item.id) {
      // null, not an omitted key: clearing a stock count has to actually clear
      // it, and an update that leaves the field out keeps yesterday's number.
      batch.update(doc(menuItemsRef, item.id), { ...payload, stock: item.stock ?? null })
    } else {
      batch.set(doc(menuItemsRef), {
        ...payload,
        ...(item.stock === undefined ? {} : { stock: item.stock }),
        inquiryCount: 0,
      })
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
 * Removes every demo listing and its menu, in one action.
 *
 * Deliberately keyed on the isDemo flag rather than on a list of names or the
 * importing account: demo data must be removable without touching a single
 * real venture, including the moderator's own. Returns how many went, because
 * "done" with no number is indistinguishable from "found nothing".
 */
export async function deleteDemoVentures(): Promise<number> {
  const snapshot = await getDocs(query(venturesRef, where('isDemo', '==', true)))
  // Sequential rather than parallel: each delete reads that venture's menu
  // first, and firing thirty reads at once on campus wifi is how this times out.
  for (const document of snapshot.docs) {
    await deleteVenture(document.id)
  }
  return snapshot.size
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
