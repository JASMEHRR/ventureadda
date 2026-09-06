import type { StoredImage } from './types'

/**
 * What an advert is, and whose turn it is on the board.
 *
 * SPLIT FROM billboard.ts SO IT CAN BE RUN BY `node`, the same division
 * orderLines.ts and orderStats.ts already use here: the rotation decides which
 * seller the whole campus sees, and that is worth a test that does not need
 * Firestore, a browser or a signed-in account to run. See billboard.ts for
 * what a Billboard is for.
 */

export type BillboardStatus = 'pending' | 'live' | 'rejected'

export const BILLBOARD_STATUS_LABEL: Record<BillboardStatus, string> = {
  pending: 'Waiting for approval',
  live: 'On the billboard',
  rejected: 'Not approved',
}

export type Billboard = {
  id: string
  ventureId: string
  /** Denormalised so the board needs no second read to draw a name. */
  ventureName: string
  /** The readable link segment, when the venture has one. */
  ventureSlug: string
  ownerId: string
  /** The item being advertised. Its own name and photo are copied at
   *  submission so an approved ad cannot be edited from underneath by renaming
   *  the item afterwards. */
  itemId: string
  itemName: string
  photo?: StoredImage
  /** The seller's line, e.g. "Handmade roses, two left this week". */
  pitch: string
  /** The deal, in their words: "30% off", "₹50 off", "Buy 2 get 1". Empty when
   *  the ad is not about a price. */
  offer: string
  status: BillboardStatus
  /** Why a moderator refused it, shown to the seller. */
  rejectionReason: string
  /** The seller's own switch, separate from approval: an approved ad they are
   *  not running today. Pausing does not need re-approval; editing does. */
  paused: boolean
  createdAt: Date | null
}

export const PITCH_LIMIT = 90
export const OFFER_LIMIT = 24

/**
 * How long one advert holds the slot before the next takes over.
 *
 * Not per page load, which would flicker a different shop into the same space
 * every time somebody navigated back, and not per day, which would hand one
 * venture every visitor between Monday and Tuesday. Twenty minutes is long
 * enough to be seen and short enough that a lunchtime's traffic is shared out.
 */
export const ROTATE_MS = 20 * 60 * 1000

/**
 * Whose turn it is, out of the approved and unpaused ads.
 *
 * DETERMINISTIC AND FAIR, which is the whole job. Everybody viewing the site
 * in the same twenty minutes sees the same advert, and the sequence walks
 * every ad in turn rather than picking at random — random means a venture can
 * be skipped for an afternoon by luck alone, and there is no way to explain
 * that to the person who submitted it.
 *
 * Sorted by id so the running order does not depend on what Firestore happened
 * to return first. Pure, so billboard.test.ts can hold it to all of the above.
 */
export function pickBillboard(ads: Billboard[], at: Date = new Date()): Billboard | null {
  const running = ads
    .filter((ad) => ad.status === 'live' && !ad.paused)
    .sort((a, b) => a.id.localeCompare(b.id))
  if (running.length === 0) return null
  const turn = Math.floor(at.getTime() / ROTATE_MS) % running.length
  return running[turn]
}

