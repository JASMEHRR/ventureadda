/**
 * Turns pasted text and dictated speech into draft menu rows.
 *
 * Both live here, pure and separate from any component, for the same reason
 * the draft validation does: these are the parts that quietly get a price
 * wrong. A misread row does not throw — it lands in the form looking
 * deliberate, and a wrong price is worse than no price because a buyer acts on
 * it. Everything here is exercised by menuParse.test.ts.
 *
 * Neither path writes anything. Both return drafts for the owner to correct in
 * the same fields, under the same validation, as a row typed by hand.
 */

/** Price stays a string, exactly as the draft rows hold it. */
export type ParsedRow = { name: string; price: string; description: string }

/** Currency noise a person will paste or say without thinking about it. */
const PRICE_NOISE = /[₹$]|\brs\.?\b|\brupees?\b|\/-|,/gi

/**
 * Digits out of a price cell.
 *
 * Returns '' rather than 0 when nothing usable is there. That distinction is
 * load-bearing: an empty price is refused at submit, while a zero would be
 * published as a real price of zero.
 */
export function normalisePrice(raw: string): string {
  const cleaned = raw.replace(PRICE_NOISE, '').trim()
  const match = cleaned.match(/\d+(?:\.\d+)?/)
  if (!match) return ''
  const value = Math.round(Number(match[0]))
  return Number.isFinite(value) && value >= 0 ? String(value) : ''
}

const HEADER_WORDS = new Set(['name', 'item', 'product', 'title'])

/**
 * Repairs a price split apart by its own thousands separator.
 *
 * "Walnut Brownie Box, Rs. 1,200, Six pieces" splits on commas into four cells,
 * not three: the price becomes "Rs. 1" and "200" is read as the description.
 * That produced an item priced at ₹1 -- silently, and plausibly enough that
 * nobody would question it.
 *
 * Only merged when the price cell ends in a digit and the next cell is nothing
 * but two or three digits. Two as well as three because Indian grouping is
 * 1,20,000 rather than 120,000, and prices here are written the Indian way.
 * A description is essentially never bare digits, which is what keeps
 * "Cake, 450, 500g serves four" intact.
 */
function mergeThousands(cells: string[], separator: string): string[] {
  if (separator !== ',' || cells.length < 3) return cells
  const merged = [...cells]
  while (merged.length >= 3 && /\d\s*$/.test(merged[1]) && /^\s*\d{2,3}\s*$/.test(merged[2])) {
    merged.splice(1, 2, `${merged[1]}${merged[2].trim()}`)
  }
  return merged
}

/**
 * Parses a pasted list, one item per line.
 *
 * Tab-separated is checked before comma, because pasting a column out of Excel
 * or Sheets produces tabs — and a description with a comma in it would
 * otherwise be split into the wrong cell. Everything after the second
 * separator stays in the description for the same reason.
 */
export function parseMenuList(text: string): ParsedRow[] {
  const rows: ParsedRow[] = []

  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue

    const separator = line.includes('\t') ? '\t' : ','
    const cells = mergeThousands(line.split(separator), separator)
    const name = (cells[0] ?? '').trim()
    if (!name) continue

    // A spreadsheet paste usually brings its header with it. Dropping it is
    // better than leaving a row called "Name" priced at "Price" for someone to
    // notice on their own.
    if (
      rows.length === 0 &&
      HEADER_WORDS.has(name.toLowerCase()) &&
      /price|cost|amount/i.test(cells[1] ?? '')
    ) {
      continue
    }

    rows.push({
      name: name.slice(0, 120),
      price: normalisePrice(cells[1] ?? ''),
      description: cells.slice(2).join(separator).trim().slice(0, 300),
    })
  }

  return rows
}

const UNITS: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
}

const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fourty: 40, fifty: 50, sixty: 60,
  seventy: 70, eighty: 80, ninety: 90,
}

/**
 * Spoken numbers to a value: "two hundred and fifty" -> 250.
 *
 * Speech recognition returns digits for some numbers and words for others, in
 * the same sentence, so both have to work. Returns null when there is no
 * number at all, which the caller treats as "no price" rather than as zero.
 */
export function wordsToNumber(text: string): number | null {
  const digits = text.replace(/,/g, '').match(/\d+/)
  if (digits) return Number(digits[0])

  let total = 0
  let current = 0
  let seen = false

  for (const word of text.toLowerCase().split(/[\s-]+/)) {
    if (word in UNITS) {
      current += UNITS[word]
      seen = true
    } else if (word in TENS) {
      current += TENS[word]
      seen = true
    } else if (word === 'hundred') {
      current = (current || 1) * 100
      seen = true
    } else if (word === 'thousand') {
      total += (current || 1) * 1000
      current = 0
      seen = true
    }
    // "and" and any other word are ignored rather than ending the number, so
    // "two hundred and fifty" reads as one value.
  }

  return seen ? total + current : null
}

/**
 * Parses dictation into rows: "chocolate cake two hundred rupees, brownie
 * eighty" -> two items.
 *
 * Items are separated by a comma, "and then", or "next". The price is taken
 * from the END of each item, because that is how people say it — the name
 * comes first and the number lands last. Taking the first number instead would
 * turn "2 kg cake three hundred" into an item called "kg cake" priced at 2.
 */
export function parseMenuSpeech(text: string): ParsedRow[] {
  const rows: ParsedRow[] = []

  for (const chunk of text.split(/,|\band then\b|\bnext item\b|\bnext\b/i)) {
    const segment = chunk.trim()
    if (!segment) continue

    // Trailing price: a run of number words or digits at the end, with the
    // currency word optional because people say both.
    const match = segment.match(
      /^(.*?)\s+((?:\d[\d,]*|(?:(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fourty|fifty|sixty|seventy|eighty|ninety|hundred|thousand|and)\s*)+))\s*(?:rupees?|rs\.?)?\s*$/i,
    )
    if (!match) {
      // No number heard. Keep the row with an empty price rather than dropping
      // it — the owner sees the name and fills the price in, which is the
      // whole point of the review step.
      rows.push({ name: segment.slice(0, 120), price: '', description: '' })
      continue
    }

    const name = match[1].replace(/\b(?:for|at|is|costs?)\b\s*$/i, '').trim()
    const value = wordsToNumber(match[2])
    if (!name) continue

    rows.push({
      name: name.slice(0, 120),
      price: value === null ? '' : String(value),
      description: '',
    })
  }

  return rows
}
