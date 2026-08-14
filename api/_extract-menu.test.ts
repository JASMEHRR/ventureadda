/**
 * Self-check for the response parser, which is the one piece of this endpoint
 * with real branching and the one whose failure is silent — a price parsed
 * wrong does not throw, it just shows up in the form and somebody submits it.
 *
 * Run with: node api/extract-menu.test.ts   (Node strips the types itself)
 */
import assert from 'node:assert/strict'
import { parseItems } from './extract-menu.ts'

const clean = parseItems('[{"name":"Brownie","price":280,"description":"Six pieces"}]')
assert.deepEqual(clean, [{ name: 'Brownie', price: 280, description: 'Six pieces' }])

// Models wrap JSON in fences and chat before it constantly.
const fenced = parseItems('Here is the menu:\n```json\n[{"name":"Cake","price":450,"description":""}]\n```')
assert.deepEqual(fenced, [{ name: 'Cake', price: 450, description: '' }])

// Price arriving as a string is the most common shape drift.
assert.deepEqual(parseItems('[{"name":"Tea","price":"20","description":""}]'), [
  { name: 'Tea', price: 20, description: '' },
])

// Rounded, because Firestore holds whole rupees and the UI has no paise.
assert.equal(parseItems('[{"name":"X","price":99.6,"description":""}]')?.[0].price, 100)

// Rows that cannot be trusted are dropped, not defaulted. A guessed price is
// the failure this whole feature has to avoid.
assert.deepEqual(parseItems('[{"name":"No price","description":""}]'), [])
assert.deepEqual(parseItems('[{"name":"","price":10,"description":""}]'), [])
assert.deepEqual(parseItems('[{"name":"Negative","price":-5,"description":""}]'), [])
assert.deepEqual(parseItems('[{"name":"NaN","price":"free","description":""}]'), [])

// An empty array is a real answer — "I read it, there was nothing" — and is
// distinct from "I could not parse this at all".
assert.deepEqual(parseItems('[]'), [])
assert.equal(parseItems('I could not read this image.'), null)
assert.equal(parseItems('{"name":"not an array"}'), null)
assert.equal(parseItems('[{"name": broken json'), null)

// Runaway output is capped rather than passed through to the form.
const many = JSON.stringify(
  Array.from({ length: 80 }, (_, i) => ({ name: `Item ${i}`, price: i + 1, description: '' })),
)
assert.equal(parseItems(many)?.length, 60)

// Long strings are truncated, so one bad read cannot post a wall of text.
const long = JSON.stringify([{ name: 'x'.repeat(400), price: 1, description: 'y'.repeat(900) }])
const truncated = parseItems(long)?.[0]
assert.equal(truncated?.name.length, 120)
assert.equal(truncated?.description.length, 300)

console.log('extract-menu parser: all checks passed')
