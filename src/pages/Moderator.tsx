import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  Check,
  Inbox,
  MessageCircle,
  MousePointerClick,
  Search,
  Shield,
  Sprout,
  Store,
  Trash2,
  UserPlus,
  X,
} from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import PhotoUploader from '../components/ui/PhotoUploader'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import StatCard from '../components/ui/StatCard'
import TextField from '../components/ui/TextField'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  backfillSlugs,
  createVenture,
  deleteDemoVentures,
  deleteVenture,
  listMenuItems,
  listVenturesByStatus,
  setVentureStatus,
} from '../data/ventures'
import type { Venture } from '../data/ventures'
import { categoryName } from '../data/types'
import { SEED_VENTURES, seedInput } from '../data/seed'
import { displayUrl } from '../lib/cloudinary'
import { OWNER_EMAIL, auth } from '../lib/firebase'
import { listTraffic } from '../data/traffic'
import type { TrafficDay } from '../data/traffic'
import {
  getSiteSettings,
  isDown,
  setBackdrop,
  setBackdropLight,
  setEmailSignIn,
  setLandingCopy,
  LANDING_DEFAULTS,
  setMaintenance,
  setSellerContact,
} from '../data/settings'
import type { LandingCopy } from '../data/settings'
import type { MaintenanceWindow } from '../data/settings'
import {
  approveEmail,
  findUserByUsername,
  listApprovedEmails,
  revokeApprovedEmail,
  setModerator,
  listUsers,
  deleteUserAccount,
} from '../data/moderators'
import type { ModeratorCandidate } from '../data/moderators'

type Tab = 'pending' | 'live'

function VentureRow({
  venture,
  inquiries,
  children,
}: {
  venture: Venture
  inquiries?: number
  children: React.ReactNode
}) {
  return (
    <article className="liquid-glass-panel rounded-2xl p-4">
      <div className="flex items-start gap-3.5">
        {venture.photos[0] && (
          <img
            src={displayUrl(venture.photos[0], 400)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[12.5px] tracking-[0.22em] text-white/55 uppercase">
            {categoryName(venture.categoryId)}
          </p>
          <h3 className="mt-1 truncate text-[18px] font-extrabold text-white">{venture.name}</h3>
          <p className="mt-0.5 truncate text-[15.5px] text-white/60">
            {venture.ownerUsername} · {venture.hours}
          </p>
          <p className="mt-2 line-clamp-2 text-[15.5px] leading-snug text-white/55">
            {venture.description}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[13px] text-white/55">
              <MousePointerClick size={11} aria-hidden="true" />
              {venture.clickCount} opens
            </span>
            {inquiries !== undefined && (
              <span className="flex items-center gap-1.5 font-mono text-[13px] text-brand-400">
                <MessageCircle size={11} aria-hidden="true" />
                {inquiries} enquiries
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-white/8 pt-3.5">
        {children}
      </div>
    </article>
  )
}

/**
 * Scheduling the site's own downtime.
 *
 * TWO NATIVE datetime-local FIELDS, which is the whole control. A date-time
 * range is exactly what the platform already ships a picker for, on every
 * phone the people using this own, complete with the keyboard handling and
 * the locale formatting a hand-rolled one would have to reinvent badly.
 *
 * The value they type is read as their own local time — `new Date(value)`
 * does that for a datetime-local string — and stored as epoch milliseconds,
 * so a window set from a phone and a window set from a laptop mean the same
 * moment even if the two disagree about time zones.
 *
 * AN END IS COMPULSORY, and the form refuses without one. A window with no
 * end is a site somebody has to remember to reopen, and the person who has to
 * remember is whoever set it at 2am to fix a bug.
 */
function MaintenancePanel({
  current,
  onSave,
  busy,
}: {
  current: MaintenanceWindow | undefined
  onSave: (window: MaintenanceWindow | null) => void
  busy: boolean
}) {
  // Prefilled from whatever is scheduled, so editing a window is editing it
  // rather than retyping it from the beginning.
  const toField = (ms: number | undefined) => {
    if (typeof ms !== 'number') return ''
    const at = new Date(ms)
    // toISOString would render UTC, which is the one time zone nobody setting
    // this is in. Built from the local parts instead.
    const pad = (value: number) => String(value).padStart(2, '0')
    return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}T${pad(at.getHours())}:${pad(at.getMinutes())}`
  }

  const [from, setFrom] = useState(toField(current?.from))
  const [until, setUntil] = useState(toField(current?.until))
  const [note, setNote] = useState(current?.note ?? '')
  const [error, setError] = useState<string | null>(null)

  const save = () => {
    setError(null)
    const start = new Date(from).getTime()
    const end = new Date(until).getTime()
    if (!Number.isFinite(start) || !Number.isFinite(end)) {
      setError('Set both a start and an end.')
      return
    }
    if (end <= start) {
      setError('The end has to be after the start.')
      return
    }
    onSave({ from: start, until: end, ...(note.trim() ? { note: note.trim() } : {}) })
  }

  const live = isDown(current)

  return (
    <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Maintenance window
        </h2>
        {live && (
          <span className="rounded-full bg-amber-500/20 px-3 py-1 font-mono text-[12px] font-extrabold tracking-wider text-amber-300 uppercase">
            Closed now
          </span>
        )}
      </div>

      <p className="text-[15px] leading-relaxed text-white/60">
        Everyone except moderators sees a closed sign between these two times, and the site comes
        back on its own at the end — nobody has to remember to reopen it. You keep full access
        throughout, with a bar across the top so you cannot forget it is closed.
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="maintenance-from"
          label="From"
          type="datetime-local"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <TextField
          id="maintenance-until"
          label="Until"
          type="datetime-local"
          value={until}
          onChange={(event) => setUntil(event.target.value)}
        />
      </div>

      <TextField
        id="maintenance-note"
        label="What to tell people"
        hint="Optional. Shown on the closed sign instead of the default wording."
        maxLength={140}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Back after we finish the checkout fix."
      />

      {error && (
        <p role="alert" className="text-[14px] text-red-300">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={save} disabled={busy}>
          {current ? 'Update window' : 'Schedule it'}
        </Button>
        {current && (
          <Button variant="secondary" onClick={() => onSave(null)} disabled={busy}>
            Cancel window
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Traffic, drawn as bars because a column of numbers is not a trend.
 *
 * WHAT IT COUNTS, said plainly on the panel itself: tabs that opened the site,
 * once each, per day. Not people — one person on a phone and a laptop is two —
 * and not page views, since a single-page app navigates without reloading and
 * counting those would measure clicking about rather than arriving.
 *
 * Bars are scaled against the busiest day in the window rather than a fixed
 * ceiling, so the shape is readable whether the best day was nine visits or
 * nine hundred.
 */
function TrafficPanel({ days }: { days: TrafficDay[] }) {
  const today = new Date()
  const pad = (value: number) => String(value).padStart(2, '0')
  const todayKey = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`

  const total = days.reduce((sum, day) => sum + day.count, 0)
  const peak = Math.max(1, ...days.map((day) => day.count))
  const todayCount = days.find((day) => day.day === todayKey)?.count ?? 0
  // Oldest on the left, which is the direction a trend is read in.
  const ordered = [...days].reverse()

  return (
    <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Traffic
        </h2>
        <span className="font-mono text-[13px] text-white/55">
          {todayCount} today · {total} in {days.length || 0} day{days.length === 1 ? '' : 's'}
        </span>
      </div>

      {ordered.length === 0 ? (
        <p className="text-[15px] text-white/60">
          Nothing counted yet. The first visit after this went live starts it off.
        </p>
      ) : (
        <>
          <div className="flex h-28 items-end gap-1.5">
            {ordered.map((day) => (
              <div key={day.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
                <span className="font-mono text-[12px] font-bold text-white/60">{day.count}</span>
                <div
                  // A visited day always draws something: a bar rounded down to
                  // nothing looks like a day nobody came, which is a different
                  // fact.
                  style={{ height: `${Math.max(4, (day.count / peak) * 100)}%` }}
                  className={`w-full rounded-t ${
                    day.day === todayKey ? 'bg-brand-400' : 'bg-brand-500/40'
                  }`}
                  title={`${day.count} on ${day.day}`}
                />
                <span className="font-mono text-[11px] text-white/50">{day.day.slice(8)}</span>
              </div>
            ))}
          </div>

          <p className="text-[14.5px] leading-relaxed text-white/60">
            Tabs that opened the site, counted once each per day — not people, and not page
            views. Somebody on a phone and a laptop is two; somebody reading six ventures in one
            sitting is one.
          </p>
        </>
      )}
    </div>
  )
}

/**
 * The words on the front page, editable without a deploy.
 *
 * WHY THIS IS A SETTING. The hook is a guess. Nobody knows whether "Hungry?"
 * or "Don't order out" or naming the goods is what makes a student stop
 * scrolling, and the only way to find out is to change it on a Tuesday and
 * watch. Needing a developer for that is what stops it ever being tried.
 *
 * Empty means the wording shipped in the code, and the placeholder shows what
 * that is — so clearing a field is the reset, and there is no separate button
 * that has to explain itself.
 */
function LandingCopyPanel({
  current,
  busy,
  onSave,
}: {
  current: LandingCopy
  busy: boolean
  onSave: (copy: LandingCopy) => void
}) {
  const [draft, setDraft] = useState<LandingCopy>(current)
  // The saved values arrive a moment after the first render, and a form that
  // ignores them shows empty boxes over words that are on the live site.
  const [seeded, setSeeded] = useState(false)
  if (!seeded && Object.keys(current).length > 0) {
    setDraft(current)
    setSeeded(true)
  }

  const set = (key: keyof LandingCopy) => (event: { target: { value: string } }) =>
    setDraft((prev) => ({ ...prev, [key]: event.target.value }))

  return (
    <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
      <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
        Front page words
      </h2>
      <p className="text-[15px] leading-relaxed text-white/60">
        What a first-time visitor reads. Leave a box empty to go back to the wording the site
        ships with, which is what the grey text in each box shows.
      </p>

      <TextField
        id="landing-hook"
        label="Hook"
        hint="The first word or two, largest on the page."
        maxLength={40}
        value={draft.hook ?? ''}
        onChange={set('hook')}
        placeholder={LANDING_DEFAULTS.hook}
      />
      <TextField
        id="landing-line"
        label="The line under it"
        maxLength={90}
        value={draft.line ?? ''}
        onChange={set('line')}
        placeholder={LANDING_DEFAULTS.line}
      />
      <TextField
        id="landing-sub"
        label="The sentence under both"
        hint="Name what is actually for sale here."
        maxLength={200}
        value={draft.sub ?? ''}
        onChange={set('sub')}
        placeholder={LANDING_DEFAULTS.sub}
      />

      <div className="grid gap-3 sm:grid-cols-2">
        <TextField
          id="landing-buy"
          label="Buyer's button"
          maxLength={40}
          value={draft.buyLabel ?? ''}
          onChange={set('buyLabel')}
          placeholder={LANDING_DEFAULTS.buyLabel}
        />
        <TextField
          id="landing-sell"
          label="Seller's button"
          maxLength={40}
          value={draft.sellLabel ?? ''}
          onChange={set('sellLabel')}
          placeholder={LANDING_DEFAULTS.sellLabel}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        <Button onClick={() => onSave(draft)} loading={busy}>
          Save the words
        </Button>
        <Button variant="secondary" to="/welcome">
          See the page
        </Button>
      </div>
    </div>
  )
}

export default function Moderator() {
  const { profile, status } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Venture | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [moderatorQuery, setModeratorQuery] = useState('')
  const [moderatorLookupBusy, setModeratorLookupBusy] = useState(false)
  const [moderatorResult, setModeratorResult] = useState<ModeratorCandidate | 'not-found' | null>(
    null,
  )
  const [userFilter, setUserFilter] = useState('')
  /** Which row is asking "are you sure". One at a time, by uid. */
  const [confirmingRemoval, setConfirmingRemoval] = useState<string | null>(null)
  const [approveEmailInput, setApproveEmailInput] = useState('')
  const [approveAsModerator, setApproveAsModerator] = useState(false)

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])

  const pending = useAsyncData(() => listVenturesByStatus('pending'), [refreshToken])
  const live = useAsyncData(() => listVenturesByStatus('live'), [refreshToken])
  const settings = useAsyncData(() => getSiteSettings(), [refreshToken])
  const traffic = useAsyncData(() => listTraffic(14), [refreshToken])
  const approved = useAsyncData(() => listApprovedEmails(), [refreshToken])
  const users = useAsyncData(() => listUsers(), [refreshToken])

  // Enquiry totals per venture, for the live tab. One read of the whole menu
  // collection is cheaper than one per venture at this size.
  const inquiries = useAsyncData(async () => {
    const ventures = await listVenturesByStatus('live')
    const totals: Record<string, number> = {}
    for (const venture of ventures) {
      const items = await listMenuItems(venture.id)
      totals[venture.id] = items.reduce((sum, item) => sum + item.inquiryCount, 0)
    }
    return totals
  }, [refreshToken])

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  if (!profile?.isModerator) return <Navigate to="/browse" replace />

  const act = async (fn: () => Promise<void>, message: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      setNotice(message)
      refresh()
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const isOwner = profile.email === OWNER_EMAIL

  const lookupModerator = async () => {
    setModeratorLookupBusy(true)
    setNotice(null)
    try {
      const found = await findUserByUsername(moderatorQuery)
      setModeratorResult(found ?? 'not-found')
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'That did not work.')
    } finally {
      setModeratorLookupBusy(false)
    }
  }

  const toggleModerator = (candidate: ModeratorCandidate) =>
    act(async () => {
      await setModerator(candidate.uid, !candidate.isModerator)
      setModeratorResult({ ...candidate, isModerator: !candidate.isModerator })
    }, `${candidate.username} is ${!candidate.isModerator ? 'now' : 'no longer'} a moderator.`)

  const approveEmailAction = () =>
    act(async () => {
      await approveEmail(approveEmailInput, approveAsModerator)
      setApproveEmailInput('')
      setApproveAsModerator(false)
    }, `${approveEmailInput.trim()} can now sign in and post. ${approveAsModerator ? 'They will be made a moderator the moment they do.' : ''}`)

  const revokeEmailAction = (email: string) =>
    act(() => revokeApprovedEmail(email), `${email} is no longer pre-approved.`)

  const importSeed = () =>
    act(async () => {
      for (const entry of SEED_VENTURES) {
        const { venture, items } = seedInput(entry)
        const id = await createVenture(
          { uid: profile.uid, username: profile.username },
          venture,
          items,
          { isDemo: true },
        )
        // Seeded listings skip the queue: you are the moderator and you just
        // asked for them.
        await setVentureStatus(id, 'live')
      }
    }, `Imported ${SEED_VENTURES.length} demo ventures.`)

  /** The one action that undoes the import, keyed on the flag, not on names. */
  const removeSeed = () =>
    act(async () => {
      const removed = await deleteDemoVentures()
      if (removed === 0) throw new Error('There is no demo data to remove.')
    }, 'Removed every demo venture.')

  const totalInquiries = Object.values(inquiries.data ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard
          label="Pending"
          value={pending.data?.length ?? 0}
          unit="to review"
          icon={Inbox}
          accent="amber"
        />
        <StatCard
          label="Live"
          value={live.data?.length ?? 0}
          unit="listings"
          icon={Store}
          accent="neutral"
        />
        <StatCard
          label="Enquiries"
          value={totalInquiries}
          unit="taps"
          icon={MessageCircle}
          accent="brand"
        />
        <StatCard
          label="Opens"
          value={(live.data ?? []).reduce((sum, v) => sum + v.clickCount, 0)}
          unit="views"
          icon={MousePointerClick}
          accent="neutral"
        />
      </div>

      <div className="liquid-glass-panel space-y-2 rounded-2xl p-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Site backdrop
        </h2>
        <p className="text-[15px] text-white/60">
          Shown behind the whole app, to every visitor. Leave empty for the default.
        </p>
        <PhotoUploader
          label="Night backdrop"
          photos={settings.data?.backdrop ? [settings.data.backdrop] : []}
          onChange={(next) =>
            void act(() => setBackdrop(next[0] ?? null), next[0] ? 'Backdrop updated.' : 'Backdrop reset to default.')
          }
          max={1}
        />

        <PhotoUploader
          label="Day backdrop"
          hint="A light photograph. Day mode has dark text on light panels, so the night sky cannot be used for it — without one here, day mode falls back to a plain gradient."
          photos={settings.data?.backdropLight ? [settings.data.backdropLight] : []}
          onChange={(next) =>
            void act(
              () => setBackdropLight(next[0] ?? null),
              next[0] ? 'Day backdrop updated.' : 'Day backdrop cleared.',
            )
          }
          max={1}
        />
      </div>

      <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Readable links
        </h2>
        <p className="text-[15px] leading-relaxed text-white/60">
          Ventures listed before this existed still have a link made of their database id —
          /venture/3KHid4o2sqQ4J49cE2dV rather than /venture/glood. This gives every live one a
          link with its name in it. Old links keep working; nothing breaks.
        </p>
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() =>
            void act(async () => {
              const named = await backfillSlugs()
              // Thrown rather than returned, because `act` only knows how to
              // show one message and the honest one depends on the count.
              if (named === 0) throw new Error('Every live venture already has one.')
            }, 'Done — every live venture now has a readable link.')
          }
        >
          Name the ones without links
        </Button>
      </div>

      <TrafficPanel days={traffic.data ?? []} />

      <LandingCopyPanel
        current={settings.data?.landing ?? {}}
        busy={busy}
        onSave={(copy) => void act(() => setLandingCopy(copy), 'The front page now says that.')}
      />

      <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Ways in
        </h2>
        <p className="text-[15px] leading-relaxed text-white/60">
          Signing in by email address sends mail, and Firebase&rsquo;s free tier caps how much of
          that there is. When the cap is spent every email sign-in fails, which looks like the
          site being broken — so it can be put away entirely. Google sends no mail and is never
          affected. Turning this off does not remove anybody: an account made by email is still
          there, and can sign in with Google on the same address.
        </p>
        <ChoiceGroup
          label="Email sign-in"
          value={settings.data?.emailSignIn === true ? 'on' : 'off'}
          onChange={(next) =>
            void act(
              () => setEmailSignIn(next === 'on'),
              next === 'on' ? 'Email sign-in is back on.' : 'Google is now the only way in.',
            )
          }
          choices={[
            {
              value: 'off',
              label: 'Google only',
              detail: 'No mail is sent, so nothing can run out. The safe setting.',
            },
            {
              value: 'on',
              label: 'Google and email',
              detail: 'Offers the address-and-password route as well. Needs mail quota to spare.',
            },
          ]}
        />
      </div>

      <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Checkout options
        </h2>
        <p className="text-[15px] leading-relaxed text-white/60">
          &ldquo;The seller contacts me&rdquo; puts the order on the seller&rsquo;s dashboard and
          asks the buyer to wait for a call — a promise nothing on this site can keep, because
          nothing makes a seller open that dashboard. Off, every order goes out through WhatsApp
          with the items written out. Turn it on only once you know your sellers watch their
          orders.
        </p>
        {/* ChoiceGroup rather than the StockToggle used elsewhere: that one is
            worded "In stock / Sold out", which is about a menu item and would
            be nonsense here. */}
        <ChoiceGroup
          label="Offer it at checkout"
          value={settings.data?.sellerContact === true ? 'on' : 'off'}
          onChange={(next) =>
            void act(
              () => setSellerContact(next === 'on'),
              next === 'on'
                ? 'Buyers can now ask the seller to contact them.'
                : 'Every order now goes out through WhatsApp.',
            )
          }
          choices={[
            {
              value: 'off',
              label: 'No — WhatsApp only',
              detail: 'The buyer taps through with the order written out. One route, and it works.',
            },
            {
              value: 'on',
              label: 'Yes — offer both',
              detail: 'Buyers may choose to wait for the seller to call them instead.',
            },
          ]}
        />
      </div>

      <MaintenancePanel
        // Remounts when the stored window changes, so the fields follow a save
        // (or another moderator's change) instead of holding what was typed.
        key={JSON.stringify(settings.data?.maintenance ?? null)}
        current={settings.data?.maintenance}
        busy={busy}
        onSave={(window) =>
          void act(
            () => setMaintenance(window),
            window ? 'Maintenance window saved.' : 'Maintenance window cancelled.',
          )
        }
      />

      {/* Every account, for any moderator. Read-only here — granting access
          lives in the owner-only panel below, because only the owner can
          write isModerator per the rules. */}
      <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Users ({users.data?.length ?? 0})
        </h2>

        <TextField
          id="user-filter"
          label="Filter"
          value={userFilter}
          onChange={(event) => setUserFilter(event.target.value)}
          placeholder="username or email"
        />

        {users.error && <p className="text-[15.5px] text-red-300">{users.error.message}</p>}
        {users.loading && <LoadingLine label="Loading users…" />}

        <div className="space-y-2">
          {(users.data ?? [])
            .filter((entry) => {
              const needle = userFilter.trim().toLowerCase()
              if (!needle) return true
              return (
                entry.username.toLowerCase().includes(needle) ||
                entry.email.toLowerCase().includes(needle)
              )
            })
            .map((entry) => (
              <div
                key={entry.uid}
                className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5"
              >
                <Shield
                  size={15}
                  aria-hidden="true"
                  className={entry.isModerator ? 'text-brand-400' : 'text-white/50'}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-bold text-white">{entry.username}</p>
                  <p className="truncate text-[15px] text-white/60">{entry.email}</p>
                </div>
                {entry.email === OWNER_EMAIL ? (
                  <span className="shrink-0 font-mono text-[12.5px] font-bold tracking-wider text-white/55 uppercase">
                    Owner
                  </span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    {isOwner ? (
                      <Button
                        variant={entry.isModerator ? 'danger' : 'secondary'}
                        disabled={busy}
                        onClick={() =>
                          act(
                            () => setModerator(entry.uid, !entry.isModerator),
                            `${entry.username} is ${!entry.isModerator ? 'now' : 'no longer'} a moderator.`,
                          )
                        }
                      >
                        {entry.isModerator ? 'Remove access' : 'Make moderator'}
                      </Button>
                    ) : (
                      entry.isModerator && (
                        <span className="font-mono text-[12.5px] font-bold tracking-wider text-brand-400 uppercase">
                          Moderator
                        </span>
                      )
                    )}

                    {/* TWO TAPS, NEVER ONE. This deletes a person's sign-in and
                        their profile and there is no undo — a single red button
                        in a list of rows is a mis-tap away from removing the
                        wrong account. The second tap names them, so the
                        confirmation is about a person rather than about a
                        button. Their own row is excluded: removing the account
                        performing the removal would end the session mid-job. */}
                    {entry.uid !== profile.uid &&
                      (confirmingRemoval === entry.uid ? (
                        <>
                          <Button
                            variant="danger"
                            disabled={busy}
                            onClick={() =>
                              act(async () => {
                                const token = await auth.currentUser?.getIdToken()
                                if (!token) throw new Error('Sign in again first.')
                                await deleteUserAccount(token, entry.uid)
                                setConfirmingRemoval(null)
                              }, `${entry.username} has been removed.`)
                            }
                          >
                            Yes, remove {entry.username}
                          </Button>
                          <Button variant="ghost" onClick={() => setConfirmingRemoval(null)}>
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmingRemoval(entry.uid)}
                          aria-label={`Remove ${entry.username}`}
                          title="Remove this account"
                          className="rounded-full border border-white/10 bg-white/5 p-2 text-white/60 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Owner only. The rules restrict the actual write the same way, but
          showing this to every moderator would suggest they can use it and
          fail — better to just not offer it. */}
      {isOwner && (
        <div className="liquid-glass-panel space-y-3 rounded-2xl p-4">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Moderators
          </h2>
          <p className="text-[15px] text-white/60">
            Look up anyone by their username to grant or remove moderator access.
          </p>

          <div className="flex items-end gap-2">
            <TextField
              id="moderator-username"
              label="Username"
              wrapperClassName="flex-1"
              value={moderatorQuery}
              onChange={(event) => {
                setModeratorQuery(event.target.value)
                setModeratorResult(null)
              }}
              placeholder="e.g. jasmehr"
            />
            <Button
              variant="secondary"
              loading={moderatorLookupBusy}
              disabled={!moderatorQuery.trim()}
              onClick={() => void lookupModerator()}
            >
              <Search size={13} aria-hidden="true" />
              Look up
            </Button>
          </div>

          {moderatorResult === 'not-found' && (
            <p className="text-[15.5px] text-white/60">No account with that username.</p>
          )}

          {moderatorResult && moderatorResult !== 'not-found' && (
            <div className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3">
              <Shield
                size={16}
                aria-hidden="true"
                className={moderatorResult.isModerator ? 'text-brand-400' : 'text-white/50'}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[16px] font-bold text-white">
                  {moderatorResult.username}
                </p>
                <p className="truncate text-[15px] text-white/60">{moderatorResult.email}</p>
              </div>
              {moderatorResult.email === OWNER_EMAIL ? (
                <span className="font-mono text-[13px] tracking-wider text-white/55 uppercase">
                  Owner
                </span>
              ) : (
                <Button
                  variant={moderatorResult.isModerator ? 'danger' : 'primary'}
                  disabled={busy}
                  onClick={() => toggleModerator(moderatorResult)}
                >
                  {moderatorResult.isModerator ? 'Remove access' : 'Make moderator'}
                </Button>
              )}
            </div>
          )}

          <div className="space-y-3 border-t border-white/8 pt-3.5">
            <p className="text-[15px] text-white/60">
              Pre-approve an address that has not signed up yet. It can then sign in and post like
              a Thapar account — and if you also check "make moderator", it becomes one the moment
              it first signs in.
            </p>

            <div className="flex items-end gap-2">
              <TextField
                id="approve-email"
                label="Email address"
                wrapperClassName="flex-1"
                type="email"
                value={approveEmailInput}
                onChange={(event) => setApproveEmailInput(event.target.value)}
                placeholder="someone@gmail.com"
              />
              <Button
                variant="primary"
                loading={busy}
                disabled={!approveEmailInput.trim()}
                onClick={() => void approveEmailAction()}
              >
                <UserPlus size={13} aria-hidden="true" />
                Approve
              </Button>
            </div>
            <label className="flex items-center gap-2 text-[15.5px] text-white/60">
              <input
                type="checkbox"
                checked={approveAsModerator}
                onChange={(event) => setApproveAsModerator(event.target.checked)}
                className="h-4 w-4 rounded border-white/20 bg-white/5 accent-brand-500"
              />
              Also make this a moderator on sign-up
            </label>

            {approved.data && approved.data.length > 0 && (
              <div className="space-y-2">
                {approved.data.map((entry) => (
                  <div
                    key={entry.email}
                    className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.03] px-4 py-2.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-[15.5px] text-white/80">
                      {entry.email}
                    </span>
                    {entry.moderator && (
                      <span className="shrink-0 font-mono text-[12.5px] font-bold tracking-wider text-brand-400 uppercase">
                        Moderator
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => void revokeEmailAction(entry.email)}
                      disabled={busy}
                      aria-label={`Revoke pre-approval for ${entry.email}`}
                      className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <div className="liquid-glass-panel flex gap-1.5 rounded-2xl p-1.5">
        {(['pending', 'live'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'true' : undefined}
            className={`flex-1 rounded-xl px-4 py-2.5 font-mono text-[14px] tracking-wider uppercase transition duration-150 active:scale-[0.98] ${
              tab === value
                ? 'bg-white/15 font-extrabold text-white'
                : 'font-bold text-white/60 hover:bg-white/[0.07] hover:text-white/85'
            }`}
          >
            {value === 'pending' ? `Pending (${pending.data?.length ?? 0})` : 'Live listings'}
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] text-white/70"
        >
          {notice}
        </p>
      )}

      {tab === 'pending' && (
        <div className="space-y-2.5">
          {pending.error && (
            <p className="liquid-glass-panel rounded-2xl px-5 py-4 text-[16px] text-red-400">
              {pending.error.message}
            </p>
          )}
          {!pending.data && !pending.error && (
            <LoadingLine label="Loading the queue…" inset={false} />
          )}
          {pending.data?.length === 0 && (
            <p className="liquid-glass-panel rounded-3xl px-6 py-12 text-center text-[16px] text-white/60">
              Nothing waiting. New submissions land here.
            </p>
          )}
          {pending.data?.map((venture) => (
            <VentureRow key={venture.id} venture={venture}>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => act(() => setVentureStatus(venture.id, 'live'), `${venture.name} is live.`)}
              >
                <Check size={13} aria-hidden="true" />
                Approve
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  act(() => setVentureStatus(venture.id, 'rejected'), `${venture.name} rejected.`)
                }
              >
                <X size={13} aria-hidden="true" />
                Reject
              </Button>
              <Button variant="secondary" to={`/venture/${venture.id}/edit`}>
                Edit
              </Button>
              <Button variant="danger" disabled={busy} onClick={() => setConfirmDelete(venture)}>
                Remove
              </Button>
              <Link
                to={`/venture/${venture.id}`}
                className="ml-auto font-mono text-[13px] tracking-wider text-white/60 uppercase transition hover:text-white"
              >
                Preview
              </Link>
            </VentureRow>
          ))}
        </div>
      )}

      {tab === 'live' && (
        <div className="space-y-2.5">
          {live.error && (
            <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-4 text-[16px] text-red-400">
              {live.error.message}
            </p>
          )}
          {!live.data && !live.error && (
            <LoadingLine label="Loading listings…" inset={false} />
          )}
          {live.data?.length === 0 && (
            <EmptyState
              icon={Sprout}
              title="The directory is empty"
              action={
                <Button variant="secondary" loading={busy} onClick={importSeed}>
                  Import demo ventures
                </Button>
              }
            >
              An empty directory gets no submissions. Import the demo ventures to have something
              worth sharing, then replace them with real ones.
            </EmptyState>
          )}
          {/* Demo data is a temporary crutch, so the way to remove it sits
              next to the listings rather than buried in a settings page. */}
          {live.data?.some((venture) => venture.isDemo) && (
            <div className="liquid-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5">
              <p className="text-[16px] text-white/50">
                {live.data.filter((venture) => venture.isDemo).length} of these are demo listings.
              </p>
              <Button variant="danger" loading={busy} onClick={removeSeed}>
                Remove all demo data
              </Button>
            </div>
          )}

          {live.data?.map((venture) => (
            <VentureRow
              key={venture.id}
              venture={venture}
              inquiries={inquiries.data?.[venture.id]}
            >
              <Button variant="secondary" to={`/venture/${venture.id}/edit`}>
                Edit
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirmDelete(venture)}
              >
                Remove
              </Button>
              <Link
                to={`/venture/${venture.id}`}
                className="ml-auto font-mono text-[13px] tracking-wider text-white/60 uppercase transition hover:text-white"
              >
                View
              </Link>
            </VentureRow>
          ))}
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                const target = confirmDelete
                if (!target) return
                setConfirmDelete(null)
                void act(() => deleteVenture(target.id), `${target.name} removed.`)
              }}
            >
              Remove permanently
            </Button>
          </>
        }
      >
        <p className="text-[16px] leading-relaxed text-white/70">
          This deletes the listing and its whole menu, including the enquiry counts. It cannot be
          undone. Rejecting instead keeps the record and lets the owner fix it.
        </p>
      </Modal>
    </div>
  )
}
