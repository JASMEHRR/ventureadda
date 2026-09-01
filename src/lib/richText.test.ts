/**
 * Self-check for the description formatter.
 *
 * Run with: node --experimental-strip-types src/lib/richText.test.ts
 */
import assert from 'node:assert/strict'
import { formatRuns, tidyBreaks } from './richText.ts'

// --- the case this was written for ------------------------------------------
assert.deepEqual(formatRuns('discounts of up to **50%**.'), [
  { text: 'discounts of up to ' },
  { text: '50%', bold: true },
  { text: '.' },
])

// --- italic, and both in one line -------------------------------------------
assert.deepEqual(formatRuns('*only* today'), [{ text: 'only', italic: true }, { text: ' today' }])
assert.deepEqual(formatRuns('**Now** at *half* price'), [
  { text: 'Now', bold: true },
  { text: ' at ' },
  { text: 'half', italic: true },
  { text: ' price' },
])

// --- plain text is one run, untouched ---------------------------------------
assert.deepEqual(formatRuns('Nothing special here'), [{ text: 'Nothing special here' }])

// --- an unclosed marker is somebody's asterisk, not a mistake ----------------
assert.deepEqual(formatRuns('2 * 3 = 6'), [{ text: '2 * 3 = 6' }])
assert.deepEqual(formatRuns('**not closed'), [{ text: '**not closed' }])

// --- bold wins over italic, or ** reads as two empty italics -----------------
assert.deepEqual(formatRuns('**bold**'), [{ text: 'bold', bold: true }])

// --- bold spanning a line break, which is how people type lists -------------
assert.deepEqual(formatRuns('**one\ntwo**'), [{ text: 'one\ntwo', bold: true }])

// --- breaks -----------------------------------------------------------------
assert.equal(tidyBreaks('a\n\nb'), 'a\n\nb')
assert.equal(tidyBreaks('a\n\n\n\n\nb'), 'a\n\nb')
assert.equal(tidyBreaks('  padded  '), 'padded')
assert.equal(tidyBreaks('windows\r\nlines'), 'windows\nlines')

console.log('richText: ok')
