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

/**
 * The angle a share is sent at.
 *
 * PRESETS BECAUSE NOBODY WRITES THE GOOD ONE. A share button that hands over a
 * bare link gets pasted into a group under whatever the sender can be bothered
 * to type, which is usually nothing, and the message does the work of an
 * advert with none of the words. These are the three things people actually
 * mean when they send a product: look at this, hurry, and there is one left.
 * `custom` is the escape hatch, because the sender knows their group.
 */
export type SharePitch = 'plain' | 'limited' | 'lastOne' | 'custom'

/**
 * The opening line for each, in the sender's voice rather than the site's.
 *
 * Nothing here is a claim the site is making: a person chose it and a person
 * is sending it. Which is also why "Limited time" is a preset and not
 * something inferred from a stock count — see the note on data/billboard.
 */
export const SHARE_PITCH_LABEL: Record<Exclude<SharePitch, 'custom'>, string> = {
  plain: 'Just sharing it',
  limited: 'Limited time offer',
  lastOne: 'Final piece',
}

function pitchLine(pitch: SharePitch, ventureName: string): string {
  if (pitch === 'limited') return `⏳ Limited time from *${ventureName}* on VentureAdda`
  if (pitch === 'lastOne') return `🔥 Last one left at *${ventureName}* on VentureAdda`
  return `*${ventureName}* is selling this on VentureAdda`
}

/**
 * What one product looks like when it lands in a group chat.
 *
 * SINGLE ASTERISKS, NOT DOUBLE. WhatsApp's own emphasis is `*bold*`; the
 * double-asterisk form the rest of this codebase parses is Markdown's, and
 * sending it puts literal asterisks in front of forty people. This is the one
 * place that has to speak WhatsApp's dialect rather than ours.
 *
 * The link goes LAST and on its own line, so WhatsApp draws the preview card
 * under the message — the card carries the photograph, which is why no file is
 * attached here. Attaching one meant `navigator.share({files})`, and WhatsApp
 * dropped the file, kept the caption, and suppressed the preview: a message
 * with no picture at all. The link's own card is the reliable picture.
 */
export function itemShareMessage(
  item: { name: string; price?: number; description?: string },
  ventureName: string,
  url: string,
  pitch: SharePitch = 'plain',
  custom = '',
): string {
  const lead = pitch === 'custom' ? custom.trim() : pitchLine(pitch, ventureName)
  const price = typeof item.price === 'number' ? ` — ₹${item.price}` : ''
  const lines = [lead, '', `*${item.name}*${price}`]

  const blurb = item.description?.trim().replace(/\s+/g, ' ')
  if (blurb) lines.push(trimDescription(blurb, 110))

  lines.push('', url)
  // A custom message left empty leaves no lead at all, and the message must
  // not open on a blank line because of it.
  while (lines.length > 0 && lines[0].trim() === '') lines.shift()
  return lines.join('\n')
}

/**
 * The message that asks somebody to open a shop of their own.
 *
 * THE SITE'S ONE GROWTH LEVER, and it was a thing people were writing by hand.
 * Every venture on here arrived because somebody in a group chat said "you
 * should put that on VentureAdda", and the difference between that sentence
 * landing and not landing is whether it says what the site does and what it
 * costs. Both are in here, because "free" and "you keep talking on WhatsApp"
 * are the two objections.
 */
export function inviteMessage(origin: string, custom = ''): string {
  const url = `${origin.replace(/\/$/, '')}/add`
  if (custom.trim()) return `${custom.trim()}\n\n${url}`
  return [
    'Selling anything on campus? Put it on *VentureAdda*.',
    '',
    'Brownies, stickers, crochet, subscriptions, whatever you make — students find it and message you on WhatsApp, same as now. Free, and it takes two minutes.',
    '',
    url,
  ].join('\n')
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
