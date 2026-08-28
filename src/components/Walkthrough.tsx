import { useEffect, useState } from 'react'
import { ArrowRight, Compass, MessageCircle, Search, ShoppingCart, Store, X } from 'lucide-react'
import Button from './ui/Button'

/**
 * The offer of a guided tour, and the tour.
 *
 * ASKED, NEVER IMPOSED. A modal that takes over on first load is the thing
 * everybody dismisses without reading, so this is a strip at the bottom of the
 * screen with two answers, and "No thanks" is a real answer that is never
 * asked again. Somebody who arrived from a WhatsApp link wanting one brownie
 * should be able to ignore this entirely and lose nothing.
 *
 * WHY IT EXISTS AT ALL. Almost nothing on this site works the way a shopping
 * site works: there is no payment, the cart ends in a WhatsApp message, and
 * the seller is a student who may be in a lecture. Someone who assumes
 * otherwise gets to the end of a checkout expecting a payment screen. Four
 * cards are cheaper than that surprise.
 *
 * REMEMBERED PER DEVICE, in localStorage rather than on the account. It has to
 * work for a signed-out visitor — which is most first visits, since browsing
 * needs no account — and there is no profile to write to yet.
 */
const SEEN_KEY = 'ventureadda:walkthrough'

type Step = {
  icon: typeof Store
  title: string
  body: string
}

const STEPS: Step[] = [
  {
    icon: Store,
    title: 'Every venture on campus, in one place',
    body: 'Students here bake, thrift, print, repair and sell. All of it usually lives in group chats that scroll away by evening. This is the list that does not.',
  },
  {
    icon: Search,
    title: 'Search finds items, not just shops',
    body: 'Type "brownie" and you get the brownie, with the price, from whoever is selling one — not a shop you then have to dig through. The search box is at the top of every page.',
  },
  {
    icon: ShoppingCart,
    title: 'Add what you want to your cart',
    body: 'Your cart can hold items from more than one seller at once, and it survives closing the tab. Nothing is reserved and nothing is charged.',
  },
  {
    icon: MessageCircle,
    title: 'You pay the seller directly',
    body: 'No money goes through this site. Placing an order opens WhatsApp with your items written out, and you and the seller settle the rest — cash, UPI, whatever you both use.',
  },
]

export default function Walkthrough() {
  /**
   * 'asking' is the strip, 'touring' is the tour, and null is out of the way.
   *
   * Starts null rather than 'asking' so the first paint is the site itself.
   * Someone deciding whether this page is worth their time should see the page
   * before they see anything asking them a question about it.
   */
  const [mode, setMode] = useState<'asking' | 'touring' | null>(null)
  const [step, setStep] = useState(0)

  useEffect(() => {
    let seen = true
    try {
      seen = window.localStorage.getItem(SEEN_KEY) !== null
    } catch {
      // Storage blocked. Treat as seen: a tour that cannot be dismissed for
      // good is worse than no tour.
    }
    if (seen) return
    // A short delay, deliberately. The offer is not the point of the visit,
    // and arriving a beat after the page has painted is the difference between
    // an offer and an interruption.
    const timer = window.setTimeout(() => setMode('asking'), 1200)
    return () => window.clearTimeout(timer)
  }, [])

  const remember = () => {
    try {
      window.localStorage.setItem(SEEN_KEY, String(Date.now()))
    } catch {
      // Then it asks again next time, which is a small annoyance rather than
      // a broken page.
    }
  }

  const dismiss = () => {
    remember()
    setMode(null)
  }

  if (mode === null) return null

  if (mode === 'asking') {
    return (
      <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-lg md:bottom-6">
        <div className="liquid-glass-highlight flex flex-wrap items-center gap-3 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          <Compass size={20} aria-hidden="true" className="shrink-0 text-brand-400" />
          <p className="min-w-40 flex-1 text-[15px] leading-relaxed text-white/75">
            First time here? This works a bit differently to a shopping site.
          </p>
          <div className="flex shrink-0 gap-2">
            <Button variant="primary" onClick={() => setMode('touring')}>
              Show me
            </Button>
            <Button variant="ghost" onClick={dismiss}>
              No thanks
            </Button>
          </div>
        </div>
      </div>
    )
  }

  const current = STEPS[step]
  const last = step === STEPS.length - 1
  const Icon = current.icon

  return (
    /* Not the Modal component: that one traps focus and blacks out the page,
       which is right for a checkout and wrong for a tour whose whole subject
       is the page behind it. This sits over the corner and leaves the site
       visible and usable underneath. */
    <div className="fixed inset-x-3 bottom-24 z-40 mx-auto max-w-lg md:bottom-6">
      <div
        role="dialog"
        aria-label="How VentureAdda works"
        className="liquid-glass-highlight rounded-3xl p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
            <Icon size={18} aria-hidden="true" />
          </span>

          <div className="min-w-0 flex-1">
            <h2 className="text-[17px] leading-tight font-extrabold text-white">{current.title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-white/60">{current.body}</p>
          </div>

          <button
            type="button"
            onClick={dismiss}
            aria-label="Close the walkthrough"
            className="shrink-0 rounded-full p-2 text-white/40 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94]"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          {/* Position, and a way back to any card. Four dots is a small enough
              set that they are worth making tappable rather than decorative. */}
          <div className="flex items-center gap-1.5">
            {STEPS.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setStep(index)}
                aria-label={`Step ${index + 1} of ${STEPS.length}`}
                aria-current={index === step}
                className="flex items-center px-1 py-2.5"
              >
                <span
                  aria-hidden="true"
                  className={`block h-1.5 rounded-full transition-all duration-200 ${
                    index === step ? 'w-5 bg-brand-400' : 'w-1.5 bg-white/25'
                  }`}
                />
              </button>
            ))}
          </div>

          <Button variant="primary" onClick={() => (last ? dismiss() : setStep(step + 1))}>
            {last ? 'Start browsing' : 'Next'}
            {!last && <ArrowRight size={13} aria-hidden="true" />}
          </Button>
        </div>
      </div>
    </div>
  )
}
