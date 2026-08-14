import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { ReactNode } from 'react'
import {
  ClipboardCheck,
  Clock,
  Cookie,
  Flame,
  MessageCircle,
  MousePointerClick,
  Search,
  Store,
  UtensilsCrossed,
  XCircle,
} from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ListRow from '../components/ui/ListRow'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'
import StatCard from '../components/ui/StatCard'
import TextField from '../components/ui/TextField'
import Textarea from '../components/ui/Textarea'

/** The six launch categories from the plan, Part 7. */
type Category =
  | 'food'
  | 'fashion'
  | 'art'
  | 'services'
  | 'tech'
  | 'other'

const CATEGORIES: SelectOption<Category>[] = [
  { value: 'food', label: 'Food & Snacks' },
  { value: 'fashion', label: 'Fashion & Accessories' },
  { value: 'art', label: 'Art & Craft' },
  { value: 'services', label: 'Services' },
  { value: 'tech', label: 'Tech & Gadgets' },
  { value: 'other', label: 'Other' },
]

/**
 * Ascend's standard scroll reveal, spec §6.
 *
 * `initial={false}` under reduced motion is load-bearing, not a nicety: it
 * renders straight at the target values. Leaving `initial: { opacity: 0 }` in
 * place means anyone with the OS setting on gets a blank page if the animation
 * does not run — content visibility must never depend on an animation firing.
 */
function Section({ eyebrow, note, children }: { eyebrow: string; note: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <motion.section
      initial={reduce ? false : { opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="space-y-3"
    >
      <header className="px-1">
        <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          {eyebrow}
        </h2>
        <p className="mt-1 text-[12.5px] text-white/40">{note}</p>
      </header>
      {children}
    </motion.section>
  )
}

export default function DesignDemo() {
  const [category, setCategory] = useState<Category | null>(null)
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const reduce = useReducedMotion()

  return (
    // No padding or max-width here — AppShell owns the page container now.
    <div className="space-y-8">
      {/* Wordmark */}
      <motion.header
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="liquid-glass-highlight glass-shimmer rounded-[1.75rem] px-5 py-6 sm:px-7 sm:py-8"
      >
        <p className="font-mono text-[9px] font-extrabold tracking-[0.28em] text-white/40 uppercase">
          Design system · Step 0
        </p>
        {/* Deliberately not an h1 — TopBar owns the page heading now, and the
            document should only ever have one. This is a wordmark. */}
        <p className="mt-2 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          VentureAdda
        </p>
        <p className="mt-2 max-w-md text-[14px] text-white/55">
          Every venture on campus, one adda. This page exists to prove the visual system before
          any feature is built on top of it.
        </p>
      </motion.header>

      <Section
        eyebrow="Glass surfaces"
        note="Panel versus highlight. Both blur the backdrop behind them — that is what makes them read as glass rather than frosted plastic."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="liquid-glass-panel rounded-3xl p-5">
            <p className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
              liquid-glass-panel
            </p>
            <p className="mt-2 text-[14px] text-white/70">
              The default surface. 4% to 1% white gradient, 20px blur, 135% saturate, with a top
              light-catch and a bottom inner shadow.
            </p>
          </div>
          <div className="liquid-glass-highlight rounded-3xl p-5">
            <p className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
              liquid-glass-highlight
            </p>
            <p className="mt-2 text-[14px] text-white/70">
              Emphasised. Stronger fill and border, 1.2× blur, and a single top highlight with no
              bottom shadow, so it sits proud of the panel beside it.
            </p>
          </div>
        </div>
      </Section>

      <Section
        eyebrow="Inputs"
        note="Recessed rather than raised — an inset shadow and no top highlight, so a field reads as carved in. Tab to either one to see the focus ring."
      >
        <div className="liquid-glass-panel space-y-4 rounded-3xl p-5">
          <TextField
            id="demo-search"
            label="Search"
            type="search"
            icon={Search}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Brownies, prints, repairs…"
          />

          <Select
            label="Category"
            value={category}
            options={CATEGORIES}
            onChange={setCategory}
            placeholder="All categories"
          />

          <Textarea
            id="demo-note"
            label="Description"
            hint="Hint text sits here, at 35% white."
            placeholder="What you make, and how people collect it."
          />

          <TextField
            id="demo-error"
            label="Price"
            defaultValue="four hundred"
            error="Prices are whole rupees — digits only."
          />
        </div>
      </Section>

      <Section
        eyebrow="Buttons"
        note="Pill, uppercase, bold, wide-tracked. Danger and WhatsApp are additions — everything else is Ascend verbatim."
      >
        <div className="liquid-glass-panel flex flex-wrap items-center gap-2.5 rounded-3xl p-5">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Reject</Button>
          <Button variant="whatsapp">
            <MessageCircle size={13} aria-hidden="true" />
            WhatsApp
          </Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Button variant="secondary" to="/design">
            As a link
          </Button>
          <Button
            variant="primary"
            loading={loading}
            onClick={() => {
              setLoading(true)
              window.setTimeout(() => setLoading(false), 1600)
            }}
          >
            {loading ? 'Sending' : 'Tap to load'}
          </Button>
        </div>
      </Section>

      <Section
        eyebrow="Venture card"
        note="Photography pattern: 4:3, rounded-2xl, inset hairline border, sitting inside a glass card."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <article className="liquid-glass-panel rounded-3xl p-3 transition duration-150 active:scale-[0.99]">
            <img
              src="/seed/pastries.jpg"
              alt="Tray of chocolate brownies dusted with sugar"
              className="aspect-4/3 w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
            />
            <div className="px-2 pt-3.5 pb-1.5">
              <span className="font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase">
                Food &amp; Snacks
              </span>
              <h3 className="mt-1.5 text-[17px] font-extrabold text-white">Hostel Bakes</h3>
              <p className="mt-1 text-[13.5px] text-white/55">
                Fresh brownies and cakes, baked in H-block. Order by 6pm for same-day.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-white/40">
                <Clock size={11} aria-hidden="true" />
                <span className="font-mono text-[10px] tracking-wider uppercase">
                  Open · 4pm – 11pm
                </span>
              </div>
            </div>
          </article>

          <article className="liquid-glass-panel rounded-3xl p-3 transition duration-150 active:scale-[0.99]">
            <img
              src="/seed/cake.jpg"
              alt="Chocolate cake slices with syrup poured over them"
              className="aspect-4/3 w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
            />
            <div className="px-2 pt-3.5 pb-1.5">
              <span className="font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase">
                Food &amp; Snacks
              </span>
              <h3 className="mt-1.5 text-[17px] font-extrabold text-white">Midnight Batter</h3>
              <p className="mt-1 text-[13.5px] text-white/55">
                Late-night cake slices and jar desserts. Delivers to all hostels.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-white/40">
                <Clock size={11} aria-hidden="true" />
                <span className="font-mono text-[10px] tracking-wider uppercase">
                  Open · 9pm – 2am
                </span>
              </div>
            </div>
          </article>
        </div>
      </Section>

      <Section
        eyebrow="Stat strip"
        note="Cyan is the positive metric, amber is caution, red is a miss, white is a neutral count. No green anywhere."
      >
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          <StatCard label="Inquiries" value={128} unit="taps" icon={MessageCircle} accent="brand" />
          <StatCard label="Pending" value={3} unit="to review" icon={Clock} accent="amber" />
          <StatCard label="Rejected" value={1} unit="this week" icon={XCircle} accent="red" />
          <StatCard label="Ventures" value={12} unit="live" icon={Store} accent="neutral" />
        </div>
      </Section>

      <Section
        eyebrow="Menu rows"
        note="The core of the venture detail page. Square thumbnail or circular glyph on the left, mono price, and a quiet action icon that brightens on hover."
      >
        <div className="space-y-2.5">
          <ListRow
            title="Chocolate Fudge Cake"
            description="Dark chocolate, 500g, serves four"
            meta="₹450"
            thumbnail="/seed/cake.jpg"
            thumbnailAlt=""
            actionIcon={MessageCircle}
            actionLabel="Message Hostel Bakes on WhatsApp about Chocolate Fudge Cake"
          />
          <ListRow
            title="Walnut Brownie Box"
            description="Six pieces, freshly baked"
            meta="₹280"
            thumbnail="/seed/brownies.jpg"
            thumbnailAlt=""
            actionIcon={MessageCircle}
            actionLabel="Message Hostel Bakes on WhatsApp about Walnut Brownie Box"
          />
          <ListRow
            title="Assorted Cookie Jar"
            description="No photo yet — falls back to the circular glyph"
            meta="₹199"
            icon={Cookie}
            actionIcon={MessageCircle}
            actionLabel="Message Hostel Bakes on WhatsApp about Assorted Cookie Jar"
          />
        </div>
      </Section>

      <Section
        eyebrow="Category list"
        note="Bold mono uppercase title over a sentence-case description. This is how the browse page lists categories."
      >
        <div className="liquid-glass-panel divide-y divide-white/8 rounded-3xl p-2">
          {[
            {
              icon: UtensilsCrossed,
              title: 'Food & Snacks',
              body: 'Home bakers, midnight kitchens and snack runs.',
              count: 7,
            },
            {
              icon: Flame,
              title: 'Art & Craft',
              body: 'Prints, custom portraits and handmade gifts.',
              count: 3,
            },
            {
              icon: MousePointerClick,
              title: 'Services',
              body: 'Repairs, tutoring, photography and design work.',
              count: 2,
            },
          ].map(({ icon: Icon, title, body, count }) => (
            <button
              key={title}
              type="button"
              className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-3.5 text-left transition duration-150 hover:bg-white/[0.05] active:scale-[0.99]"
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/45 transition-colors group-hover:text-brand-400">
                <Icon size={16} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-mono text-[12px] font-extrabold tracking-wider text-white uppercase">
                  {title}
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-white/45">{body}</span>
              </span>
              <span className="shrink-0 font-mono text-[11px] font-bold text-white/30">
                {count}
              </span>
            </button>
          ))}
        </div>
      </Section>

      <Section
        eyebrow="Empty states"
        note="One component behind every nothing-to-show panel: an empty directory, a dead link, a submission accepted. The glyph goes brand-tinted only when something went right."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <EmptyState
            icon={Store}
            title="No ventures yet"
            action={<Button to="/design">List your venture</Button>}
          >
            Nobody has listed anything yet. If you make or sell something, you could be first.
          </EmptyState>
          <EmptyState
            icon={ClipboardCheck}
            tone="brand"
            eyebrow="Sent for review"
            title="Your venture is in the queue"
          >
            Nothing goes live until it is approved, so it will not appear in the directory just yet.
          </EmptyState>
        </div>
      </Section>

      <Section
        eyebrow="Shimmer"
        note="Opt-in only. A diagonal band sweeps across on hover — hover the panel below, and the header at the top of this page."
      >
        <div className="liquid-glass-highlight glass-shimmer rounded-3xl p-6">
          <p className="text-[14px] text-white/70">
            Hover me. The sweep takes 800ms and is deliberately not applied to every glass
            element.
          </p>
        </div>
      </Section>

      <p className="px-1 pt-2 text-center font-mono text-[9px] tracking-[0.22em] text-white/25 uppercase">
        Backdrop · Joshua Woroniecki / Unsplash
      </p>
    </div>
  )
}
