import assert from 'node:assert/strict'
import test from 'node:test'
import {
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
  // `open`, not `item`: `?item=` is the venture page's in-menu search, and
  // sharing on it filtered the menu to a document id and showed an empty shop.
  assert.equal(itemUrl('/venture/glood', 'i1', 'https://x.dev'), 'https://x.dev/venture/glood?open=i1')
  // A trailing slash on the origin must not double up.
  assert.equal(itemUrl('/venture/glood', 'i1', 'https://x.dev/'), 'https://x.dev/venture/glood?open=i1')
  // Ids are not always url-safe.
  assert.ok(itemUrl('/venture/g', 'a b', 'https://x.dev').endsWith('?open=a%20b'))

  const priced = itemShareMessage({ name: 'Rose', price: 120 }, 'Loopberry', 'https://x.dev/l?open=i1')
  assert.ok(priced.includes('Rose — ₹120'), priced)
  assert.ok(priced.includes('Loopberry'), priced)
  assert.ok(priced.endsWith('https://x.dev/l?open=i1'), priced)

  // No price is not ₹0 — the seller quotes it in the conversation, so the
  // message must not invent a number.
  const unpriced = itemShareMessage({ name: 'Custom cake' }, 'Butter', 'https://x.dev/b?open=i2')
  assert.ok(!unpriced.includes('₹'), unpriced)
  assert.ok(unpriced.startsWith('Custom cake from Butter'), unpriced)
})
