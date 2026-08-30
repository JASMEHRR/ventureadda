/**
 * How long ago a listing was last touched, in words.
 *
 * Pure, and in its own file rather than inside the page, because the rounding
 * is the kind of thing that goes wrong quietly: an off-by-one in the week
 * boundary tells a seller their shop was updated "1 weeks ago" and nobody
 * notices until a screenshot lands in the group chat.
 */

/**
 * How long a listing may sit untouched before it is worth asking about.
 *
 * Six weeks, chosen against how this site is actually used: a seller who is
 * still trading edits a price, adds an item or marks something sold out well
 * inside that. Anything shorter nags people who are simply steady, which
 * teaches them to ignore the notice — and a nudge nobody reads is worse than
 * no nudge, because it makes a listing look checked when it is not.
 */
export const STALE_DAYS = 42

/** Whole days between then and now. Negative clocks read as today. */
export function daysSince(date: Date, now: Date = new Date()): number {
  return Math.max(0, Math.floor((now.getTime() - date.getTime()) / 86_400_000))
}

/**
 * "3 days ago", "6 weeks ago" — enough precision to act on, no more.
 *
 * Nobody needs to know their shop was last edited 47 days ago; they need to
 * know it was about seven weeks, which is long enough to go and look.
 */
export function ago(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 14) return `${days} days ago`
  if (days < 60) {
    const weeks = Math.round(days / 7)
    return `${weeks} ${weeks === 1 ? 'week' : 'weeks'} ago`
  }
  const months = Math.round(days / 30)
  return `${months} ${months === 1 ? 'month' : 'months'} ago`
}

export function isStale(date: Date, now: Date = new Date()): boolean {
  return daysSince(date, now) >= STALE_DAYS
}
