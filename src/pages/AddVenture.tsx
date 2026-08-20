import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardCheck, ShieldAlert } from 'lucide-react'
import VentureForm from '../components/VentureForm'
import type { VentureFormValues } from '../components/VentureForm'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { createVenture } from '../data/ventures'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/firebase'

export default function AddVenture() {
  const { profile, status, canPost, needsUsername } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  // Listing needs an account, but browsing never does — so this redirects
  // rather than gating the whole site.
  if (status === 'signedOut') return <Navigate to="/signin" replace />

  // Checked before the form is ever drawn. The rules refuse a create from a
  // non-Thapar account, and finding that out after filling in a name, hours,
  // a phone number, four photographs and a menu is the worst possible moment
  // to learn it.
  if (!canPost) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="Listing is for Thapar students"
        className="mx-auto max-w-md"
        action={
          <Button variant="secondary" to="/browse">
            Back to browse
          </Button>
        }
      >
        Sign in with your @{ALLOWED_EMAIL_DOMAIN} account to list a venture. You can browse and
        review with any account.
      </EmptyState>
    )
  }

  // Asked for here rather than at sign-up: the name goes on the listing, so
  // this is the first moment it actually means anything.
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
    <div className="mx-auto max-w-2xl space-y-4 lg:max-w-5xl">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed text-white/50">
        Everything here goes to a review queue first. Payment never happens on the site — buyers
        message you on WhatsApp and you settle it between yourselves.
      </p>
      <VentureForm submitLabel="Submit for review" onSubmit={handleSubmit} />
    </div>
  )
}
