/**
 * Self-check for the paste and speech parsers.
 *
 * Both fail silently by nature: a misparsed row lands in the form looking
 * deliberate, and the owner has no reason to doubt a price they did not type.
 *
 * Run with: node src/data/menuParse.test.ts   (Node strips the types itself)
 */
import assert from 'node:assert/strict'
import { normalisePrice, parseMenuList, parseMenuSpeech, wordsToNumber } from './menuParse.ts'

// --- prices -----------------------------------------------------------------
assert.equal(normalisePrice('450'), '450')
assert.equal(normalisePrice(' ₹ 450 '), '450')
assert.equal(normalisePrice('Rs. 1,200'), '1200')
assert.equal(normalisePrice('250/-'), '250')
assert.equal(normalisePrice('99.6'), '100')
// Nothing usable is an empty price, never zero. A zero would be published as a
// real price of zero; an empty one is refused at submit.
assert.equal(normalisePrice(''), '')
assert.equal(normalisePrice('free'), '')
assert.equal(normalisePrice('  '), '')

// --- pasted lists -----------------------------------------------------------
assert.deepEqual(parseMenuList('Brownie, 280, Six pieces'), [
  { name: 'Brownie', price: '280', description: 'Six pieces' },
])

// A comma inside the description must not become another cell.
assert.deepEqual(parseMenuList('Cake, 450, Dark chocolate, 500g, serves four'), [
  { name: 'Cake', price: '450', description: 'Dark chocolate, 500g, serves four' },
])

// Excel and Sheets paste as tabs, and tabs win over commas for exactly the
// reason above.
assert.deepEqual(parseMenuList('Cake\t450\tDark chocolate, 500g'), [
  { name: 'Cake', price: '450', description: 'Dark chocolate, 500g' },
])

// A thousands separator splits the line on its own comma. Caught on production
// with a real paste, not by the unit test above -- normalisePrice('Rs. 1,200')
// was correct in isolation while the LINE containing it was not, which is the
// difference between testing a unit and testing the thing the user does.
assert.deepEqual(parseMenuList('Walnut Brownie Box, Rs. 1,200, Six pieces'), [
  { name: 'Walnut Brownie Box', price: '1200', description: 'Six pieces' },
])
assert.deepEqual(parseMenuList('Big Order, 1,20,000, Wedding cake'), [
  { name: 'Big Order', price: '120000', description: 'Wedding cake' },
])
// A description that merely starts with three digits must NOT be eaten.
assert.deepEqual(parseMenuList('Cake, 450, 500g serves four'), [
  { name: 'Cake', price: '450', description: '500g serves four' },
])

// Spreadsheet pastes bring their header.
assert.deepEqual(parseMenuList('Name, Price, Description\nTea, 20, Cutting'), [
  { name: 'Tea', price: '20', description: 'Cutting' },
])
// ...but only a real header. An item that happens to be called "Item" stays.
assert.equal(parseMenuList('Item, 20, x')[0].name, 'Item')

// Blank lines, missing cells, and a nameless row.
assert.deepEqual(parseMenuList('Tea, 20\n\n\nMaggi, 60\n'), [
  { name: 'Tea', price: '20', description: '' },
  { name: 'Maggi', price: '60', description: '' },
])
assert.deepEqual(parseMenuList('Chai'), [{ name: 'Chai', price: '', description: '' }])

// A menu with no spreadsheet structure at all -- name, em dash, price -- must
// not dump the whole line into the name. Caught on a real paste from Butter &
// Bloom's hostel-room menu.
assert.deepEqual(parseMenuList('Kurkure Masala Munch — ₹23'), [
  { name: 'Kurkure Masala Munch', price: '23', description: '' },
])
assert.deepEqual(
  parseMenuList('RiteBite Max Protein Grain Cookies 55g — ₹50'),
  [{ name: 'RiteBite Max Protein Grain Cookies 55g', price: '50', description: '' }],
)
// A bare category header with no price fragment is still just a nameless row
// with no price -- not this bug, and not something this parser can tell apart
// from a genuinely priceless item.
assert.deepEqual(parseMenuList('SNACKS'), [{ name: 'SNACKS', price: '', description: '' }])
assert.deepEqual(parseMenuList(', 20, no name'), [])
assert.deepEqual(parseMenuList(''), [])

// --- spoken numbers ---------------------------------------------------------
assert.equal(wordsToNumber('two hundred'), 200)
assert.equal(wordsToNumber('two hundred and fifty'), 250)
assert.equal(wordsToNumber('eighty'), 80)
assert.equal(wordsToNumber('one thousand two hundred'), 1200)
assert.equal(wordsToNumber('fifteen'), 15)
// Recognition returns digits as often as words, sometimes in the same sentence.
assert.equal(wordsToNumber('450'), 450)
assert.equal(wordsToNumber('1,200'), 1200)
assert.equal(wordsToNumber('no number here'), null)

// --- dictation --------------------------------------------------------------
assert.deepEqual(parseMenuSpeech('chocolate cake two hundred rupees, brownie eighty'), [
  { name: 'chocolate cake', price: '200', description: '' },
  { name: 'brownie', price: '80', description: '' },
])

// The price is read from the END. Taking the first number would name this item
// "kg cake" and price it at 2.
assert.deepEqual(parseMenuSpeech('2 kg cake three hundred'), [
  { name: '2 kg cake', price: '300', description: '' },
])

// Filler people actually say.
assert.deepEqual(parseMenuSpeech('masala chai for twenty'), [
  { name: 'masala chai', price: '20', description: '' },
])
assert.deepEqual(parseMenuSpeech('samosa costs fifteen rupees'), [
  { name: 'samosa', price: '15', description: '' },
])
assert.equal(parseMenuSpeech('tea twenty and then coffee thirty').length, 2)
assert.equal(parseMenuSpeech('tea twenty next coffee thirty')[1].name, 'coffee')

// No number heard: keep the name with an empty price rather than dropping the
// item. The review step exists precisely for this.
assert.deepEqual(parseMenuSpeech('mystery box'), [
  { name: 'mystery box', price: '', description: '' },
])

assert.deepEqual(parseMenuSpeech(''), [])

console.log('menu paste and speech parsing: all checks passed')
