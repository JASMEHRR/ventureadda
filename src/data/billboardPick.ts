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
 * How long one advert holds the slider before the next slides in.
 *
 * Long enough to read ninety characters without hurrying, short enough that
 * somebody scrolling past the top of the page sees more than one. Fifteen
 * seconds is the seller's ask and it is a sensible one.
 */
export const SLIDE_MS = 15_000

/**
 * Every running advert, in the order the slider should show them.
 *
 * INTERLEAVED BY VENTURE, which is the whole reason this is not just a filter.
 * A venture may put up as many adverts as it likes and should not be talked
 * out of it — but sorted naively, a shop with six of them occupies six
 * consecutive slides, and anybody watching the board for a minute sees one
 * shop. Taking one from each venture in turn, then the second from each, and
 * so on, means the board reads as the campus however lopsided the submissions
 * are. Six adverts still all get shown; they are just spread out.
 *
 * Nothing pending, rejected or paused is ever included: approval is the only
 * thing between a moderator's front page and whatever anybody types, and this
 * is the function that has to honour it.
 *
 * Sorted by id throughout so the order never depends on what Firestore
 * happened to return first, and pure so billboard.test.ts can hold it to all
 * of the above.
 */
export function billboardOrder(ads: Billboard[]): Billboard[] {
  const running = ads
    .filter((ad) => ad.status === 'live' && !ad.paused)
    .sort((a, b) => a.id.localeCompare(b.id))

  // Grouped in encounter order, which is id order because of the sort above.
  const byVenture = new Map<string, Billboard[]>()
  for (const ad of running) {
    const held = byVenture.get(ad.ventureId)
    if (held) held.push(ad)
    else byVenture.set(ad.ventureId, [ad])
  }

  const queues = [...byVenture.values()]
  const deepest = Math.max(0, ...queues.map((queue) => queue.length))
  const order: Billboard[] = []
  for (let round = 0; round < deepest; round += 1) {
    for (const queue of queues) {
      if (round < queue.length) order.push(queue[round])
    }
  }
  return order
}
