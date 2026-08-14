import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, LogOut, Plus, Shield } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { listMenuItems, listVenturesByOwner } from '../data/ventures'
import { categoryName } from '../data/types'

const STATUS_STYLE: Record<string, string> = {
  live: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  rejected: 'border-red-500/30 bg-red-500/15 text-red-400',
}

export default function Profile() {
  const { profile, status, signOut } = useAuth()
  const mine = useAsyncData(
    () => (profile ? listVenturesByOwner(profile.uid) : Promise.resolve([])),
    [profile?.uid],
  )

  /**
   * How many items each of your ventures has.
   *
   * This exists because createVenture is no longer atomic: the venture is
   * committed first and the menu follows, so a connection dropping in between
   * leaves a venture with nothing to tap. That is a fair trade only if the
   * result is visible to the person who can fix it, which is here.
   */
  const itemCounts = useAsyncData(async () => {
    const ventures = mine.data ?? []
    const counts: Record<string, number> = {}
    for (const venture of ventures) {
      counts[venture.id] = (await listMenuItems(venture.id)).length
    }
    return counts
  }, [mine.data])

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading profile…" />
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

      <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
            Your ventures
          </h2>
          <Link
            to="/add"
            className="flex items-center gap-1.5 font-mono text-[10px] font-bold tracking-wider text-brand-400 uppercase transition hover:text-brand-300"
          >
            <Plus size={12} aria-hidden="true" />
            Add
          </Link>
        </div>

        {mine.error && (
          <p role="alert" className="text-[14px] text-red-400">
            Could not load your ventures: {mine.error.message}
          </p>
        )}

        {!mine.data && !mine.error && <LoadingLine label="Loading your ventures…" inset={false} />}

        {mine.data?.length === 0 && (
          <p className="text-[14px] leading-relaxed text-white/45">
            You have not listed anything yet. Anything you submit shows up here, including while it
            is waiting for approval.
          </p>
        )}

        {mine.data?.map((venture) => (
          <div
            key={venture.id}
            className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-bold text-white">{venture.name}</p>
              <p className="truncate text-[12.5px] text-white/40">
                {categoryName(venture.categoryId)}
              </p>
              {venture.status === 'rejected' && venture.rejectionReason && (
                <p className="mt-1 text-[12.5px] text-red-400">{venture.rejectionReason}</p>
              )}
              {itemCounts.data?.[venture.id] === 0 && (
                <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-amber-400">
                  <AlertTriangle size={11} aria-hidden="true" className="shrink-0" />
                  No items yet — add them so buyers have something to tap.
                </p>
              )}
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider uppercase ${
                STATUS_STYLE[venture.status] ?? STATUS_STYLE.pending
              }`}
            >
              {venture.status}
            </span>
            <Link
              to={`/venture/${venture.id}/edit`}
              className="shrink-0 font-mono text-[10px] tracking-wider text-white/40 uppercase transition hover:text-white"
            >
              Edit
            </Link>
          </div>
        ))}
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
