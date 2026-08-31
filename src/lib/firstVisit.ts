const KEY = 'ventureadda:been-inside'

/**
 * Whether this device has been past the front door before.
 *
 * WHY THIS EXISTS. Everybody treated the landing page as the website — and the
 * reason was not only how the page read, it was that the link everybody pastes
 * is the root, so the twentieth visit opened the same explanation as the
 * first. Somebody who has used this site does not need to be told what it is
 * every time they come back; they need the shop.
 *
 * A device flag rather than an account: browsing needs no account here, and
 * the returning visitor this is for is usually signed out.
 *
 * Storage can be blocked — a private window, a locked-down browser. The
 * failure is deliberately the safe direction: unknown reads as new, so the
 * worst case is somebody seeing the front page again rather than somebody
 * being unable to find it.
 */
export function hasBeenInside(): boolean {
  try {
    return window.localStorage.getItem(KEY) !== null
  } catch {
    return false
  }
}

/** Called once the reader is actually inside the app. */
export function rememberVisit(): void {
  try {
    window.localStorage.setItem(KEY, String(Date.now()))
  } catch {
    // Then they get the front page again next time, which is a small
    // annoyance rather than a broken site.
  }
}
