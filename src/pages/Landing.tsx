import { Link } from 'react-router-dom'
import {
  ArrowRight,
  Clock,
  LayoutGrid,
  MessageCircle,
  Plus,
  Search,
  Store,
  Wallet,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Button from '../components/ui/Button'
import Logo from '../components/ui/Logo'
import Reveal from '../components/ui/Reveal'
import VentureCard from '../components/ui/VentureCard'
import { categoryName } from '../data/types'
import type { Venture } from '../data/types'
import { listVentures } from '../data/ventures'
import { useAsyncData } from '../hooks/useAsyncData'
import { useAuth } from '../auth/AuthProvider'

/**
 * The page a stranger opens from a WhatsApp link.
 *
 * Deliberately outside AppShell. The shell is the tool — sidebar, filters,
 * account — and none of it means anything to someone who does not yet know what
 * this site is. This page has one job: explain the thing in about fifteen
 * seconds and send them to /browse.
 *
 * Structure is Ascend's landing page, spec §4 and §6: full-bleed sections at
 * py-16 sm:py-24, px-6, content capped at max-w-4xl/5xl/6xl, and every section
 * revealing on scroll through Reveal.
 *
 * There are no testimonials, no user counts and no logos on this page, and that
 * is not an oversight. It launches into one campus where everybody knows
 * exactly how new it is, and inventing social proof in front of that audience
 * costs more credibility than it buys.
 */

const STEPS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: LayoutGrid,
    title: 'Browse by category',
    body: 'Food, fashion, art, services, tech. Or search for the thing you actually want — brownies, embroidery, phone repair.',
  },
  {
    icon: Store,
    title: 'Open a venture',
    body: 'Photos of what they make, their opening hours, and every item with a price next to it. No asking around to find out what things cost.',
  },
  {
    icon: MessageCircle,
    title: 'Tap to message',
    body: 'One tap opens WhatsApp with the question already written — which item, from which venture. They know what you want before you type anything.',
  },
]

const OWNER_POINTS: { icon: LucideIcon; title: string; body: string }[] = [
  {
    icon: Plus,
    title: 'List for free',
    body: 'No fee, no commission, no cut of anything you sell. Add your venture, add your items, and it goes live once a moderator checks it over.',
  },
  {
    icon: Search,
    title: 'Get found',
    body: 'People searching for what you make will find you months after you posted, instead of scrolling past the message where you announced it.',
  },
  {
    icon: Clock,
    title: 'Own your listing',
    body: 'Edit your prices, hours and photos whenever they change. It is your page, and it stays yours.',
  },
]

/** Shown first in the product shot, whatever else is live. */
const FEATURED_VENTURE = 'glood'

/**
 * The three ventures in the shot above the fold, real ones first.
 *
 * Glood leads, by name, because it is the venture this site is being shown
 * around for — a hand-set feature slot, not a ranking the data can express.
 * After it, the most-opened ventures, which is the closest thing to "worth
 * seeing first" that exists without asking anyone to maintain a list.
 */
function featuredVentures(live: Venture[]): Venture[] {
  const ranked = [...live].sort((a, b) => {
    const pinned = (v: Venture) => (v.name.trim().toLowerCase() === FEATURED_VENTURE ? 0 : 1)
    return pinned(a) - pinned(b) || b.clickCount - a.clickCount
  })
  return ranked.slice(0, 3)
}

/**
 * Fallback cards for the product shot, for the moment before the real ones
 * arrive and for the case where the read fails or nothing is live yet.
 *
 * Built from the same demo photographs the seed data uses, and rendered through
 * the real VentureCard. They are illustrative of the interface, not claims that
 * these ventures exist — which is why the frame around them is aria-hidden and
 * inert whenever these are what is showing, and why there are no ratings or
 * counts on them. Nothing here asserts that anybody has used the site.
 */
const PREVIEW_VENTURES: Venture[] = [
  {
    id: 'preview-1',
    ownerId: '',
    ownerUsername: '',
    name: 'Hostel Bakes',
    categoryId: 'food',
    description: 'Fresh brownies, jar desserts and celebration cakes, baked in H-block.',
    hours: '4pm – 11pm, daily',
    phone: '',
    photos: [{ url: '/seed/pastries.jpg', publicId: '' }],
    deliverySlots: [],
    menuDensity: 'default',
    status: 'live',
    clickCount: 0,
  },
  {
    id: 'preview-2',
    ownerId: '',
    ownerUsername: '',
    name: 'Thread & Needle',
    categoryId: 'fashion',
    description: 'Thrifted and upcycled pieces, plus custom embroidery on anything you own.',
    hours: '6pm – 10pm, Mon to Sat',
    phone: '',
    photos: [{ url: '/seed/rack.jpg', publicId: '' }],
    deliverySlots: [],
    menuDensity: 'default',
    status: 'live',
    clickCount: 0,
  },
  {
    id: 'preview-3',
    ownerId: '',
    ownerUsername: '',
    name: 'Clay & Bead',
    categoryId: 'art',
    description: 'Handmade earrings, charms and small gifts, made to order.',
    hours: '7pm – 11pm, weekends',
    phone: '',
    photos: [{ url: '/seed/earrings.jpg', publicId: '' }],
    deliverySlots: [],
    menuDensity: 'default',
    status: 'live',
    clickCount: 0,
  },
]

/** Section shell: full-bleed, spec rhythm, capped content. */
function Section({
  children,
  width = 'max-w-5xl',
  className = '',
}: {
  children: React.ReactNode
  width?: string
  className?: string
}) {
  return (
    <section className={`px-6 py-16 sm:py-24 ${className}`}>
      <div className={`mx-auto ${width}`}>{children}</div>
    </section>
  )
}

function Eyebrow({ children }: { children: string }) {
  return (
    <p className="font-mono text-[11.5px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
      {children}
    </p>
  )
}

export default function Landing() {
  const { status } = useAuth()

  // One public read, and the landing page is worth it: this is the only thing
  // on the page that proves the site has anything on it. A failed or empty
  // read falls back to the demo cards rather than to a hole above the fold.
  const live = useAsyncData(() => listVentures(), [])
  const showcase = featuredVentures(live.data ?? [])
  const cards = showcase.length > 0 ? showcase : PREVIEW_VENTURES

  return (
    <div className="min-h-screen">
      {/* Marketing header, not the app shell's. Three things only: who this is,
          the way in, and the way to sign in. */}
      <header className="flex items-center gap-3 px-6 py-5">
        <Link to="/">
          <Logo />
        </Link>
        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" to="/browse">
            Browse
          </Button>
          {/* Keyed on the session, not the profile: an account with no username
              yet still needs its way in, and /signin only bounces it back. */}
          {status === 'ready' ? (
            <Button variant="secondary" to="/profile">
              Your profile
            </Button>
          ) : (
            <Button variant="secondary" to="/signin">
              Sign in
            </Button>
          )}
        </div>
      </header>

      {/* Hero */}
      <Section width="max-w-5xl" className="pt-10 pb-10 sm:pt-16 sm:pb-14">
        <Reveal className="text-center">
          <Eyebrow>Thapar Institute</Eyebrow>
          <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-balance text-white sm:text-5xl">
            Every venture on campus, one adda.
          </h1>
          {/* white/70, not the white/45 used for body copy on glass. This sits
              on the bare photographic backdrop, which supplies no dark fill of
              its own. */}
          <p className="mx-auto mt-5 max-w-2xl text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
            Students at Thapar are baking, thrifting, printing, repairing and selling — and
            all of it lives in WhatsApp messages that scroll away by evening. VentureAdda puts
            every one of them in a single place you can search.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Button to="/browse">
              Browse ventures
              <ArrowRight size={13} aria-hidden="true" />
            </Button>
            <Button variant="secondary" to="/add">
              <Plus size={13} aria-hidden="true" />
              Add your venture
            </Button>
          </div>
        </Reveal>
      </Section>

      {/*
        The ventures on campus right now, Glood first.

        NO FRAME AND NO CROP ANY MORE. Spec §7 puts the product shot inside a
        .liquid-glass-highlight box clipped by the fold, which is the right
        treatment for a screenshot — a picture of the app, presented as a
        picture. These are the app: real cards, real links, two of them today.
        A glass box around two cards on a three-column grid is a box with a
        hole in it, and the crop cut the descriptions off mid-sentence on
        listings a visitor is meant to be able to read and click. Off comes the
        box; the cards sit on the backdrop like they do everywhere else.

        The column count follows the number of ventures rather than being fixed
        at three, so the row is full whatever is live — and it is capped at
        three, because a fourth would push the cards below anything a phone
        shows above the fold.

        The demo cards stay for the moment before the read resolves and for a
        read that fails or finds nothing live, and they keep the aria-hidden,
        inert treatment they have always had: in that state they are still
        illustrations of businesses that do not exist.
      */}
      <div className="px-6" aria-hidden={showcase.length === 0 ? true : undefined}>
        <div className="mx-auto max-w-3xl">
          <div className="mb-4 text-center">
            <Eyebrow>Exclusive</Eyebrow>
            <p className="mt-2 text-[15px] text-white/45">
              Live on VentureAdda right now. Tap one to see the whole menu.
            </p>
          </div>

          <div
            className={`grid gap-3 ${
              cards.length === 1 ? 'mx-auto max-w-sm grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
            } ${cards.length >= 3 ? 'lg:grid-cols-3' : ''} ${
              showcase.length === 0 ? 'pointer-events-none select-none' : ''
            }`}
          >
            {cards.map((venture, index) => (
              <VentureCard
                key={venture.id}
                venture={venture}
                categoryName={categoryName(venture.categoryId)}
                index={index}
              />
            ))}
          </div>
        </div>
      </div>

      {/* The problem */}
      <Section width="max-w-4xl">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Everything is in the group chat, and the group chat forgets.
          </h2>
          <div className="mt-6 space-y-4 text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
            <p>
              To find one brownie seller you scroll hundreds of messages, past fest
              announcements and lost-and-found and someone asking for notes. If you did not
              see the post the day it went up, you will probably never see it.
            </p>
            <p>
              It is worse for the people selling. You post once, three people reply, and the
              moment somebody else posts anything your venture is buried. Every new customer
              means announcing yourself again, and asking a group of four hundred people to
              please look at your message.
            </p>
          </div>
        </Reveal>
      </Section>

      {/* How it works */}
      <Section width="max-w-6xl">
        <Reveal className="text-center">
          <Eyebrow>How it works</Eyebrow>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Three taps from looking to asking.
          </h2>
        </Reveal>

        <ol className="mt-10 grid gap-4 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <Reveal as="li" key={step.title} delay={index * 0.08}>
              <div className="liquid-glass-panel h-full rounded-3xl p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/15 text-brand-300">
                    <step.icon size={17} aria-hidden="true" />
                  </span>
                  <span className="font-mono text-[11.5px] font-extrabold tracking-[0.22em] text-white/30 uppercase">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-[18px] font-extrabold text-white">{step.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-white/55">{step.body}</p>
              </div>
            </Reveal>
          ))}
        </ol>
      </Section>

      {/* For venture owners */}
      <Section width="max-w-6xl">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-center">
          <Reveal>
            <Eyebrow>For venture owners</Eyebrow>
            <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              List it once. Stay findable.
            </h2>
            <p className="mt-5 text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
              If you make or sell anything on campus, this is a permanent page for it —
              photographs, hours, prices, and a WhatsApp button that tells you which item
              someone is asking about.
            </p>
            <div className="mt-7">
              <Button to="/add">
                <Plus size={13} aria-hidden="true" />
                Add your venture
              </Button>
            </div>
          </Reveal>

          <ul className="space-y-3">
            {OWNER_POINTS.map((point, index) => (
              <Reveal as="li" key={point.title} delay={index * 0.08}>
                <div className="liquid-glass-panel flex gap-4 rounded-2xl p-5">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/45">
                    <point.icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[16px] font-extrabold text-white">{point.title}</h3>
                    <p className="mt-1 text-[15px] leading-relaxed text-white/55">
                      {point.body}
                    </p>
                  </div>
                </div>
              </Reveal>
            ))}
          </ul>
        </div>
      </Section>

      {/* Payment. Stated plainly and given its own section, because a buyer who
          works this out at the wrong moment is a buyer who thinks something has
          gone wrong. */}
      <Section width="max-w-4xl">
        <Reveal>
          <div className="liquid-glass-highlight rounded-[2rem] p-7 sm:p-10">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/45">
                <Wallet size={17} aria-hidden="true" />
              </span>
              <Eyebrow>Payment</Eyebrow>
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              VentureAdda never handles your money.
            </h2>
            {/* max-w-2xl: this is the longest prose on the page and the one
                paragraph everyone must actually finish. */}
            <div className="mt-5 max-w-2xl space-y-4 text-[16px] leading-relaxed text-white/70 sm:text-[17px]">
              <p>
                There is no cart, no checkout and no payment page. When you find something you
                want, you message the seller on WhatsApp and the two of you settle it directly
                — UPI, cash, whatever you already use.
              </p>
              <p>
                That is deliberate. It means nobody is holding your money, there are no fees
                taken out of what a seller earns, and there is no account balance to worry
                about. This site is a directory: it helps you find each other, and then gets
                out of the way.
              </p>
            </div>
          </div>
        </Reveal>
      </Section>

      {/* Close */}
      <Section width="max-w-4xl" className="pb-20 sm:pb-28">
        <Reveal className="text-center">
          <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Have a look at what is on campus.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-[16px] leading-relaxed text-white/70">
            Browsing needs no account. You only sign in to list a venture or post in chat.
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button to="/browse">
              Browse ventures
              <ArrowRight size={13} aria-hidden="true" />
            </Button>
            <Button variant="ghost" to="/chat">
              All Chat
            </Button>
          </div>
        </Reveal>
      </Section>

      <footer className="px-6 pb-10">
        <p className="text-center font-mono text-[11px] tracking-[0.22em] text-white/25 uppercase">
          VentureAdda · Thapar Institute · No payments on site
        </p>
      </footer>
    </div>
  )
}
