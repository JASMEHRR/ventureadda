/**
 * Self-check for the automatic photo matcher.
 *
 * This one runs unattended across a whole menu, so a bad rule is not one wrong
 * picture — it is forty. The failure worth catching is the plausible match: a
 * photograph that shares a word with the item and is of something else.
 *
 * Run with: node --experimental-strip-types src/lib/photoMatch.test.ts
 */
import assert from 'node:assert/strict'
import { bestMatch, keywords } from './photoMatch.ts'
import type { FillCandidate } from './photoMatch.ts'

let id = 0
const candidate = (title: string, product = false): FillCandidate => ({
  id: String((id += 1)),
  url: 'u',
  thumbnail: 't',
  title,
  creator: 'c',
  license: 'CC BY-SA 3.0',
  source: 's',
  product,
})

// --- which words are worth matching on ---------------------------------------
assert.deepEqual(keywords('Kurkure Masala Munch 90g'), ['kurkure', 'masala', 'munch'])
// Packaging and size words are in every second title, so they are not evidence.
assert.deepEqual(keywords('Combo pack 500 ml'), [])
// Short words go too: "ice" matching "ice age" is not a match.
assert.deepEqual(keywords('Ice tea'), [])

// --- the packet beats the scene ----------------------------------------------
{
  const found = bestMatch('Kurkure Masala Munch', [
    candidate('Bowl of assorted kurkure snacks'),
    candidate('Kurkure Masala Munch', true),
  ])
  assert.equal(found?.title, 'Kurkure Masala Munch')
  assert.equal(found?.product, true)
}

// --- nothing shares a word, so nothing is attached ---------------------------
{
  const found = bestMatch('Beanie', [candidate('Assorted vegetables'), candidate('A cat')])
  assert.equal(found, null)
}

// --- an item with no usable words is left alone ------------------------------
assert.equal(bestMatch('X1', [candidate('Anything at all')]), null)
assert.equal(bestMatch('500 ml', [candidate('Bottle of water')]), null)

// --- a product shot still has to be about the right thing --------------------
{
  // The first result is a product photograph of something else entirely, which
  // is what an unfiltered "take the top hit" would have attached.
  const found = bestMatch('Dairy Milk', [
    candidate('Lays Classic Salted', true),
    candidate('Cadbury Dairy Milk chocolate bar', true),
  ])
  assert.equal(found?.title, 'Cadbury Dairy Milk chocolate bar')
}

// --- a photo library result is accepted when it matches ----------------------
{
  const found = bestMatch('Chocolate brownie', [candidate('Chocolate brownie on a plate')])
  assert.equal(found?.title, 'Chocolate brownie on a plate')
}

console.log('photoMatch: ok')
