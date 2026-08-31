import { Link, Navigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { hasBeenInside } from '../lib/firstVisit'
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
import { listProducts, listVentures } from '../data/ventures'
import { shelves, topPicks } from '../data/products'
import ProductRail from '../components/ProductRail'
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
    managerEmails: [],
    kind: '',
    brandLogos: false,
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
    managerEmails: [],
    kind: '',
    brandLogos: false,
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
    managerEmails: [],
    kind: '',
    brandLogos: false,
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
    <p className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
      {children}
    </p>
  )
}

export default function Landing({ always = false }: { always?: boolean } = {}) {
  const { status } = useAuth()

  /**
   * THE FRONT DOOR IS FOR PEOPLE WHO HAVE NOT BEEN IN.
   *
   * Read once, at mount, rather than watched: this decides which page you are
   * on, and a value that changes underneath would swap the page out while
   * somebody is reading it.
   *
   * Signed in counts as having been inside even on a new device — an account
   * here means the site has already been explained. `always` is the escape
   * hatch for /welcome, which is how anybody who wants the introduction again
   * can get it, and how this page stays testable.
   */
  /**
   * Whether the doors have scrolled away, which is when the following bar
   * earns its place. A scroll listener rather than an observer because it is
   * one number against one number, and it is passive.
   */
  const [pastHero, setPastHero] = useState(false)
  useEffect(() => {
    const onScroll = () => setPastHero(window.scrollY > 520)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const [returning] = useState(() => !always && hasBeenInside())
  if (returning || (!always && status === 'ready')) return <Navigate to="/browse" replace />

  // One public read, and the landing page is worth it: this is the only thing
  // on the page that proves the site has anything on it. A failed or empty
  // read falls back to the demo cards rather than to a hole above the fold.
  const live = useAsyncData(() => listVentures(), [])
  const showcase = featuredVentures(live.data ?? [])
  const cards = showcase.length > 0 ? showcase : PREVIEW_VENTURES

  /**
   * THE SHOP FRONT, and the second read this page makes.
   *
   * A landing page that only lists shops asks a stranger to guess which one
   * sells what they want before it has shown them a single thing for sale.
   * Every delivery app they already use opens on the goods, and this page can
   * too: the whole menu of every live venture, arranged into rails.
   *
   * THE COST IS REAL AND WORTH NAMING: this reads the menuItems collection
   * whole on every landing visit, a few hundred documents today. That is the
   * same read /products makes, and the free tier's daily budget is the ceiling
   * on it — if traffic ever makes that bite, the fix is to serve this page a
   * cached slice rather than to hide the products again.
   *
   * A failed read leaves the rails out and the rest of the page unchanged.
   * Products are the best thing on it, not the thing holding it up.
   */
  const products = useAsyncData(() => listProducts(), [])

  /**
   * What is actually for sale, on the buyer's door.
   *
   * Only once it is known — a door promising "0 things · 0 shops" for the
   * second it takes to load is worse than a door that says what it is for.
   */
  const stock =
    products.data && products.data.length > 0
      ? {
          items: products.data.length,
          shops: new Set(products.data.map((match) => match.venture.id)).size,
        }
      : null
  // Fewer, shorter rows than the data could fill. Six shelves of twelve was a
  // wall of small cards, and a home page is meant to show a few things
  // clearly and send you to /products for the rest.
  const picks = topPicks(products.data ?? [], 10)
  const rails = shelves(products.data ?? [], { maxShelves: 3, perShelf: 10 })

  return (
    <div className="min-h-screen">
      {/* Marketing header, not the app shell's. Three things only: who this is,
          the way in, and the way to sign in.

          PINNED, like the app's own bar. This page is long — problem, how it
          works, payment, the closing ask — and the two things it exists to do,
          Browse and Sign in, were only reachable from the very top. Scrolling
          back up to act on a page that just talked you into acting is the one
          thing a landing page must not ask for. Same glass, same tint and the
          same z-40 as the shell's TopBar, so the two read as one bar across
          the site rather than as two different headers. */}
      <header className="liquid-glass-panel sticky top-0 z-40 flex items-center gap-2 border-x-0 border-t-0 bg-app/40 px-4 py-4 backdrop-blur-2xl sm:gap-3 sm:px-6 sm:py-5">
        {/* Mark only below `sm`. At the current type size the wordmark is
            ~197px, which with Browse and Sign in beside it is wider than a
            375px phone — the row ran off the side of the screen. The name
            stays in the accessible tree either way. */}
        <Link to="/" className="shrink-0">
          <span className="sm:hidden">
            <Logo markOnly size={26} />
          </span>
          <span className="hidden sm:block">
            <Logo />
          </span>
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

      {/*
        TWO DOORS, AND ALMOST NOTHING ELSE ABOVE THE FOLD.

        The problem this replaces: everybody treated this page as the website.
        They arrived, read the pitch, learned what VentureAdda is, and left
        satisfied — never suspecting there was a shop behind it. That is what a
        page does when every word on it is *about* the thing and the way in is
        two quiet buttons the same size as each other.

        So the first screen is now a decision rather than a description. One
        enormous target for the people who want to buy something, a smaller one
        for the people who want to sell, and a number on each so it reads as a
        running shop rather than an idea somebody had. Everything that used to
        be here still exists — it is underneath, where an explanation belongs.
      */}
      <Section width="max-w-6xl" className="pt-8 pb-10 sm:pt-14 sm:pb-14">
        <Reveal>
          {/* TWO COLUMNS: the line on the left, the way in on the right.

              Stacked below `lg`, because side by side on a phone gives the
              headline about four words a line and turns the doors into
              slivers. The order is the same either way — you read what this is
              and then you are looking at the thing that takes you there. */}
          <div className="grid gap-9 lg:grid-cols-[1.05fr_1fr] lg:items-center lg:gap-12">
            <div>
              <Eyebrow>Thapar Institute</Eyebrow>
              {/* The hook is a question because a question is addressed to
                  somebody. "Every venture on campus, one adda" described the
                  site; this one asks the reader something they are probably
                  already feeling at 1am in a hostel. */}
              <h1 className="mt-4 text-[46px] leading-[0.94] font-extrabold tracking-tight text-white sm:text-6xl lg:text-[68px]">
                Hungry?
                <span className="mt-2 block text-balance">
                  Someone on campus is already selling it.
                </span>
              </h1>
              <p className="mt-6 max-w-lg text-[17.5px] leading-relaxed text-white/70 sm:text-[19px]">
                Brownies at midnight, stickers, crochet, subscriptions, a cold drink two floors
                down. Run by students, a walk away, no delivery fee.
              </p>
            </div>

            {/* The two doors, side by side rather than stacked — one row, one
                decision. The buyer's is the filled one: most people arriving
                here want to find something, and the shop is the half nobody
                knew was there. Weight carries that, not size, so the row stays
                a row. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Link
                to="/products"
                className="liquid-glass-highlight group flex flex-col justify-between gap-6 rounded-3xl border border-brand-500/40 bg-brand-500/15 px-6 py-6 transition duration-200 hover:bg-brand-500/25 active:scale-[0.99] sm:min-h-56"
              >
                <span className="block text-[26px] leading-tight font-extrabold tracking-tight text-white sm:text-[30px]">
                  See what&rsquo;s on sale
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className="font-mono text-[13px] leading-snug tracking-wider text-brand-200 uppercase">
                    {stock ? (
                      <>
                        {stock.items} things
                        <br />
                        {stock.shops} shops · open now
                      </>
                    ) : (
                      'Every shop on campus'
                    )}
                  </span>
                  <ArrowRight
                    size={24}
                    aria-hidden="true"
                    className="shrink-0 text-brand-300 transition-transform duration-200 group-hover:translate-x-1"
                  />
                </span>
              </Link>

              <Link
                to="/add"
                className="liquid-glass-panel group flex flex-col justify-between gap-6 rounded-3xl px-6 py-6 transition duration-200 hover:bg-white/[0.08] active:scale-[0.99] sm:min-h-56"
              >
                <span className="block text-[26px] leading-tight font-extrabold tracking-tight text-white sm:text-[30px]">
                  Sell something
                </span>
                <span className="flex items-end justify-between gap-3">
                  <span className="font-mono text-[13px] leading-snug tracking-wider text-white/60 uppercase">
                    Free
                    <br />
                    No commission
                  </span>
                  <Plus
                    size={22}
                    aria-hidden="true"
                    className="shrink-0 text-white/60 transition-colors duration-200 group-hover:text-white"
                  />
                </span>
              </Link>
            </div>
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
            <p className="mt-2 text-[16px] text-white/60">
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

      {/*
        EVERYTHING FOR SALE, laid out like the apps this campus already uses.

        One rail of things that can be bought outright, then three sections
        under it. Priced items lead every row — see data/products.ts, where
        that ordering and the reason for it live — because an item with no
        price cannot go in a basket, and a shop front whose first four cards
        all say "ask the seller" is a shop front that does nothing.

        THE CHIPS ARE GONE and so are three of the six shelves. A row of
        section names sitting directly above a stack of sections labelled with
        those same names was the same list twice, and it was the first thing on
        the page after the rail. Everything it linked to is a heading below it
        or one tap away on /products.

        Nothing here renders until the read lands. An empty campus keeps the
        page it had before, rather than showing a set of empty shelves.
      */}
      {picks.length > 0 && (
        <Section width="max-w-6xl" className="py-10 sm:py-14">
          <div className="mb-6 text-center">
            <Eyebrow>On sale now</Eyebrow>
            <p className="mt-2 text-[16px] text-white/60">
              Everything students are selling on campus, in one place. Tap to add, or open the
              shop.
            </p>
          </div>

          <div className="space-y-12">
            <ProductRail title="Ready to order" items={picks} seeAllTo="/products" />

            {rails.map((shelf) => (
              <ProductRail
                key={shelf.name}
                title={shelf.name}
                items={shelf.items}
                seeAllTo={`/products?q=${encodeURIComponent(shelf.name)}`}
              />
            ))}
          </div>

          <div className="mt-8 text-center">
            <Button variant="secondary" to="/products">
              See every product
              <ArrowRight size={13} aria-hidden="true" />
            </Button>
          </div>
        </Section>
      )}

      {/* The problem */}
      <Section width="max-w-4xl">
        <Reveal>
          <Eyebrow>The problem</Eyebrow>
          <h2 className="mt-4 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
            Everything is in the group chat, and the group chat forgets.
          </h2>
          <div className="mt-6 space-y-4 text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
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
                  <span className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-white/55 uppercase">
                    Step {index + 1}
                  </span>
                </div>
                <h3 className="mt-4 text-[19px] font-extrabold text-white">{step.title}</h3>
                <p className="mt-2 text-[16px] leading-relaxed text-white/55">{step.body}</p>
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
            <p className="mt-5 text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
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
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60">
                    <point.icon size={16} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-[17px] font-extrabold text-white">{point.title}</h3>
                    <p className="mt-1 text-[16px] leading-relaxed text-white/55">
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
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/60">
                <Wallet size={17} aria-hidden="true" />
              </span>
              <Eyebrow>Payment</Eyebrow>
            </div>
            <h2 className="mt-5 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
              VentureAdda never handles your money.
            </h2>
            {/* max-w-2xl: this is the longest prose on the page and the one
                paragraph everyone must actually finish. */}
            <div className="mt-5 max-w-2xl space-y-4 text-[17px] leading-relaxed text-white/70 sm:text-[18px]">
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
          <p className="mx-auto mt-4 max-w-xl text-[17px] leading-relaxed text-white/70">
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

      {/*
        THE WAY IN, FOLLOWING YOU DOWN.

        Everything below the doors is explanation, and somebody reading it has
        left the two targets behind at the top of a long page. This is the
        answer to "I have read enough, where is the actual thing" without a
        scroll back — and it is the second half of the fix for people thinking
        the page was the whole site.

        Only once the hero is off screen: it would otherwise sit under the
        doors repeating them.
      */}
      {pastHero && (
        <div className="fixed inset-x-3 bottom-4 z-40 mx-auto max-w-md">
          <Link
            to="/products"
            className="liquid-glass-highlight flex items-center gap-3 rounded-2xl border border-brand-500/40 bg-brand-500/20 px-5 py-3.5 shadow-[0_18px_45px_rgba(0,0,0,0.5)] backdrop-blur-2xl transition duration-200 hover:bg-brand-500/30 active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1 text-[16px] font-bold text-white">
              Open VentureAdda
            </span>
            <span className="shrink-0 font-mono text-[12.5px] tracking-wider text-brand-200 uppercase">
              {stock ? `${stock.items} things` : 'Browse'}
            </span>
            <ArrowRight size={16} aria-hidden="true" className="shrink-0 text-brand-300" />
          </Link>
        </div>
      )}

      <footer className="px-6 pb-10">
        <p className="text-center font-mono text-[12.5px] tracking-[0.22em] text-white/50 uppercase">
          VentureAdda · Thapar Institute · No payments on site
        </p>
      </footer>
    </div>
  )
}
