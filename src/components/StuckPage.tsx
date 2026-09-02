import { useEffect } from 'react'
import LoadingLine from './ui/LoadingLine'
import { reloadOnce, STUCK_MS } from '../lib/recover'

/**
 * The loading line, plus a watchdog on the page that is supposed to replace it.
 *
 * WHAT THE ERROR BOUNDARY CANNOT SEE. Every page below the shell is loaded on
 * demand, and when a deploy goes out, an open tab keeps asking for chunk files
 * that no longer exist. Sometimes that request fails and React throws, which
 * the boundary catches. Sometimes it simply never resolves — a hung fetch on
 * campus wifi, a service worker holding a stale response — and then nothing
 * throws at all. Suspense keeps waiting, this line keeps sitting there, and
 * the person watching it concludes the site is broken. It is the same fault as
 * a crash and it has the same fix, but no error ever arrives to trigger one.
 *
 * So it is timed instead. If this fallback is still mounted after STUCK_MS,
 * the page it was standing in for was never coming, and the tab reloads —
 * once, under the same brake a crash reload uses, so a page that genuinely
 * takes a long time cannot put the tab in a loop.
 *
 * The timer is cleared on unmount, which is what happens the instant the real
 * page renders. A page that arrives normally never reaches the reload.
 */
export default function StuckPage({ label = 'Loading…' }: { label?: string }) {
  useEffect(() => {
    const timer = window.setTimeout(reloadOnce, STUCK_MS)
    return () => window.clearTimeout(timer)
  }, [])

  return <LoadingLine label={label} />
}
