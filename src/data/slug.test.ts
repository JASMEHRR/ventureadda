import assert from 'node:assert/strict'
import test from 'node:test'
import { looksLikeDocumentId, slugWithSuffix, slugify } from './slug.ts'

/**
 * A claimed slug is never released, so whatever comes out of here is the link
 * that venture has for good. Every case below is a real name shape from this
 * campus: an ampersand, an accent, punctuation, emoji, and a name long enough
 * to need cutting.
 */
test('a name becomes a link somebody would actually click', () => {
  assert.equal(slugify('Glood'), 'glood')
  assert.equal(slugify('Hostel Bakes'), 'hostel-bakes')
  // The ampersand becomes a word: "thread-needle" loses what the name meant.
  assert.equal(slugify('Thread & Needle'), 'thread-and-needle')
  assert.equal(slugify('Café 21'), 'cafe-21')
  assert.equal(slugify('  Clay & Bead!!  '), 'clay-and-bead')
  assert.equal(slugify("Ravi's Repairs"), 'ravi-s-repairs')

  // Never empty, never leading or trailing dashes, never over 40 characters.
  for (const name of ['🎂', '!!!', '', 'अर्जुन', 'A'.repeat(80), 'Long Name '.repeat(9)]) {
    const slug = slugify(name)
    assert.ok(slug.length > 0 && slug.length <= 40, `${name} -> ${slug}`)
    assert.ok(!slug.startsWith('-') && !slug.endsWith('-'), `${name} -> ${slug}`)
    assert.match(slug, /^[a-z0-9-]+$/, `${name} -> ${slug}`)
  }
  assert.equal(slugify('🎂'), 'venture', 'a name with nothing usable still gets a link')
})

test('a taken slug takes a number, and stays inside the limit', () => {
  assert.equal(slugWithSuffix('glood', 2), 'glood-2')
  // The suffix must not push it over the cap, and must not leave a double dash
  // where the cut landed on one.
  const long = slugWithSuffix('a'.repeat(40), 10)
  assert.ok(long.length <= 40, long)
  assert.ok(long.endsWith('-10'))
  assert.ok(!long.includes('--'))
})

test('document ids are told apart from slugs, for read order only', () => {
  assert.equal(looksLikeDocumentId('3KHid4o2sqQ4J49cE2dV'), true)
  assert.equal(looksLikeDocumentId('glood'), false)
  assert.equal(looksLikeDocumentId('thread-and-needle'), false)
  // Twenty lowercase characters is a plausible slug, so it is not treated as
  // an id — being wrong here costs one extra read, never a wrong page.
  assert.equal(looksLikeDocumentId('abcdefghijklmnopqrst'), false)
})
