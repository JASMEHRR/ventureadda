/**
 * Deciding which found photograph belongs to which item.
 *
 * Pure, and in its own file with no imports, because it runs unattended across
 * a whole menu: a bad rule here is not one wrong picture, it is forty. That
 * makes it exactly the thing to test without a browser — see
 * photoMatch.test.ts.
 */

export type FillCandidate = {
  id: string
  url: string
  thumbnail: string
  title: string
  creator: string
  license: string
  source: string
  product?: boolean
}

/**
 * Words worth matching on: the ones that carry the meaning.
 *
 * Sizes, counts and packaging words are dropped because they appear in every
 * other title on the site — "pack", "ml", "combo" matching is not a match.
 */
const NOISE = new Set([
  'the',
  'and',
  'with',
  'for',
  'pack',
  'packet',
  'combo',
  'new',
  'original',
  'classic',
  'large',
  'small',
  'medium',
  'big',
  'mini',
  'ml',
  'gm',
  'gms',
  'kg',
  'litre',
  'liter',
  'pcs',
  'piece',
  'pieces',
])

export function keywords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 4 && !NOISE.has(word) && !/^\d+$/.test(word))
}

/**
 * The candidate worth attaching without asking, or nothing.
 *
 * Product shots win over photographs of a thing in a place: for a shop
 * reselling packets, the packet is the answer and a bowl of snacks is not.
 * Within each kind, the first result that shares a word with the item's name.
 */
export function bestMatch(itemName: string, candidates: FillCandidate[]): FillCandidate | null {
  const wanted = keywords(itemName)
  if (wanted.length === 0) return null

  const shares = (candidate: FillCandidate) => {
    const has = new Set(keywords(candidate.title))
    return wanted.some((word) => has.has(word))
  }

  return (
    candidates.find((candidate) => candidate.product && shares(candidate)) ??
    candidates.find((candidate) => shares(candidate)) ??
    null
  )
}
