/**
 * Self-check for the home page's shelves.
 *
 * The failure mode here is quiet and expensive: a shelf that leads with four
 * "ask the seller" items, or a row that is one shop's entire catalogue, looks
 * fine to whoever wrote it and reads as an empty shop to a visitor.
 *
 * Run with: node --experimental-strip-types --test src/data/products.test.ts
 */
import assert from 'node:assert/strict'
import { kindOf, productTree, sectionOf, shelfOrder, shelves, topPicks } from './products.ts'
import type { ItemMatch } from './ventures.ts'

let counter = 0

function match(
  name: string,
  {
    price,
    category,
    ventureId = 'v1',
    ventureName = 'Glood',
    ventureCategory = 'food',
    kind = '',
    asked = 0,
  }: {
    price?: number
    category?: string
    ventureId?: string
    ventureName?: string
    ventureCategory?: string
    kind?: string
    asked?: number
  } = {},
): ItemMatch {
  counter += 1
  return {
    item: {
      id: `i${counter}`,
      ventureId,
      name,
      price,
      category,
      inStock: true,
      inquiryCount: asked,
    },
    venture: {
      id: ventureId,
      ownerId: 'o',
      ownerUsername: 'o',
      name: ventureName,
      categoryId: ventureCategory,
      description: '',
      hours: '',
      phone: '',
      photos: [],
      deliverySlots: [],
      managerEmails: [],
      kind,
      brandLogos: false,
      menuDensity: 'default',
      status: 'live',
      clickCount: 0,
    },
  }
}

// --- which shelf an item lands on -------------------------------------------
// The seller's own section wins, because it is the more specific description.
assert.equal(sectionOf(match('Sticker', { category: 'Stickers' })), 'Stickers')
// No section falls back to the venture's category, never to "Other".
assert.equal(sectionOf(match('Brownie', { ventureCategory: 'food' })), 'Food & Snacks')
// A section of whitespace is not a section.
assert.equal(sectionOf(match('Brownie', { category: '   ' })), 'Food & Snacks')

// --- priced first, then interest, then name ---------------------------------
{
  const list = [
    match('Ask about this', { asked: 99 }),
    match('Zebra sticker', { price: 30, asked: 1 }),
    match('Apple sticker', { price: 30, asked: 5 }),
  ].sort(shelfOrder)
  assert.deepEqual(
    list.map((entry) => entry.item.name),
    ['Apple sticker', 'Zebra sticker', 'Ask about this'],
  )
}

// --- shelves ----------------------------------------------------------------
{
  const list = [
    // Nine unpriced items: the biggest section, and deliberately not the first
    // shelf, because nothing in it can be put in a basket.
    ...Array.from({ length: 9 }, (_, index) => match(`Sub ${index}`, { category: 'Software' })),
    ...Array.from({ length: 4 }, (_, index) =>
      match(`Sticker ${index}`, { price: 30, category: 'Stickers' }),
    ),
    // Two items only: below minItems, so it is not a shelf of its own.
    match('Scarf', { price: 400, category: 'Knitwear' }),
    match('Beanie', { price: 400, category: 'Knitwear' }),
  ]

  const result = shelves(list, { minItems: 3 })
  assert.deepEqual(
    result.map((shelf) => shelf.name),
    ['Stickers', 'Software'],
  )
  assert.equal(result[0].items.length, 4)

  // perShelf caps a row without dropping the section.
  assert.equal(shelves(list, { minItems: 3, perShelf: 2 })[1].items.length, 2)
  // maxShelves caps how many rows the page draws.
  assert.equal(shelves(list, { minItems: 3, maxShelves: 1 }).length, 1)
}

// --- one seller does not get the whole page ---------------------------------
{
  // Six organised, fully priced sections from one shop, and one section from
  // another. Ranked on merit the sticker shop takes every row.
  const stickers = ['Memes', 'F1', 'Music', 'Sport', 'Anime', 'TV'].flatMap((section) =>
    Array.from({ length: 3 }, (_, index) =>
      match(`${section} ${index}`, {
        price: 30,
        category: section,
        ventureId: 'glood',
        ventureName: 'Glood',
      }),
    ),
  )
  const knitwear = Array.from({ length: 3 }, (_, index) =>
    match(`Knit ${index}`, {
      price: 400,
      category: 'Knitwear',
      ventureId: 'loop',
      ventureName: 'Loopberry',
    }),
  )

  const names = shelves([...stickers, ...knitwear]).map((shelf) => shelf.name)
  assert.equal(names.length, 6)
  // Two rows for the sticker shop before anybody else's row, and the other
  // seller is on the page rather than buried under six of Glood's.
  assert.ok(names.indexOf('Knitwear') <= 2, names.join(', '))

  // With only one seller in the data, the quota must not empty the page.
  assert.equal(shelves(stickers).length, 6)
}

// --- the top rail -----------------------------------------------------------
{
  const list = [
    match('A', { price: 10, ventureId: 'sasta', ventureName: 'Sasta', asked: 9 }),
    match('B', { price: 10, ventureId: 'sasta', ventureName: 'Sasta', asked: 8 }),
    match('C', { price: 10, ventureId: 'sasta', ventureName: 'Sasta', asked: 7 }),
    match('D', { price: 10, ventureId: 'glood', ventureName: 'Glood', asked: 1 }),
    match('Free-form', { ventureId: 'loop', ventureName: 'Loopberry', asked: 99 }),
  ]

  const picks = topPicks(list)
  // One per venture before any venture gets a second, or the shop with a
  // hundred and fifty items is the entire row.
  assert.deepEqual(
    picks.slice(0, 2).map((entry) => entry.venture.id),
    ['sasta', 'glood'],
  )
  // Unpriced never reaches this rail, however popular it is.
  assert.ok(picks.every((entry) => typeof entry.item.price === 'number'))
  assert.equal(topPicks(list, 2).length, 2)
}

// --- the two-level rail -----------------------------------------------------
{
  // The seller's own word wins; the category is the fallback for the many who
  // have not set one.
  assert.equal(kindOf(match('x', { kind: 'Stickers' })), 'Stickers')
  assert.equal(kindOf(match('x', { ventureCategory: 'food' })), 'Food & Snacks')
  assert.equal(kindOf(match('x', { kind: '  ' })), 'Food & Snacks')

  const tree = productTree([
    match('F1 one', { kind: 'Stickers', category: 'F1', ventureId: 'g' }),
    match('F1 two', { kind: 'Stickers', category: 'F1', ventureId: 'g' }),
    match('Meme one', { kind: 'Stickers', category: 'Memes', ventureId: 'g' }),
    match('Cake one', { kind: 'Cakes', category: 'Cakes', ventureId: 'b' }),
  ])

  assert.deepEqual(
    tree.map((group) => [group.name, group.count]),
    [
      ['Stickers', 3],
      ['Cakes', 1],
    ],
  )
  // Sections inside the kind, biggest first.
  assert.deepEqual(
    tree[0].sections.map((section) => section.name),
    ['F1', 'Memes'],
  )
  // "Cakes > Cakes" is the same word twice, so the child is dropped.
  assert.deepEqual(tree[1].sections, [])
}

console.log('products: ok')
