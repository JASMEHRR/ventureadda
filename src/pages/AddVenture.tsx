import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { ClipboardCheck } from 'lucide-react'
import VentureForm from '../components/VentureForm'
import type { VentureFormValues } from '../components/VentureForm'
import Button from '../components/ui/Button'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { createVenture } from '../data/ventures'

export default function AddVenture() {
  const { profile, status } = useAuth()
  const navigate = useNavigate()
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
      <div className="liquid-glass-panel mx-auto flex max-w-md flex-col items-center rounded-3xl px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/15 text-brand-300">
          <ClipboardCheck size={22} aria-hidden="true" />
        </span>
        <p className="mt-5 font-mono text-[9px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Sent for review
        </p>
        <h2 className="mt-2 text-[19px] font-extrabold text-white">Your venture is in the queue</h2>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/45">
          Nothing goes live until it is approved, so it will not appear in the directory just yet.
          You can keep editing it from your profile in the meantime.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2.5">
          <Button variant="secondary" onClick={() => navigate('/profile')}>
            Go to profile
          </Button>
          <Link
            to="/"
            className="inline-flex items-center rounded-full px-5 py-2.5 text-[12px] font-bold tracking-wider text-white/55 uppercase transition hover:text-white"
          >
            Back to browse
          </Link>
        </div>
      </div>
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
