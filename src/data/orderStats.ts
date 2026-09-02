import type { Order } from './types'

/**
 * What the orders add up to, and how much of this site's traffic is real.
 *
 * FIREBASE-FREE, like orderLines.ts and for the same reason: this is the
 * arithmetic behind numbers a moderator will make decisions on, so it has to
 * be runnable by `node` on its own. A wrong total here is not a crash, it is a
 * moderator believing the site is busier than it is.
 */

export type VentureOrders = {
  ventureId: string
  ventureName: string
  orders: number
  /** Rupees, summed from the orders' own totals. */
  revenue: number
  /** How many different accounts ordered from them. */
  buyers: number
}

/**
 * Orders grouped by the venture they were placed with, busiest first.
 *
 * Grouped on `ventureId` and labelled with `ventureName`, not the other way
 * round: the name is denormalised onto the order at creation, so a venture
 * that has since been renamed has orders carrying both spellings. Keying on
 * the name would split that venture into two rows for no reason. The most
 * recent spelling wins the label, since orders arrive in whatever order the
 * caller hands them over and the newest is the one the moderator will
 * recognise.
 *
 * Ties break on name so the list does not reshuffle between renders when two
 * ventures have the same count.
 */
export function ordersByVenture(orders: Order[]): VentureOrders[] {
  const groups = new Map<string, VentureOrders & { buyerUids: Set<string> }>()

  for (const order of orders) {
    const existing = groups.get(order.ventureId)
    if (existing) {
      existing.orders += 1
      existing.revenue += order.total
      if (order.buyerUid) existing.buyerUids.add(order.buyerUid)
      if (order.ventureName) existing.ventureName = order.ventureName
      continue
    }
    groups.set(order.ventureId, {
      ventureId: order.ventureId,
      // A venture deleted since the order was placed leaves the name behind on
      // the order, so this is usually filled. Empty means an order written
      // before names were denormalised, and the id is better than a blank row.
      ventureName: order.ventureName || order.ventureId,
      orders: 1,
      revenue: order.total,
      buyers: 0,
      buyerUids: new Set(order.buyerUid ? [order.buyerUid] : []),
    })
  }

  return [...groups.values()]
    .map(({ buyerUids, ...group }) => ({ ...group, buyers: buyerUids.size }))
    .sort((a, b) => b.orders - a.orders || a.ventureName.localeCompare(b.ventureName))
}

/** Distinct accounts that have ordered anything at all. */
export function distinctBuyers(orders: Order[]): number {
  return new Set(orders.map((order) => order.buyerUid).filter(Boolean)).size
}

/** Orders placed on or after `from`. An order with no timestamp yet is a write
 *  that landed seconds ago, so it counts as now. */
export function ordersSince(orders: Order[], from: Date): Order[] {
  return orders.filter((order) => !order.createdAt || order.createdAt >= from)
}

export type UsageLadder = {
  visits: number
  ventureOpens: number
  asks: number
  orders: number
  buyers: number
  /** Orders per hundred visits, rounded to one decimal. Null when nobody has
   *  visited, because a rate out of zero is not zero, it is unknown. */
  ordersPer100Visits: number | null
}

/**
 * The four numbers side by side, weakest evidence first.
 *
 * WHAT THIS IS FOR. "Two hundred visits" reads like two hundred people and it
 * is nothing of the sort: a visit is a browser saying it arrived, and it costs
 * nobody anything to say so. Refreshes from a cleared phone, a link preview
 * fetch, somebody's own testing, a crawler that runs JavaScript — all visits.
 * Nothing about the number can be checked.
 *
 * An order can. It needs a verified account, the rules pin it to that
 * account's uid, and it obliges a real person on the other end to make
 * something. `buyers` is harder still, being one per account rather than one
 * per order.
 *
 * So this does not try to guess which visits were fake, because it cannot: the
 * counter has no identity in it at all, by design, and inventing a heuristic
 * would only launder a guess into a number. It puts the cheap signal next to
 * the expensive one and lets the ratio say it. Two hundred visits against
 * nought orders and nought buyers is a quiet site with noisy counters; two
 * hundred against fifteen orders from eleven accounts is a real one.
 */
export function usageLadder(input: {
  visits: number
  ventureOpens: number
  asks: number
  orders: Order[]
}): UsageLadder {
  return {
    visits: input.visits,
    ventureOpens: input.ventureOpens,
    asks: input.asks,
    orders: input.orders.length,
    buyers: distinctBuyers(input.orders),
    ordersPer100Visits:
      input.visits > 0 ? Math.round((input.orders.length / input.visits) * 1000) / 10 : null,
  }
}
