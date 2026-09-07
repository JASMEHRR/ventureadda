import assert from 'node:assert/strict'
import test from 'node:test'
import {
  inviteMessage,
  itemShareMessage,
  itemUrl,
  trimDescription,
  ventureShareMessage,
  ventureUrl,
  whatsappShareLink,
} from './share.ts'

const glood = {
  name: 'Glood',
  description: 'Custom stickers — F1, Marvel, anime, sports, music, memes, TV & movies. Message on WhatsApp to see the full sheet.',
  hours: 'Open 24/7',
  categoryName: 'Art & Craft',
  itemCount: 15,
}

/**
 * The message is the product here — it goes to a group of forty people and
 * nobody proofreads it first — so the shape is pinned rather than described.
 */
test('the shared message names the venture, says what it is, and ends with the link', () => {
  const message = ventureShareMessage(glood, 'abc123', 'https://ventureadda.vercel.app')

  assert.equal(
    message,
    [
      'Glood — Art & Craft, on VentureAdda',
      '',
      'Custom stickers — F1, Marvel, anime, sports, music, memes, TV & movies. Message on WhatsApp to see the full sheet.',
      '',
      'Open: Open 24/7',
      '15 items on the menu',
      '',
      'Tap to see their full menu and order on WhatsApp:',
      'https://ventureadda.vercel.app/venture/abc123',
    ].join('\n'),
  )

  // The link is the last line and alone on it: WhatsApp puts its preview card
  // under the message, and that card is the tap target people aim at.
  const lines = message.split('\n')
  assert.equal(lines[lines.length - 1], 'https://ventureadda.vercel.app/venture/abc123')
})

test('a venture with nothing filled in still shares something usable', () => {
  const message = ventureShareMessage({ name: 'Bare', description: '', hours: '' }, 'x1', 'https://x.dev')
  assert.equal(
    message,
    'Bare on VentureAdda\n\nTap to see their full menu and order on WhatsApp:\nhttps://x.dev/venture/x1',
  )
})

test('long descriptions are cut at a word, not mid-word', () => {
  const long = 'word '.repeat(80).trim()
  const cut = trimDescription(long)
  assert.ok(cut.length <= 181, `expected a trimmed length, got ${cut.length}`)
  assert.ok(cut.endsWith('…'), 'ends with an ellipsis')
  assert.ok(!cut.includes('wor…'), 'never cuts inside a word')

  // Short ones are left exactly alone, ellipsis included — a description that
  // fits must come out byte-identical.
  assert.equal(trimDescription('Handmade earrings.'), 'Handmade earrings.')
  // Newlines and runs of spaces collapse: a chat message is one flow.
  assert.equal(trimDescription('Two\n\nlines   here'), 'Two lines here')
})

test('the url and the whatsapp link are built for wherever the app is running', () => {
  assert.equal(ventureUrl('v1', 'http://localhost:5173'), 'http://localhost:5173/venture/v1')
  // A trailing slash on the origin must not double up.
  assert.equal(ventureUrl('v1', 'https://x.dev/'), 'https://x.dev/venture/v1')

  const link = whatsappShareLink(glood, 'abc123', 'https://x.dev')
  // No number: WhatsApp opens its own contact picker so the sender chooses.
  assert.ok(link.startsWith('https://wa.me/?text='), link)
  assert.ok(decodeURIComponent(link).includes('https://x.dev/venture/abc123'))
})

test('a single item can be sent on its own', () => {
  // A path, not a query parameter: the item has its own page, and `?item=`
  // was in any case the venture page's own in-menu search.
  assert.equal(
    itemUrl('/venture/glood', 'i1', 'https://x.dev'),
    'https://x.dev/venture/glood/item/i1',
  )
  // A trailing slash on the origin must not double up.
  assert.equal(
    itemUrl('/venture/glood', 'i1', 'https://x.dev/'),
    'https://x.dev/venture/glood/item/i1',
  )
  // Ids are not always url-safe.
  assert.ok(itemUrl('/venture/g', 'a b', 'https://x.dev').endsWith('/item/a%20b'))

  // The message itself has its own test below.
})

/**
 * The messages that actually leave the site.
 *
 * These are read by forty people in a group chat and nobody proofreads them
 * before they go, which is the whole reason the message lives in a tested
 * module rather than inside a component.
 */
test('a product carries its own pitch into a chat', () => {
  const item = { name: 'Beanie', price: 400, description: 'dual coloured, soft' }
  const url = 'https://x.dev/venture/loopberry/item/i1'

  const plain = itemShareMessage(item, 'Loopberry', url)
  // WhatsApp's own emphasis is a SINGLE asterisk. The double form this
  // codebase parses elsewhere is Markdown's, and sending it puts literal
  // asterisks in front of everybody.
  assert.ok(plain.includes('*Loopberry*'), plain)
  assert.ok(plain.includes('*Beanie* — ₹400'), plain)
  assert.ok(!plain.includes('**'), 'no markdown bold in a WhatsApp message')
  // The link goes last and on its own line, so the preview card lands under it.
  assert.ok(plain.endsWith(`\n${url}`), plain)

  // The two urgencies read differently from the plain one and from each other.
  const limited = itemShareMessage(item, 'Loopberry', url, 'limited')
  const last = itemShareMessage(item, 'Loopberry', url, 'lastOne')
  assert.ok(limited.startsWith('⏳'), limited)
  assert.ok(last.startsWith('🔥'), last)
  assert.notEqual(limited.split('\n')[0], last.split('\n')[0])

  // A custom message replaces the lead and keeps everything under it.
  const own = itemShareMessage(item, 'Loopberry', url, 'custom', 'oye ye dekh')
  assert.ok(own.startsWith('oye ye dekh'), own)
  assert.ok(own.includes('*Beanie*'), own)
  assert.ok(own.endsWith(url), own)

  // An empty custom message must not send a blank first line.
  const empty = itemShareMessage(item, 'Loopberry', url, 'custom', '   ')
  assert.ok(!empty.startsWith('\n'), JSON.stringify(empty))

  // No price is not ₹0 — the seller quotes it in conversation.
  const ask = itemShareMessage({ name: 'Custom cake' }, 'Butter', url)
  assert.ok(!ask.includes('₹'), ask)

  // A long description is cut at a word rather than sent whole.
  const wordy = itemShareMessage(
    { name: 'X', description: 'word '.repeat(60) },
    'Shop',
    url,
  )
  assert.ok(wordy.length < 400, String(wordy.length))
})

test('the invite says what the site is and what it costs', () => {
  const invite = inviteMessage('https://x.dev')
  // Both objections answered, and the link goes to the place that starts it.
  assert.ok(invite.includes('Free'), invite)
  assert.ok(invite.includes('WhatsApp'), invite)
  assert.ok(invite.endsWith('https://x.dev/add'), invite)
  // A trailing slash on the origin must not double up.
  assert.ok(inviteMessage('https://x.dev/').endsWith('https://x.dev/add'))
  // Somebody's own words keep the link without the boilerplate.
  const own = inviteMessage('https://x.dev', 'bhai apna stall daal de')
  assert.ok(own.startsWith('bhai apna stall daal de'), own)
  assert.ok(own.endsWith('https://x.dev/add'), own)
  assert.ok(!own.includes('Free'), own)
})
