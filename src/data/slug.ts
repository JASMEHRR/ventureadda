/**
 * Turning a venture's name into the thing that appears in its link.
 *
 * WHY THIS EXISTS. A venture's only name until now was its Firestore document
 * id, so the link somebody pastes into a group chat reads
 * /venture/3KHid4o2sqQ4J49cE2dV — twenty characters of noise where the name of
 * the shop should be. On a site whose entire distribution is people forwarding
 * links to each other, the link is the shopfront, and nobody clicks a
 * shopfront that looks like a tracking code.
 *
 * Pure and Firebase-free so it can be tested: this decides what a link looks
 * like forever, because a claimed slug is never released.
 */

/** Long enough for "hostel-bakes-and-more", short enough to stay a link. */
const MAX_LENGTH = 40

/**
 * The fallback when a name has nothing usable in it — an entirely non-Latin
 * name, or one made only of punctuation. Never empty: an empty slug would
 * produce /venture/ and resolve to nothing.
 */
const FALLBACK = 'venture'

export function slugify(name: string): string {
  const slug = name
    .normalize('NFD')
    // Strip the accents NFD just separated, so "Café" becomes "cafe" rather
    // than losing the e entirely to the next rule.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    // Ampersands read as a word in a link, and "thread-needle" loses the
    // meaning "Thread & Needle" carries.
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_LENGTH)
    // The slice can leave a trailing dash behind; trim once more rather than
    // shipping "hostel-bakes-".
    .replace(/-+$/, '')

  return slug || FALLBACK
}

/**
 * Collision handling, and why it is a number.
 *
 * Two ventures can genuinely be called the same thing, and a slug is never
 * released once claimed — see firestore.rules — so the second one cannot have
 * it. A number is what every site does here and is the only option that stays
 * readable: a random suffix would put us back at the tracking code this whole
 * change exists to remove.
 */
export function slugWithSuffix(slug: string, attempt: number): string {
  const suffix = `-${attempt}`
  return `${slug.slice(0, MAX_LENGTH - suffix.length).replace(/-+$/, '')}${suffix}`
}

/**
 * Whether a URL segment looks like a Firestore document id rather than a slug.
 *
 * Auto-ids are 20 characters of mixed-case letters and digits; slugs are
 * lowercase with dashes. The test is only used to decide which read to try
 * FIRST — both paths are attempted either way — so a wrong guess costs one
 * extra read and never a wrong answer.
 */
export function looksLikeDocumentId(segment: string): boolean {
  return /^[A-Za-z0-9]{20}$/.test(segment) && /[A-Z]/.test(segment)
}
