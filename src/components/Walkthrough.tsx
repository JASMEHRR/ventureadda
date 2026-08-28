import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ArrowRight, Compass, X } from 'lucide-react'
import Button from './ui/Button'
import { useAuth } from '../auth/AuthProvider'

/**
 * A guided tour of the actual interface, pointing at the actual controls.
 *
 * THE FIRST VERSION WAS FOUR CARDS OF PROSE in the corner, and it was the
 * wrong shape: it described the site to somebody who was looking at the site,
 * which leaves them to work out for themselves which thing on screen each
 * paragraph was about. A tour that cannot point is a help page wearing a
 * costume. This one anchors each step to the control it is describing, dims
 * everything else, and moves through the interface in the order a first-time
 * visitor meets it.
 *
 * TARGETS ARE NAMED, NOT SELECTED BY CLASS. Every step names a `data-tour`
 * attribute, so restyling a button cannot silently break the tour and anyone
 * editing one of those elements can see it is spoken for.
 *
 * A MISSING TARGET IS SKIPPED, never fatal. The sidebar does not exist below
 * `md`, the sort control hides itself when there is one venture, and the
 * account tile differs signed in and out — a tour that stalled on any of that
 * would be broken for most phones. Each step waits briefly for its element and
 * moves on if it never arrives.
 *
 * REMEMBERED PER DEVICE, in localStorage. It has to work signed-out, which is
 * most first visits, and there is no profile to write to then.
 */
const SEEN_KEY = 'ventureadda:walkthrough'

type Step = {
  /** Matches a `data-tour` attribute in the markup. */
  target: string
  title: string
  body: string
  /** Go here first, when the control only exists on one page. */
  path?: string
  /**
   * Skip this step entirely when nobody is signed in.
   *
   * Not cosmetic: /my-orders and /settings bounce a signed-out visitor to
   * /signin, so a tour that walked through them dumped a first-time browser on
   * a sign-in page and then narrated the rest of the site from there. Browsing
   * needs no account, and the tour has to hold that line too.
   */
  requiresAccount?: boolean
}

const STEPS: Step[] = [
  {
    target: 'browse',
    path: '/browse',
    title: 'Browse',
    body: 'Every venture on campus, in one list.',
  },
  {
    target: 'search',
    title: 'Search',
    body: 'Finds items, not just shops. Type "brownie", get the brownie.',
  },
  {
    target: 'category',
    title: 'Filter',
    body: 'Narrow it to food, fashion, art, printing and the rest.',
  },
  {
    target: 'sort',
    title: 'Sort',
    body: 'A to Z, most opened, or best rated.',
  },
  {
    target: 'venture-card',
    title: 'A listing',
    body: 'Tap any card to open that seller and their menu.',
  },
  {
    target: 'cart',
    path: '/cart',
    title: 'Cart',
    body: 'Holds items from several sellers at once, and survives a closed tab.',
  },
  {
    target: 'chat',
    path: '/chat',
    title: 'Campus chat',
    body: 'One room for asking who sells what.',
  },
  {
    target: 'my-orders',
    path: '/my-orders',
    requiresAccount: true,
    title: 'Your orders',
    body: 'What you have ordered, and where each one stands.',
  },
  {
    target: 'add-venture',
    title: 'List your own',
    body: 'Sell something? A moderator approves it, then it is live.',
  },
  {
    target: 'theme',
    title: 'Day or night',
    body: 'Flips the whole site. Follows your phone until you say otherwise.',
  },
  {
    target: 'settings',
    path: '/settings',
    requiresAccount: true,
    title: 'Settings',
    body: 'Panel solidity, blur, notifications — this device only.',
  },
  {
    target: 'account',
    title: 'You',
    body: 'Orders, listings and sign-out live here. Browsing needs no account.',
  },
]

/** The first visible element claiming this name; nothing when it is off screen
 *  or not rendered at this width. */
function findTarget(name: string): HTMLElement | null {
  const matches = [...document.querySelectorAll<HTMLElement>(`[data-tour="${name}"]`)]
  return matches.find((element) => element.getBoundingClientRect().width > 0) ?? null
}

type Box = { top: number; left: number; width: number; height: number }

export default function Walkthrough() {
  const { status } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()

  const [mode, setMode] = useState<'asking' | 'touring' | null>(null)
  const [step, setStep] = useState(0)
  const [box, setBox] = useState<Box | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  /** Measured, not guessed — see the placement note below. */
  const [cardSize, setCardSize] = useState({ width: 340, height: 170 })

  useEffect(() => {
    let seen = true
    try {
      seen = window.localStorage.getItem(SEEN_KEY) !== null
    } catch {
      // Storage blocked. Treat as seen: a tour nobody can dismiss for good is
      // worse than no tour.
    }
    if (seen) return
    // A beat after the page has painted, so it reads as an offer rather than
    // an interruption.
    const timer = window.setTimeout(() => setMode('asking'), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  const remember = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {
      // Then it offers again next time, which is a small annoyance rather
      // than a broken page.
    }
  }

  const finish = useCallback(() => {
    remember()
    setMode(null)
    setBox(null)
  }, [])

  // The steps this visitor can actually be shown, resolved once per render so
  // the counter reads "3 of 10" rather than counting steps that get skipped.
  const steps = STEPS.filter((item) => !item.requiresAccount || status === 'ready')
  const current = mode === 'touring' ? steps[step] : null

  // Navigate first when a step lives on a particular page — the control cannot
  // be pointed at from a page that does not render it.
  useEffect(() => {
    if (current?.path && pathname !== current.path) navigate(current.path)
  }, [current, pathname, navigate])

  /**
   * Finds the step's element and measures it, retrying while the page settles.
   *
   * The retry is not defensive padding: a step that follows a navigation is
   * measured before the new route has rendered, and the sort control appears
   * only once the ventures have loaded from Firestore. Twenty tries at 100ms
   * covers both; after that the step is treated as absent and skipped, which
   * is the honest outcome on a width where that control does not exist.
   */
  useEffect(() => {
    if (!current) return
    let cancelled = false
    let tries = 0

    const measure = () => {
      if (cancelled) return
      const element = findTarget(current.target)
      if (!element) {
        tries += 1
        if (tries > 20) {
          // Skip forward, or end if this was the last one.
          if (step < steps.length - 1) setStep(step + 1)
          else finish()
          return
        }
        window.setTimeout(measure, 100)
        return
      }

      element.scrollIntoView({ block: 'center', behavior: 'auto' })

      // Measured twice: once now, so a hidden or throttled tab still gets a
      // position, and once on the next tick so the rectangle reflects where
      // the scroll actually landed. requestAnimationFrame was the obvious
      // choice for the second one and the wrong one — it does not fire at all
      // in a background tab, which left the spotlight unpositioned and the
      // card floating in the corner with nothing highlighted.
      const place = () => {
        if (cancelled) return
        const rect = element.getBoundingClientRect()
        setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
      }
      place()
      window.setTimeout(place, 50)
    }

    measure()

    // Anything that moves the page moves the hole in the dimmer with it.
    const remeasure = () => {
      const element = findTarget(current.target)
      if (!element) return
      const rect = element.getBoundingClientRect()
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height })
    }
    window.addEventListener('scroll', remeasure, true)
    window.addEventListener('resize', remeasure)

    return () => {
      cancelled = true
      window.removeEventListener('scroll', remeasure, true)
      window.removeEventListener('resize', remeasure)
    }
  }, [current, step, finish])

  if (mode === null) return null

  if (mode === 'asking') {
    return (
      <div className="fixed inset-x-3 bottom-24 z-50 mx-auto max-w-lg md:bottom-6">
        <div className="liquid-glass-highlight flex flex-wrap items-center gap-3 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <Compass size={20} aria-hidden="true" className="shrink-0 text-brand-400" />
          <p className="min-w-40 flex-1 text-[15px] leading-relaxed text-white/75">
            First time here? Let me walk you round — it takes about a minute.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setStep(0)
                setMode('touring')
              }}
            >
              Show me
            </Button>
            <Button variant="ghost" onClick={finish}>
              No thanks
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!current) return null
  const last = step === steps.length - 1

  /**
   * Where the card goes, and the rule it must never break: it cannot cover the
   * control it is pointing at.
   *
   * The first version guessed a fixed 210px height and only ever tried below
   * then above. With a step whose target sat low on a laptop, both guesses
   * were wrong and the card landed squarely on top of the highlighted button —
   * a tour pointing at something you cannot see. Now the card is measured
   * after it renders, four positions are tried in order of preference, and the
   * first one that both fits on screen and misses the target wins.
   */
  const GAP = 12
  const place = (): { top: number; left: number } => {
    if (!box) return { top: 120, left: 12 }
    const { width, height } = cardSize
    const vw = window.innerWidth
    const vh = window.innerHeight
    const clampX = (x: number) => Math.max(GAP, Math.min(x, vw - width - GAP))
    const clampY = (y: number) => Math.max(GAP, Math.min(y, vh - height - GAP))

    const candidates = [
      // Under it, aligned to its left edge — the usual answer.
      { top: box.top + box.height + GAP, left: clampX(box.left) },
      // Over it.
      { top: box.top - height - GAP, left: clampX(box.left) },
      // Beside it, for a target that is tall or sits mid-screen.
      { top: clampY(box.top), left: box.left + box.width + GAP },
      { top: clampY(box.top), left: box.left - width - GAP },
    ]

    const onScreen = (c: { top: number; left: number }) =>
      c.top >= GAP && c.left >= GAP && c.top + height <= vh - GAP && c.left + width <= vw - GAP

    const clears = (c: { top: number; left: number }) =>
      c.left + width < box.left ||
      c.left > box.left + box.width ||
      c.top + height < box.top ||
      c.top > box.top + box.height

    return (
      candidates.find((c) => onScreen(c) && clears(c)) ??
      candidates.find(onScreen) ?? { top: clampY(box.top + box.height + GAP), left: clampX(box.left) }
    )
  }

  const position = place()

  return (
    <>
      {/* The spotlight: one element, dimming the entire page through a huge
          spread shadow and leaving a lit hole exactly where the control is.
          `pointer-events-none` so it never eats a click — the page underneath
          stays usable, which matters because a tour of an interface you cannot
          touch is a slideshow. */}
      {box && (
        <div
          aria-hidden="true"
          className="pointer-events-none fixed z-40 rounded-2xl ring-2 ring-brand-400/70 transition-all duration-200"
          style={{
            top: box.top - 6,
            left: box.left - 6,
            width: box.width + 12,
            height: box.height + 12,
            boxShadow: '0 0 0 9999px rgba(2, 4, 10, 0.72)',
          }}
        />
      )}

      <div
        ref={(node) => {
          cardRef.current = node
          if (!node) return
          const rect = node.getBoundingClientRect()
          // Only on a real change, or this sets state on every render and
          // React quite rightly complains about the loop.
          if (
            Math.abs(rect.width - cardSize.width) > 1 ||
            Math.abs(rect.height - cardSize.height) > 1
          ) {
            setCardSize({ width: rect.width, height: rect.height })
          }
        }}
        role="dialog"
        aria-label={current.title}
        className="liquid-glass-highlight fixed z-50 mx-auto max-w-sm rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
        style={{ top: position.top, left: position.left }}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-mono text-[12px] font-extrabold tracking-[0.18em] text-brand-400 uppercase">
              {step + 1} of {steps.length}
            </p>
            <h2 className="mt-1.5 text-[17px] leading-tight font-extrabold text-white">
              {current.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={finish}
            aria-label="End the walkthrough"
            className="shrink-0 rounded-full p-2 text-white/40 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94]"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <p className="mt-2 text-[15px] leading-relaxed text-white/60">{current.body}</p>

        <div className="mt-4 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => setStep(Math.max(0, step - 1))} disabled={step === 0}>
            Back
          </Button>
          <Button variant="primary" onClick={() => (last ? finish() : setStep(step + 1))}>
            {last ? 'Start browsing' : 'Next'}
            {!last && <ArrowRight size={13} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </>
  )
}
