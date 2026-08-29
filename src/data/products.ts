// Extensions spelled out, unlike the rest of src: this module is imported by
// a plain `node --test` script with no bundler in front of it, and Node will
// not guess at './types'. tsconfig allows it and Vite does not care.
import { categoryName } from './types.ts'
import type { ItemMatch } from './ventures.ts'

/**
 * Products arranged the way a shop front arranges them.
 *
 * Pure functions, separate from the page that draws them, because this is the
 * part with the decisions in it — what counts as a section, what leads, what
 * gets dropped — and those are worth a test that does not need a browser.
 */

/**
 * The section an item belongs to on the home page.
 *
 * The seller's own section first ("Stickers", "Storage • Security • VPN"),
 * because that is a person describing their own stock and it is always more
 * specific than the six launch categories. Their venture's category is the
 * fallback for the many items that have no section at all — better a row
 * called "Food & Snacks" than a row called "Other".
 */
export function sectionOf({ item, venture }: ItemMatch): string {
  const own = item.category?.trim()
  return own && own !== '' ? own : categoryName(venture.categoryId)
}

/**
 * Priced first, then most asked about, then by name.
 *
 * PRICED FIRST IS THE WHOLE ORDERING and it is not about tidiness: an item
 * with no price cannot be added to a cart, so a row that leads with four of
 * them is a row where nothing works. "Ask the seller" is a real answer and
 * these are kept — further down, where they read as the long tail they are.
 *
 * Enquiry counts are inflatable by anyone willing to script a tap (see the
 * menuItems rule), so this is a rough interest signal used to order a shelf,
 * never a claim about sales.
 */
export function shelfOrder(a: ItemMatch, b: ItemMatch): number {
  const priced = (match: ItemMatch) => (typeof match.item.price === 'number' ? 0 : 1)
  return (
    priced(a) - priced(b) ||
    b.item.inquiryCount - a.item.inquiryCount ||
    a.item.name.localeCompare(b.item.name)
  )
}

export type Shelf = {
  /** The section name, which is also what the "see all" search looks for. */
  name: string
  items: ItemMatch[]
}

/**
 * The home page's shelves, richest first.
 *
 * Ordered by how many priced items a section has rather than by how many items
 * it has, for the same reason `shelfOrder` puts priced ones first: a section of
 * ninety "ask the seller" subscriptions is not a better first row than a
 * section of nine things somebody can actually put in a basket.
 *
 * `minItems` drops the long tail of sections holding one or two things. They
 * are not lost — every item is on /products, and this is a shop front, not an
 * index.
 *
 * `maxPerVenture` is what keeps this a campus rather than a shop. Sections
 * belong to sellers, so the seller who bothered to organise their menu wins
 * every slot on merit: one sticker shop with six priced sections filled all
 * six rows, and a visitor scrolled a home page that was entirely one venture.
 * Two rows each, then everybody else, then back round for the rest.
 */
export function shelves(
  matches: ItemMatch[],
  { minItems = 3, maxShelves = 6, perShelf = 12, maxPerVenture = 2 }: {
    minItems?: number
    maxShelves?: number
    perShelf?: number
    maxPerVenture?: number
  } = {},
): Shelf[] {
  const groups = new Map<string, ItemMatch[]>()
  for (const match of matches) {
    const name = sectionOf(match)
    const existing = groups.get(name)
    if (existing) existing.push(match)
    else groups.set(name, [match])
  }

  const pricedCount = (items: ItemMatch[]) =>
    items.filter((match) => typeof match.item.price === 'number').length

  /** Whose section this is: the venture holding most of its items. */
  const ownerOf = (items: ItemMatch[]) => {
    const counts = new Map<string, number>()
    for (const { venture } of items) counts.set(venture.id, (counts.get(venture.id) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0]
  }

  const ranked = [...groups.entries()]
    .filter(([, items]) => items.length >= minItems)
    .sort(
      ([nameA, a], [nameB, b]) =>
        pricedCount(b) - pricedCount(a) || b.length - a.length || nameA.localeCompare(nameB),
    )

  // Two passes over the same ranking: everything within its venture's quota,
  // then the ones that were held back, so a page with only one seller on it
  // still fills up rather than showing two rows and stopping.
  const used = new Map<string, number>()
  const first: [string, ItemMatch[]][] = []
  const held: [string, ItemMatch[]][] = []
  for (const entry of ranked) {
    const owner = ownerOf(entry[1])
    const count = used.get(owner) ?? 0
    if (count < maxPerVenture) {
      used.set(owner, count + 1)
      first.push(entry)
    } else {
      held.push(entry)
    }
  }

  return [...first, ...held]
    .slice(0, maxShelves)
    .map(([name, items]) => ({ name, items: [...items].sort(shelfOrder).slice(0, perShelf) }))
}

/**
 * The one rail across the top: things that can actually be bought.
 *
 * Priced only, and one per venture before any venture gets a second, so the
 * first thing a visitor sees is the campus rather than whichever shop happened
 * to list the most items. Sasta alone has a hundred and fifty; without the
 * round-robin it would be the entire row.
 */
export function topPicks(matches: ItemMatch[], limit = 12): ItemMatch[] {
  const priced = matches.filter((match) => typeof match.item.price === 'number').sort(shelfOrder)

  const seen = new Set<string>()
  const first: ItemMatch[] = []
  const rest: ItemMatch[] = []
  for (const match of priced) {
    if (seen.has(match.venture.id)) rest.push(match)
    else {
      seen.add(match.venture.id)
      first.push(match)
    }
  }
  return [...first, ...rest].slice(0, limit)
}
