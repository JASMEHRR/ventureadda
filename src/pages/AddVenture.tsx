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

export default function AddVenture() {
  const { profile, status, needsUsername } = useAuth()
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
    await createVenture({ uid: profile.uid, username: profile.username }, venture, items)
    setSubmitted(true)
  }

  return (
    // Wider from lg so VentureForm's save rail has a column to sit in.
    <div className="mx-auto max-w-5xl space-y-4">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed text-white/50">
        Everything here goes to a review queue first. Payment never happens on the site — buyers
        message you on WhatsApp and you settle it between yourselves.
      </p>
      <VentureForm submitLabel="Submit for review" onSubmit={handleSubmit} />
    </div>
  )
}
