import { Navigate } from 'react-router-dom'
import { LogOut, Shield } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import { useAuth } from '../auth/AuthProvider'

export default function Profile() {
  const { profile, status, signOut } = useAuth()

  if (status === 'loading') {
    return (
      <p className="px-1 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
        Loading profile…
      </p>
    )
  }
  if (status === 'signedOut' || !profile) return <Navigate to="/signin" replace />

  return (
    <div className="mx-auto max-w-md space-y-4">
      <section className="liquid-glass-panel rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-3.5">
          <Avatar name={profile.username} className="h-12 w-12 text-[17px]" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[19px] font-extrabold text-white">{profile.username}</p>
            <p className="truncate text-[13px] text-white/45">{profile.email}</p>
          </div>
        </div>

        {profile.isModerator && (
          <p className="mt-4 flex items-center gap-2 rounded-xl border border-brand-500/30 bg-brand-500/15 px-3.5 py-2.5 text-brand-300">
            <Shield size={13} aria-hidden="true" />
            <span className="font-mono text-[10px] font-bold tracking-wider uppercase">
              Moderator
            </span>
          </p>
        )}
      </section>

      <section className="liquid-glass-panel rounded-3xl p-5">
        <h2 className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
          Your ventures
        </h2>
        <p className="mt-2 text-[14px] leading-relaxed text-white/45">
          Listing a venture arrives in Step 3. Once it does, anything you list shows up here.
        </p>
      </section>

      <div className="text-center">
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut size={13} aria-hidden="true" />
          Sign out
        </Button>
      </div>
    </div>
  )
}
