import { useEffect, useState } from 'react'
import { Wrench } from 'lucide-react'
import type { ReactNode } from 'react'
import Logo from './ui/Logo'
import { getSiteSettings, isDown } from '../data/settings'
import type { MaintenanceWindow } from '../data/settings'
import { useAuth } from '../auth/AuthProvider'

/**
 * The closed sign, and the schedule that decides when it hangs.
 *
 * WHY A WINDOW RATHER THAN A SWITCH. A switch has to be turned off again, and
 * the person who has to remember is the one who turned it on at 2am to fix a
 * bug. Every window here has an end, so the worst case is a site that came
 * back sooner than the work finished — recoverable by setting another one —
 * rather than a site nobody can reach on Monday because Saturday's fix went
 * fine and everyone went to bed.
 *
 * MODERATORS ARE LET THROUGH, which is the entire point of taking it down:
 * whoever is fixing the thing has to be able to see the thing. They get a bar
 * across the top instead, because a moderator who has forgotten the site is
 * closed will happily conclude the bug is fixed while nobody else can load the
 * page.
 *
 * THE READ IS THE ONE THE BACKDROP ALREADY MAKES. settings/site is a single
 * public document that every visitor fetches anyway; this is the same document
 * and, on any page that shows the backdrop, effectively the same read.
 *
 * IT FAILS OPEN. A read that errors, a malformed window, a clock that
 * disagrees — all of them leave the site up. The failure worth engineering
 * against is the one that takes a working site down, not the one that leaves
 * it up during maintenance nobody scheduled.
 */
export default function MaintenanceGate({ children }: { children: ReactNode }) {
  const { profile } = useAuth()
  const [maintenance, setMaintenance] = useState<MaintenanceWindow | undefined>()
  /**
   * Re-rendered on a timer so both edges land on their own.
   *
   * A minute is the resolution the picker offers, so a minute is the
   * resolution worth polling at. Without it, a window that opens while
   * somebody is reading a menu does nothing until they navigate, and — the
   * one that actually matters — a window that closes leaves everyone who
   * waited staring at the closed sign until they think to reload.
   */
  const [, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    getSiteSettings()
      .then((settings) => {
        if (!cancelled) setMaintenance(settings.maintenance)
      })
      .catch(() => {
        // Site stays up. See the note above.
      })

    const timer = window.setInterval(() => {
      setTick((value) => value + 1)
      // Re-read as well as re-check: a window can be scheduled, moved or
      // cancelled while a tab sits open, and a tab that only re-checks what it
      // fetched at boot would honour a cancelled window for hours.
      getSiteSettings()
        .then((settings) => {
          if (!cancelled) setMaintenance(settings.maintenance)
        })
        .catch(() => {})
    }, 60_000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [])

  const down = isDown(maintenance)
  if (!down) return <>{children}</>

  if (profile?.isModerator) {
    return (
      <>
        <div className="sticky top-0 z-50 bg-amber-500/90 px-4 py-2 text-center font-mono text-[13px] font-extrabold tracking-wider text-[#1a1000] uppercase">
          Site is closed for maintenance — you can see it because you are a moderator
        </div>
        {children}
      </>
    )
  }

  const back = maintenance ? new Date(maintenance.until) : null

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="liquid-glass-highlight w-full max-w-md rounded-3xl p-6 text-center sm:p-8">
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>

        <Wrench size={28} aria-hidden="true" className="mx-auto text-brand-400" />

        <h1 className="mt-4 text-[23px] font-extrabold tracking-tight text-white">
          Back shortly
        </h1>

        <p className="mt-3 text-[16px] leading-relaxed text-white/60">
          {maintenance?.note?.trim()
            ? maintenance.note
            : 'VentureAdda is closed for a short while so we can fix a few things. Nothing you have ordered is affected.'}
        </p>

        {back && (
          <p className="mt-4 font-mono text-[13px] font-bold tracking-wider text-brand-300 uppercase">
            {/* The reader's own clock, not ours. Everyone here is in one time
                zone, but a page that says "18:30" without saying whose is a
                page somebody has to work out. */}
            Back by{' '}
            {back.toLocaleString(undefined, {
              weekday: 'short',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </p>
        )}

        <p className="mt-5 text-[14px] text-white/35">
          This page comes back on its own — no need to keep reloading.
        </p>
      </div>
    </div>
  )
}
