import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import VentureForm from '../components/VentureForm'
import type { VentureFormValues } from '../components/VentureForm'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { createVenture } from '../data/ventures'
import { accountForEmail } from '../data/moderators'
import TextField from '../components/ui/TextField'
import { auth } from '../lib/firebase'

/**
 * Listing on somebody else's behalf, for moderators.
 *
 * WHY IT EXISTS. Friends ask for their venture to be listed and say they will
 * sort their account out later. The alternatives are both bad: signing in as
 * them means holding their password, and filing the shop under the
 * moderator's own name puts the wrong person on the listing and makes handing
 * it over a migration later.
 *
 * Leave it empty and the listing is yours, which is the ordinary case and the
 * default.
 */
function OnBehalfOf({
  email,
  onChange,
  resolved,
}: {
  email: string
  onChange: (next: string) => void
  resolved: string | null
}) {
  return (
    <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
      <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
        Whose venture is this
      </h2>
      <p className="text-[15px] leading-relaxed text-white/60">
        Leave this empty and it is yours. Put somebody else&rsquo;s address in and the listing is
        filed under them — no account needed on their side yet. When they sign in with Google on
        that address one day, it is already waiting for them, with this venture on it.
      </p>
      <TextField
        id="on-behalf-of"
        label="Their email address"
        type="email"
        value={email}
        onChange={(event) => onChange(event.target.value)}
        placeholder="friend@thapar.edu"
      />
      {resolved && (
        <p className="text-[14.5px] text-brand-300">
          This will be listed under <span className="font-bold">{resolved}</span>.
        </p>
      )}
    </section>
  )
}

export default function AddVenture() {
  const { profile, status, needsUsername } = useAuth()
  const canListForOthers = profile?.isModerator === true
  const [onBehalfOf, setOnBehalfOf] = useState('')
  const [resolvedOwner, setResolvedOwner] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  // Listing needs an account, but browsing never does — so this redirects
  // rather than gating the whole site.
  if (status === 'signedOut') return <Navigate to="/signin" replace />

  /**
   * THE THAPAR WALL STOOD HERE and is gone.
   *
   * It turned away any account without an @thapar.edu address, which rested on
   * the email sign-in link — and that link spends Firebase's free mail quota,
   * so on the day the quota runs out the only route to a qualifying account
   * stops working and this page turns everybody away. The check was never what
   * kept bad listings off the site either: every venture is created pending
   * and a moderator approves it before anybody sees it. A human reading the
   * listing is the better gate.
   *
   * Chat still asks for the address, because a message there is published the
   * instant it is sent with nobody in between.
   */
  if (needsUsername || !profile) {
    return <ChooseUsername reason="This is the name buyers will see on your venture." />
  }

  if (submitted) {
    return (
      <EmptyState
        icon={ClipboardCheck}
        tone="brand"
        eyebrow="Sent for review"
        title="Your venture is in the queue"
        className="mx-auto max-w-md"
        action={
          <>
            <Button variant="secondary" to="/profile">
              Go to profile
            </Button>
            <Button variant="ghost" to="/browse">
              Back to browse
            </Button>
          </>
        }
      >
        Nothing goes live until it is approved, so it will not appear in the directory just yet.
        You can keep editing it from your profile in the meantime.
      </EmptyState>
    )
  }

  const handleSubmit = async ({ venture, items }: VentureFormValues) => {
    /**
     * Whose name the listing goes out under.
     *
     * Yours unless a moderator has named somebody else, in which case their
     * account is found or created first and the venture is filed against it
     * from the start — so it is theirs before they have opened the site, and
     * handing it over later is nothing at all: signing in with Google on that
     * address finds the account, the venture and the username already there.
     *
     * Resolved at submit rather than as the address is typed, so a half-typed
     * address never creates an account nobody meant to make.
     */
    let owner = { uid: profile.uid, username: profile.username }
    if (canListForOthers && onBehalfOf.trim()) {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sign in again first.')
      owner = await accountForEmail(token, onBehalfOf.trim())
      setResolvedOwner(owner.username)
    }

    await createVenture(owner, venture, items)
    setSubmitted(true)
  }

  return (
    // Wider from lg so VentureForm's save rail has a column to sit in.
    <div className="mx-auto max-w-5xl space-y-4">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed text-white/50">
        Everything here goes to a review queue first. Payment never happens on the site — buyers
        message you on WhatsApp and you settle it between yourselves.
      </p>
      {/* Moderators only. Everybody else's listing is simply their own, and a
          field asking whose it is would be a question with one answer. */}
      {canListForOthers && (
        <OnBehalfOf email={onBehalfOf} onChange={setOnBehalfOf} resolved={resolvedOwner} />
      )}

      <VentureForm submitLabel="Submit for review" onSubmit={handleSubmit} />
    </div>
  )
}
