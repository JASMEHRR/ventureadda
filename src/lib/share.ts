/**
 * Sharing a venture, which on this campus means one thing: pasting it into a
 * WhatsApp group.
 *
 * The whole site exists because ventures live in group chats that scroll away
 * by evening. A share button that only copies a bare URL would put the link
 * back into that same chat with nothing around it — someone would still have
 * to type "this is Glood, they do stickers" underneath it, and half the time
 * nobody does, and the link goes past unread. So the message is written here,
 * with the name, what they sell and when they are open already in it.
 *
 * Pure and Firebase-free so it can be tested: the message is the product here,
 * and it is the one part nobody proofreads before it is sent to forty people.
 */

/** Room for the description without turning a chat message into an essay. */
const DESCRIPTION_LIMIT = 180

/**
 * Cut at a word, never mid-word, and only when there is something to cut.
 *
 * The ellipsis is the character rather than three dots: WhatsApp renders both,
 * and one character is one character against the message length.
 */
export function trimDescription(text: string, limit = DESCRIPTION_LIMIT): string {
  const clean = text.trim().replace(/\s+/g, ' ')
  if (clean.length <= limit) return clean
  const cut = clean.slice(0, limit)
  const lastSpace = cut.lastIndexOf(' ')
  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`
}

export type ShareableVenture = {
  name: string
  description: string
  hours: string
  /** What they are filed under, e.g. "Food & Snacks". Optional: a share still
   *  works without it, it just says less. */
  categoryName?: string
  /** How many items are on their menu, when the menu has been read. */
  itemCount?: number
}

/**
 * The absolute link, because a relative one is useless the moment it leaves
 * the page. Built from the running origin rather than a constant so a preview
 * deployment shares preview links and localhost shares localhost ones — a
 * hard-coded production URL would have everyone testing this send each other
 * to the live site.
 */
export function ventureUrl(ventureId: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}/venture/${ventureId}`
}

/**
 * A link that opens a venture with one item already expanded.
 *
 * WHY AN ITEM NEEDS ITS OWN LINK. Everything here is passed around in
 * WhatsApp, and until this existed the smallest thing anybody could send was a
 * whole shop — so "get me one of these" arrived as a hundred and fifty items
 * and a sentence describing one of them.
 *
 * A PATH, NOT A QUERY PARAMETER. It was `?open=` first, which opened the shop
 * with one item expanded — and expanding inside a grid takes the whole row
 * with it, leaving the neighbours as tall empty voids. The item has its own
 * page now, so the link is that page.
 *
 * (The parameter also collided: `?item=` is the shell's in-menu search, so the
 * first attempt shipped share links that filtered a menu to a document id and
 * showed an empty shop. Neither problem exists on a path.)
 */
export function itemUrl(venturePath: string, itemId: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}${venturePath}/item/${encodeURIComponent(itemId)}`
}

/** The message that carries one item into a chat: what it is, whose it is,
 *  what it costs when that is known, and the link that opens it. */
export function itemShareMessage(
  item: { name: string; price?: number },
  ventureName: string,
  url: string,
): string {
  const price = typeof item.price === 'number' ? ` — ₹${item.price}` : ''
  return `${item.name}${price} from ${ventureName} on VentureAdda:
${url}`
}

/**
 * What lands in the chat.
 *
 * The link goes LAST and on its own line. WhatsApp only previews a link when
 * it can find one, and it puts the preview card under the message — a link
 * buried mid-sentence still works but reads like a footnote, and the tap
 * target everyone actually aims at is the card.
 *
 * "on VentureAdda" is in the first line on purpose. Most people receiving this
 * have never heard of the site, and the sentence has to answer "what am I
 * being sent" before it answers "who is this".
 */
export function ventureShareMessage(
  venture: ShareableVenture,
  ventureId: string,
  origin: string,
): string {
  const name = venture.name.trim()
  const category = venture.categoryName?.trim()

  // "Glood — Art & Craft, on VentureAdda" says the three things a person
  // needs before they decide whether to tap: who, what sort of thing, and
  // where this is coming from.
  const lines = [category ? `${name} — ${category}, on VentureAdda` : `${name} on VentureAdda`, '']

  const description = trimDescription(venture.description)
  if (description) lines.push(description, '')

  const facts: string[] = []
  if (venture.hours.trim()) facts.push(`Open: ${venture.hours.trim()}`)
  if (venture.itemCount && venture.itemCount > 0) {
    facts.push(`${venture.itemCount} ${venture.itemCount === 1 ? 'item' : 'items'} on the menu`)
  }
  if (facts.length) lines.push(...facts, '')

  // The instruction, because a link with no verb next to it is a link people
  // scroll past. It also sets expectations for what happens after the tap:
  // this site hands the conversation back to WhatsApp, so nobody arrives
  // expecting a checkout.
  lines.push('Tap to see their full menu and order on WhatsApp:', ventureUrl(ventureId, origin))
  return lines.join('\n')
}

/**
 * wa.me with no number: WhatsApp opens its own contact picker, so the sender
 * chooses the group. Every other wa.me link in this app targets a specific
 * seller; this one deliberately does not, because the recipient is whoever
 * they were about to tell.
 */
export function whatsappShareLink(
  venture: ShareableVenture,
  ventureId: string,
  origin: string,
): string {
  return `https://wa.me/?text=${encodeURIComponent(ventureShareMessage(venture, ventureId, origin))}`
}
