/**
 * When the site is closed, expressed as data and one predicate.
 *
 * Firebase-free and therefore testable, which for the single branch deciding
 * whether anybody can reach the site at all is not a nicety. settings.ts holds
 * the reads and writes and re-exports both of these, so nothing else needs to
 * know they were split.
 */
/**
 * A planned window during which the site takes itself down.
 *
 * STORED AS TWO EPOCH MILLISECONDS rather than as Firestore timestamps, and
 * that is a deliberate simplification: this is compared against `Date.now()`
 * on every client on every render, and a number needs no conversion, no
 * null-checking of a `toDate()` and no library. It also means a settings
 * document written by hand in the console is still readable by the app.
 *
 * BOTH ENDS ARE REQUIRED. A window with no end is a site somebody has to
 * remember to bring back, and the person who forgets is the one who set it at
 * 2am to fix a bug. Every window closes on its own.
 */
export type MaintenanceWindow = {
  /** Epoch ms. The site goes down at this moment. */
  from: number
  /** Epoch ms. It comes back by itself at this one. */
  until: number
  /** Shown on the closed sign. Optional — there is a sensible default. */
  note?: string
}

/** Whether a window is in force right now. Absent, malformed or finished all
 *  mean the site is up, because the failure everyone regrets is the one that
 *  takes a working site down. */
export function isDown(maintenance: MaintenanceWindow | undefined, now = Date.now()): boolean {
  if (!maintenance) return false
  const { from, until } = maintenance
  if (typeof from !== 'number' || typeof until !== 'number') return false
  return now >= from && now < until
}
