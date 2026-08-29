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

// --- sections in a pasted list ----------------------------------------------
//
// A menu copied off an Instagram bio or a WhatsApp broadcast keeps the shape it
// had there, headings included. Those used to become items — "Anime", priced at
// nothing — which the seller then had to hunt down and delete, throwing away
// the grouping they had already done.

assert.deepEqual(
  parseMenuList(
    ['Anime', 'Naruto sticker, 20', 'Gojo sticker, 25', 'Custom orders:', 'Name sticker'].join(
      '\n',
    ),
  ),
  [
    { name: 'Naruto sticker', price: '20', description: '', category: 'Anime' },
    { name: 'Gojo sticker', price: '25', description: '', category: 'Anime' },
    // A colon says "heading" outright, so this one needs no priced line under
    // it — and the item beneath keeps its empty price, which now means "ask".
    { name: 'Name sticker', price: '', description: '', category: 'Custom orders' },
  ],
)

// A bare name with nothing that reads like an item after it is an item, not a
// section with nothing in it. Losing an item is the worse of the two mistakes.
assert.deepEqual(parseMenuList('Chai'), [{ name: 'Chai', price: '', description: '' }])
assert.deepEqual(
  parseMenuList(['Chai', 'Coffee', 'Samosa'].join('\n')).map((row) => row.name),
  ['Chai', 'Coffee', 'Samosa'],
)

// Anything with a digit, a separator or too many words stays an item.
assert.deepEqual(
  parseMenuList(
    ['Brownie 2 pack', 'Chocolate fudge cake with hazelnut praline', 'Cake, 450'].join('\n'),
  ).map((row) => [row.name, row.category ?? null]),
  [
    ['Brownie 2 pack', null],
    ['Chocolate fudge cake with hazelnut praline', null],
    ['Cake', null],
  ],
)

// --- a WhatsApp broadcast, which is what people actually paste ---------------
//
// Bulleted items under decorated headings, no prices, commas inside names.
// Every one of those used to go wrong: the glyphs ended up in the item names,
// the headings became items, and "(4,000 Credits/Month)" split at its own
// comma into an item called "Manus Pro (4" priced at ₹0.

{
  const rows = parseMenuList(
    [
      '🤖 AI & Developer Tools',
      '➤ Cursor Pro (1 Year)',
      '➤ Manus Pro (4,000 Credits/Month)',
      '💻 Developer & Cloud',
      '➤ Scalingo $2,400 Credits (12 Months)',
      '➤ GitLab Ultimate',
    ].join('\n'),
  )

  assert.deepEqual(
    rows.map((row) => [row.category ?? null, row.name, row.price]),
    [
      ['AI & Developer Tools', 'Cursor Pro (1 Year)', ''],
      // The comma belongs to the name, not to a price.
      ['AI & Developer Tools', 'Manus Pro (4,000 Credits/Month)', ''],
      // Same break, outside the brackets this time.
      ['Developer & Cloud', 'Scalingo $2,400 Credits (12 Months)', ''],
      ['Developer & Cloud', 'GitLab Ultimate', ''],
    ],
  )
}

// A digit inside a word is not a price: F1 is a section on this campus.
assert.deepEqual(
  parseMenuList(['F1', 'Ferrari sticker, 30'].join('\n')),
  [{ name: 'Ferrari sticker', price: '30', description: '', category: 'F1' }],
)

// --- the format the copyable AI prompt asks for -----------------------------
//
// MenuImport hands sellers a prompt for their own assistant: colon headings,
// one item per line, price after a comma, no price where there is none. That
// output has to parse perfectly or the feature meant to make importing
// reliable is the one that breaks it — and it did. An item with no price
// sitting directly above a priced one was promoted to a heading, so the item
// vanished and everything after it was filed underneath it.

{
  const rows = parseMenuList(
    [
      'Top selling:',
      'Cursor Pro 1 Year',
      'AI and developer tools:',
      'Cursor Pro (1 Year)',
      'Gemini AI Pro + 2TB (18 Months), 1200',
    ].join('\n'),
  )

  assert.deepEqual(
    rows.map((row) => [row.category ?? null, row.name, row.price]),
    [
      ['Top selling', 'Cursor Pro 1 Year', ''],
      // Kept as an item, not turned into a section for the line below it.
      ['AI and developer tools', 'Cursor Pro (1 Year)', ''],
      ['AI and developer tools', 'Gemini AI Pro + 2TB (18 Months)', '1200'],
    ],
  )
}

// "Cursor" contains the letters r and s, which is not a currency marker. The
// guard meant to spot "Rs." was written with literal control bytes instead of
// word-boundary escapes and had never matched anything at all.
assert.equal(parseMenuList('Cursor Pro, 400')[0].price, '400')

console.log('menu paste and speech parsing: all checks passed')
