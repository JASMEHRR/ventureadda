import { displayUrl } from '../../lib/cloudinary'
import type { StoredImage } from '../../data/types'

/**
 * A venture's own mark, wherever its name appears.
 *
 * Same idea as Avatar — initials on a tinted tile when there is no image —
 * but square rather than round, which is what keeps a business apart from a
 * person at a glance. Most ventures will never upload one, so the fallback is
 * the common path and has to look deliberate rather than broken.
 *
 * IT USED TO BE ONE COLOUR FOR EVERYBODY: the same cyan tile with a different
 * letter on it. On a page of listings that reads as a placeholder rather than
 * a logo — nothing distinguishes one shop from the next, and a menu of items
 * with no photographs became a wall of identical squares. Each venture now
 * gets its own colour, derived from its name, so the mark is at least
 * recognisably theirs and the same shop looks the same everywhere it appears.
 */

/**
 * A stable hue from the name.
 *
 * Deterministic and offline: the same name is the same colour on every device,
 * for every visitor, forever, with nothing stored and nothing fetched. A
 * random colour would change on reload, and a stored one would be a database
 * write to solve a drawing problem.
 *
 * The multiplier is the usual djb2 constant, but djb2 alone is not enough
 * here: it moves the low bits most, and taking a remainder reads exactly
 * those, so "Glood" and "Gloob" landed two degrees apart — the same colour to
 * anybody looking. The final mix pushes the high bits down before the
 * remainder, which is what makes one different letter a different colour.
 */
function hueOf(name: string): number {
  let hash = 5381
  for (let index = 0; index < name.length; index += 1) {
    hash = Math.imul(hash, 33) ^ name.charCodeAt(index)
  }
  hash = Math.imul(hash ^ (hash >>> 15), 0x85ebca6b)
  return Math.abs(hash ^ (hash >>> 13)) % 360
}

/**
 * One letter, or two when the name has two words.
 *
 * "Hostel Bakes" reads better as HB than as H, and on a campus where half the
 * ventures start with the same letter it is the difference between a mark and
 * a coincidence.
 *
 * Words that start with punctuation are skipped rather than counted, or
 * "Thread & Needle" is marked T& — the ampersand is a joiner, not a word, and
 * the same goes for the dashes and bullets people put in their shop names.
 * What is left may be nothing at all (a name that is entirely emoji), which is
 * why the first character of the raw name is still the last resort.
 */
function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter((word) => /^[\p{L}\p{N}]/u.test(word))
  if (words.length === 0) return (name.trim().charAt(0) || '?').toUpperCase()
  if (words.length === 1) return words[0].charAt(0).toUpperCase()
  return (words[0].charAt(0) + words[1].charAt(0)).toUpperCase()
}

export default function VentureLogo({
  name,
  logo,
  size = 40,
  className = '',
}: {
  name: string
  logo?: StoredImage
  /** Rendered pixel size. The image itself is always fetched at the 400px rung,
   *  which is the smallest the transformation ladder offers and comfortably
   *  above any size a logo is drawn at here, retina included. */
  size?: number
  className?: string
}) {
  const shared = `shrink-0 rounded-xl ring-1 ring-white/10 ring-inset ${className}`

  if (logo) {
    return (
      <img
        src={displayUrl(logo, 400)}
        alt=""
        loading="lazy"
        style={{ width: size, height: size }}
        className={`object-cover ${shared}`}
      />
    )
  }

  const hue = hueOf(name)
  const initials = initialsOf(name)

  return (
    <span
      aria-hidden="true"
      style={{
        width: size,
        height: size,
        // Two stops thirty degrees apart: enough to read as a designed mark
        // rather than a flat swatch, not so much that it turns into a rainbow.
        // Saturation and lightness are fixed so every tile carries the same
        // weight on the page and white text is legible on all of them, in
        // either theme — only the hue moves.
        backgroundImage: `linear-gradient(135deg, hsl(${hue} 62% 46%), hsl(${(hue + 30) % 360} 58% 34%))`,
        // Two letters need to be proportionally smaller than one, or the mark
        // fills edge to edge at the sizes this is drawn at.
        fontSize: Math.round(size * (initials.length > 1 ? 0.34 : 0.42)),
      }}
      className={`flex items-center justify-center font-extrabold tracking-tight text-white/95 ${shared}`}
    >
      {initials}
    </span>
  )
}
