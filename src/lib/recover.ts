/**
 * Getting a page that failed to appear to appear, without asking anyone.
 *
 * TWO WAYS A PAGE DOES NOT ARRIVE, and only one of them throws. A render error
 * is loud: React tears the tree down and the error boundary catches it. The
 * other way is silent — a lazily loaded page whose chunk request never
 * resolves, usually because a deploy replaced the file the open tab is asking
 * for. Nothing throws, nothing is caught, and the spinner turns until somebody
 * gives up. That second one is the one people actually report, and it is why
 * this is a module rather than a method on the boundary.
 *
 * Both are fixed by the same thing, and it is the thing the reader would have
 * done themselves if they had not already closed the tab.
 */

/**
 * How long a reload has to hold before another one is allowed.
 *
 * THE ONLY THING STANDING BETWEEN THIS AND AN INFINITE LOOP. A page that is
 * really broken breaks again the moment it comes back, so without a brake the
 * tab reloads forever and nobody ever sees what went wrong. One automatic
 * attempt, then the message and a button.
 *
 * sessionStorage, not a variable: the reload wipes everything in memory, which
 * is precisely the thing that has to be remembered across it. Per tab, and
 * gone when the tab is, so a crash tomorrow gets its own attempt.
 */
const RELOAD_GAP_MS = 20_000
const RELOAD_KEY = 'ventureadda:crash-reload'

/** True when it reloaded; false when one just failed to stick. */
export function reloadOnce(): boolean {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0)
    if (Date.now() - last < RELOAD_GAP_MS) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch {
    // Private mode, or storage disabled. Reloading blind risks a loop, so the
    // message is the safer half of the trade.
    return false
  }
  window.location.reload()
  return true
}

/**
 * Long enough that a slow phone on campus wifi is not interrupted mid-download,
 * short enough that nobody has decided the site is dead.
 *
 * A chunk that is going to arrive has arrived well before this; one that is
 * going to 404 failed immediately. Eight seconds of a spinner is mostly a
 * hung request either way.
 */
export const STUCK_MS = 8_000
