import type { ItemMatch } from './ventures'
import type { MenuItem } from './types'

/**
 * What is worth looking at right now, and why.
 *
 * TWO KINDS OF URGENCY, ONE STRIP. A seller marking something as a limited
 * time offer is a claim they are making; an item down to its last unit is a
 * fact already sitting in the data. Both answer the same question a buyer has
 * on arriving — is there anything here I should not wait on — so they belong
 * in one row rather than two the reader has to compare.
 *
 * ALMOST GONE IS DERIVED, NOT TICKED, and that is the important half. The
 * seller already typed `stock: 1`; asking them to also tick "nearly out" is
 * asking them to maintain the same fact in two places, and the second one goes
 * stale the moment they sell one. Anything the data already knows, the data
 * says.
 *
 * Firebase-free so it can be run by `node` on its own: this decides what the
 * front page shouts about, and a wrong answer here is a shop being promoted
 * for stock it does not have.
 */

/**
 * At or below this many units, an item counts as almost gone.
 *
 * Three rather than one, because "2 left" is the point at which somebody
 * deciding over lunch might lose it, and one is already too late to be useful
 * to anyone but the person holding their phone. Above three it is just a
 * number on a listing.
 */
export const LOW_STOCK = 3

export type SpotlightReason =
  | { kind: 'limitedTime' }
  | { kind: 'almostGone'; left: number }

/**
 * Why this item is in the spotlight, or null when it is not.
 *
 * LIMITED TIME WINS when an item is both, because it is the seller's own claim
 * about the offer and outranks a stock count that says the same thing more
 * quietly. Nothing sold out is ever returned: an item nobody can buy is the
 * opposite of something to feature, and `inStock` is checked before `stock`
 * because a seller who has flipped the sold-out switch has overruled whatever
 * number is still sitting in the field.
 */
export function spotlightReason(item: MenuItem): SpotlightReason | null {
  if (!item.inStock) return null
  if (item.limitedTime) return { kind: 'limitedTime' }
  // Zero is not "almost gone", it is gone — and it reaches here whenever a
  // seller counted down to nothing without touching the sold-out switch.
  if (typeof item.stock === 'number' && item.stock > 0 && item.stock <= LOW_STOCK) {
    return { kind: 'almostGone', left: item.stock }
  }
  return null
}

/** The badge a tile wears, in the words a buyer reads. */
export function spotlightLabel(reason: SpotlightReason): string {
  if (reason.kind === 'limitedTime') return 'Limited time'
  return reason.left === 1 ? 'Last one' : `Only ${reason.left} left`
}

/**
 * The spotlight for one venture's own menu, in the order it should be read.
 *
 * Limited time offers first, then the scarcest, then by name so the row does
 * not reshuffle between renders when two items are equally scarce.
 */
export function spotlightOf(items: MenuItem[]): MenuItem[] {
  return items
    .filter((item) => spotlightReason(item) !== null)
    .sort((a, b) => {
      const rank = (item: MenuItem) => (item.limitedTime ? 0 : 1)
      return (
        rank(a) - rank(b) ||
        (a.stock ?? Infinity) - (b.stock ?? Infinity) ||
        a.name.localeCompare(b.name)
      )
    })
}

/**
 * The spotlight across every venture, for the site-wide strip.
 *
 * ONE PER VENTURE BEFORE ANY VENTURE GETS A SECOND, the same round-robin
 * topPicks uses and for the same reason: one shop marking forty things as
 * limited time would otherwise be the entire row, and a strip that is all one
 * seller stops reading as the campus and starts reading as an advert.
 */
export function spotlightAcross(matches: ItemMatch[], limit = 12): ItemMatch[] {
  const eligible = matches
    .filter((match) => spotlightReason(match.item) !== null)
    .sort((a, b) => {
      const rank = ({ item }: ItemMatch) => (item.limitedTime ? 0 : 1)
      return (
        rank(a) - rank(b) ||
        (a.item.stock ?? Infinity) - (b.item.stock ?? Infinity) ||
        a.item.name.localeCompare(b.item.name)
      )
    })

  const seen = new Set<string>()
  const first: ItemMatch[] = []
  const rest: ItemMatch[] = []
  for (const match of eligible) {
    if (seen.has(match.venture.id)) rest.push(match)
    else {
      seen.add(match.venture.id)
      first.push(match)
    }
  }
  return [...first, ...rest].slice(0, limit)
}
