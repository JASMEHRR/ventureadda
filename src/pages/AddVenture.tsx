import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import VentureForm from '../components/VentureForm'
import type { VentureFormValues } from '../components/VentureForm'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { createVenture } from '../data/ventures'

export default function AddVenture() {
  const { profile, status } = useAuth()
  const [submitted, setSubmitted] = useState(false)

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  // Listing needs an account, but browsing never does — so this redirects
  // rather than gating the whole site.
  if (status === 'signedOut' || !profile) return <Navigate to="/signin" replace />

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
            <Button variant="ghost" to="/">
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
    <div className="mx-auto max-w-2xl space-y-4">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[13.5px] leading-relaxed text-white/50">
        Everything here goes to a review queue first. Payment never happens on the site — buyers
        message you on WhatsApp and you settle it between yourselves.
      </p>
      <VentureForm submitLabel="Submit for review" onSubmit={handleSubmit} />
    </div>
  )
}
