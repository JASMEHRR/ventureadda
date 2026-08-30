import { uploadImage } from './cloudinary'
import { bestMatch } from './photoMatch'
import type { FillCandidate } from './photoMatch'
import type { StoredImage } from '../data/types'

/**
 * Photographs for a whole menu at once, rather than one item at a time.
 *
 * The Find button was the right idea and the wrong unit of work: the shop this
 * was built for has twenty-one items and the one next to it has a hundred and
 * forty-seven, and nobody is opening a dialog a hundred and forty-seven times.
 * A seller wants to press one thing and come back to a menu with pictures on
 * it.
 *
 * WHAT KEEPS IT HONEST is that it refuses more than it accepts. An automatic
 * match that is merely plausible is worse than a blank tile — a blank tile
 * says nothing, and a wrong photograph says something untrue about what is for
 * sale. So a candidate is only taken when its title actually shares a word
 * with the item's name; everything else is left alone for the seller to do by
 * hand. "Brownie" finding a photograph of a Kodak Brownie camera is the exact
 * failure this is written against, and the word test does not catch that one —
 * which is why the seller reviews the result before saving, and every picture
 * has its own remove button.
 */

export type FillOutcome = { key: string; image: StoredImage } | { key: string; image: null }

/**
 * Searches for one item and returns the photograph to attach, or null.
 *
 * Every failure is a null rather than a throw: this runs across a whole menu,
 * and one item whose search times out must not stop the other forty.
 */
export async function findPhotoFor(name: string): Promise<StoredImage | null> {
  const term = name.trim()
  if (term.length < 3) return null

  try {
    const response = await fetch(`/api/find-photos?q=${encodeURIComponent(term)}`)
    if (!response.ok) return null
    const payload = (await response.json()) as { results?: FillCandidate[] }
    const match = bestMatch(term, payload.results ?? [])
    if (!match) return null

    // Same path as the picker: the browser fetches the bytes, because the
    // image hosts refuse Cloudinary's fetcher but allow the page itself.
    const file = await fetch(match.url)
    if (!file.ok) return null
    const blob = await file.blob()
    const stored = await uploadImage(
      new File([blob], 'found-photo.jpg', { type: blob.type || 'image/jpeg' }),
    )
    return {
      ...stored,
      padWhite: match.product === true,
      credit: { creator: match.creator, license: match.license, source: match.source },
    }
  } catch {
    return null
  }
}
