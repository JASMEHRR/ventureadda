import { useEffect, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  BadgeCheck,
  ClipboardList,
  LogOut,
  MailCheck,
  Package,
  Settings as SettingsIcon,
  Shield,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Avatar, { AVATAR_STYLES } from '../components/ui/Avatar'
import type { AvatarStyle } from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import LoadingLine from '../components/ui/LoadingLine'
import TextField from '../components/ui/TextField'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { countUnseenOrders } from '../data/orders'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/firebase'

/**
 * Adding a Thapar address to an account that signed in with something else.
 *
 * WHY THIS EXISTS AT ALL. Signing in is one tap with Google, and on a phone
 * that tap lands on whichever account is already there — which for most people
 * is a personal Gmail. They get an account, they browse, and then the first
 * time they try to list something they are told listing is for Thapar
 * students. The only way through used to be signing out and starting over as
 * somebody else: a new username, no orders, an empty cart, for what is one
 * person with two addresses.
 *
 * So: prove the second address the same way the site proves the first, with a
 * link mailed to it, and attach it to the account already open rather than
 * trading it for a new one. Nothing about who they are changes; what they may
 * do does.
 *
 * The panel disappears the moment it works, because `canPost` flips and the
 * seller links appear in its place — which is a better confirmation than any
 * message this could show.
 */
function AddThaparEmail() {
  const { sendThaparLink, completeThaparLink } = useAuth()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // The other half of the round trip. The mailed link comes back to this page,
  // so this page is what finishes the job — on mount, once, before anyone is
  // asked to do anything else.
  useEffect(() => {
    let cancelled = false
    completeThaparLink(window.location.href)
      .then((result) => {
        if (cancelled || result === 'none') return
        // Nothing to show on success. The link worked, canPost flips, and this
        // whole panel is replaced by the seller links.
        window.history.replaceState(null, '', window.location.pathname)
      })
      .catch((cause: unknown) => {
        if (!cancelled) setError(cause instanceof Error ? cause.message : 'That link did not work.')
      })
    return () => {
      cancelled = true
    }
  }, [completeThaparLink])

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await sendThaparLink(email)
      setSent(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <section className="liquid-glass-panel space-y-2 rounded-3xl p-5">
        <div className="flex items-center gap-2.5">
          <MailCheck size={17} className="shrink-0 text-brand-400" aria-hidden="true" />
          <h3 className="text-[17px] font-bold text-white">Check that inbox</h3>
        </div>
        <p className="text-[15px] leading-relaxed text-white/50">
          A link is on its way to {email}. Open it in this browser and your Thapar address is added
          to this account — the same username, the same orders, listing switched on.
        </p>
      </section>
    )
  }

  return (
    <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
      <div className="flex items-center gap-2.5">
        <BadgeCheck size={17} className="shrink-0 text-brand-400" aria-hidden="true" />
        <h3 className="text-[17px] font-bold text-white">List your own venture</h3>
      </div>
      <p className="text-[15px] leading-relaxed text-white/50">
        Listing is for Thapar students, and this account signed in with another address. Add your
        @{ALLOWED_EMAIL_DOMAIN} address here and keep everything you already have — you do not need
        a second account.
      </p>

      <form onSubmit={send} className="space-y-3">
        <TextField
          id="thapar-email"
          label="Your Thapar address"
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
        />
        {error && (
          <p role="alert" className="text-[14px] leading-relaxed text-red-400">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" loading={busy} disabled={email.trim() === ''}>
          Send me the link
        </Button>
      </form>
    </section>
  )
}

/**
 * Who you are signed in as, and where everything of yours lives.
 *
 * THE VENTURE LIST USED TO BE HERE and is now its own page at /my-ventures.
 * This page had grown into three unrelated jobs — identity, a seller's
 * workbench, and the only phone route to half the app — and the sidebar now
 * carries those destinations as tabs. What is left is the account itself plus
 * a set of links, which is what a profile is.
 *
 * The links stay even though the sidebar has the same destinations, because
 * the sidebar is hidden below `md` and the phone bar holds four things. This
 * is the phone's route to the rest.
 */

function ProfileLink({
  to,
  icon: Icon,
  label,
  detail,
  badge = 0,
}: {
  to: string
  icon: LucideIcon
  label: string
  detail: string
  /** Unread count. Zero renders nothing at all, not an empty pill. */
  badge?: number
}) {
  return (
    <Link
      to={to}
      className="liquid-glass-panel flex items-center gap-3.5 rounded-3xl p-5 transition duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      <Icon size={18} className="shrink-0 text-brand-400" aria-hidden="true" />
      <span className="min-w-0 flex-1">
        <span className="block text-[17px] font-bold text-white">{label}</span>
        <span className="block text-[15px] text-white/45">{detail}</span>
      </span>
      {badge > 0 && (
        <span className="shrink-0 rounded-full bg-brand-500/25 px-2.5 py-1 font-mono text-[14px] font-extrabold text-brand-300">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </Link>
  )
}

/**
 * The one thing on this account anybody gets to choose.
 *
 * Nobody picks their username any more — it comes off the front of their
 * address, because on this campus that is what they would have typed anyway.
 * That is the right trade for a name, and it does leave an account with no
 * decision in it at all, which is why this is here. It is small on purpose:
 * three options, no upload, nothing to moderate.
 *
 * Written straight through on tap rather than behind a Save. There is one
 * field, the change is visible in the tile above it the moment it lands, and a
 * Save button for a three-way choice is a button that exists to be forgotten.
 */
function AvatarPicker({ name, current }: { name: string; current: AvatarStyle }) {
  const { setAvatar } = useAuth()
  const [error, setError] = useState<string | null>(null)

  const labels: Record<AvatarStyle, string> = {
    initial: 'Your initial',
    boy: 'Boy',
    girl: 'Girl',
  }

  return (
    <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
      <h3 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
        Your picture
      </h3>

      <div className="flex flex-wrap gap-2.5">
        {AVATAR_STYLES.map((style) => {
          const active = style === current
          return (
            <button
              key={style}
              type="button"
              aria-pressed={active}
              aria-label={labels[style]}
              onClick={() => {
                setError(null)
                void setAvatar(style).catch(() =>
                  setError('Could not save that. Check your connection and try again.'),
                )
              }}
              className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border px-3 py-3 transition duration-150 active:scale-[0.97] ${
                active
                  ? 'border-brand-400/50 bg-brand-500/15'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25'
              }`}
            >
              <Avatar name={name} style={style} className="h-11 w-11 text-[19px]" />
              <span
                className={`font-mono text-[12.5px] font-bold tracking-wider uppercase ${
                  active ? 'text-brand-300' : 'text-white/45'
                }`}
              >
                {labels[style]}
              </span>
            </button>
          )
        })}
      </div>

      {error && (
        <p role="alert" className="text-[14px] text-red-400">
          {error}
        </p>
      )}
    </section>
  )
}

/**
 * Renaming, for the people the derived name does not suit.
 *
 * The name is taken off the address now, which is right for almost everybody
 * and wrong for the person whose address is an alias, a roll number, or their
 * full legal name where everyone knows them as something else. It is one field
 * behind one button rather than a step in the way of everyone.
 *
 * The old name is not released — see changeUsername. Worth knowing before you
 * rename, so it is written under the field rather than left as a surprise.
 */
function ChangeUsername({ current }: { current: string }) {
  const { changeUsername } = useAuth()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(current)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await changeUsername(draft)
      setOpen(false)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setDraft(current)
          setOpen(true)
        }}
        className="font-mono text-[12.5px] font-bold tracking-wider text-brand-400 uppercase transition duration-150 hover:text-brand-300"
      >
        Change name
      </button>
    )
  }

  return (
    <form onSubmit={save} className="mt-3 space-y-3">
      <TextField
        id="username"
        label="Your name here"
        hint="Letters, numbers and underscores. Your old name stays reserved to you, so nobody else can take it."
        required
        maxLength={20}
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
      />
      {error && (
        <p role="alert" className="text-[14px] text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <Button type="submit" variant="primary" loading={busy} disabled={draft.trim() === ''}>
          Save
        </Button>
        <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </form>
  )
}

export default function Profile() {
  const { profile, status, canPost, signOut } = useAuth()

  const unseen = useAsyncData(
    () => (profile && canPost ? countUnseenOrders(profile.uid) : Promise.resolve(0)),
    [profile?.uid, canPost],
  )

  if (status === 'loading') {
    return <LoadingLine label="Loading profile…" />
  }
  if (status === 'signedOut') return <Navigate to="/signin" replace />

  /**
   * Signed in, no username yet.
   *
   * This used to redirect to /signin, which redirects a ready session straight
   * back to /browse — so an account that never claimed a name had no reachable
   * profile, and therefore no reachable Sign out, and no way to switch accounts
   * short of clearing site data. ChooseUsername is the right page for them
   * anyway, and it carries its own sign-out.
   */
  if (!profile) {
    return <ChooseUsername reason="Your profile needs a name before there is anything to show." />
  }

  // Null while the count is still loading, which is not the same as zero — but
  // renders the same, and a badge that arrives a moment late is correct.
  const unseenCount = unseen.data ?? 0

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="liquid-glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <Avatar name={profile.username} style={profile.avatar} className="h-12 w-12 text-[19px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[21px] font-extrabold text-white">{profile.username}</p>
            <p className="truncate text-[15.5px] text-white/45">{profile.email}</p>
          </div>
        </div>

        <div className="mt-3">
          <ChangeUsername current={profile.username} />
        </div>

        {profile.isModerator && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/15 px-3.5 py-2.5 text-brand-300">
            <Shield size={13} aria-hidden="true" />
            <span className="font-mono text-[13px] font-bold tracking-wider uppercase">
              Moderator
            </span>
          </p>
        )}
      </section>

      {/* Two different order pages, and the labels have to keep them apart:
          one is what you bought, the other is what people bought from you. */}
      <ProfileLink
        to="/my-orders"
        icon={Package}
        label="Your orders"
        detail="What you have ordered, and where each one stands"
      />

      <AvatarPicker name={profile.username} current={profile.avatar} />

      {/* Only for the accounts it is about. A Thapar account has nothing to
          add, and a pre-approved outside one has already been let in by hand. */}
      {!canPost && <AddThaparEmail />}

      {canPost && (
        <>
          <ProfileLink
            to="/orders"
            icon={ClipboardList}
            label="Orders you received"
            detail={
              unseenCount > 0 ? `${unseenCount} you have not opened` : 'What people ordered from you'
            }
            badge={unseenCount}
          />
          <ProfileLink
            to="/my-ventures"
            icon={Store}
            label="Your ventures"
            detail="Edit your listings, menus and photos"
          />
        </>
      )}

      <ProfileLink
        to="/settings"
        icon={SettingsIcon}
        label="Settings"
        detail="Panel solidity, blur, notifications"
      />

      <div className="text-center">
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut size={13} aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
