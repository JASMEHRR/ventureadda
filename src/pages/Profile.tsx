import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, ClipboardList, LogOut, Plus, Shield, Trash2 } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import LoadingLine from '../components/ui/LoadingLine'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { deleteVenture, listMenuItems, listVenturesByOwner } from '../data/ventures'
import { countUnseenOrders } from '../data/orders'
import type { Venture } from '../data/ventures'
import { categoryName } from '../data/types'

const STATUS_STYLE: Record<string, string> = {
  live: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  rejected: 'border-red-500/30 bg-red-500/15 text-red-400',
}

export default function Profile() {
  const { profile, status, signOut } = useAuth()
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Venture | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  /** Deleted this session, so the list can drop them before the refetch lands. */
  const [removed, setRemoved] = useState<string[]>([])

  const mine = useAsyncData(
    () => (profile ? listVenturesByOwner(profile.uid) : Promise.resolve([])),
    [profile?.uid, refreshToken],
  )

  /**
   * How many items each of your ventures has.
   *
   * This exists because createVenture is no longer atomic: the venture is
   * committed first and the menu follows, so a connection dropping in between
   * leaves a venture with nothing to tap. That is a fair trade only if the
   * result is visible to the person who can fix it, which is here.
   */
  const unseen = useAsyncData(
    () => (profile ? countUnseenOrders(profile.uid) : Promise.resolve(0)),
    [profile?.uid, refreshToken],
  )

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

  /**
   * Deletes the venture in the confirm dialog, menu included.
   *
   * The rules allow this to the owner directly, so there is no moderator step:
   * a submission you have withdrawn, or one that came back rejected, is yours
   * to clear out.
   */
  const listed = (mine.data ?? []).filter((venture) => !removed.includes(venture.id))
  // Null while the count is still loading, which is not the same as zero — but
  // renders the same, and a badge that flickers in a moment late is correct.
  const unseenCount = unseen.data ?? 0

  const remove = async () => {
    const target = confirmDelete
    if (!target) return
    setBusy(true)
    setDeleteError(null)
    try {
      await deleteVenture(target.id)
      // Dropped from the list here rather than waiting for the refetch.
      // useAsyncData keeps the previous array on screen while it re-runs, so
      // without this the row it just deleted sits under "… deleted." with a
      // live Delete button — and a second press denies, because the rules read
      // ownerId off a document that is no longer there.
      setRemoved((prev) => [...prev, target.id])
      setConfirmDelete(null)
      setNotice(`${target.name} deleted.`)
      setRefreshToken((n) => n + 1)
    } catch (cause) {
      // Stays open, on the row it failed to delete. Closing on failure and
      // reporting it in the same grey line the success uses is a dialog that
      // lies about what happened.
      setDeleteError(cause instanceof Error ? cause.message : 'Could not delete that listing.')
    } finally {
      setBusy(false)
    }
  }

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

      {/* The only route to orders on a phone: the bottom bar is full at 390px
          and the sidebar that carries the Orders entry is hidden below md. */}
      {listed.length > 0 && (
        <Link
          to="/orders"
          className="liquid-glass-panel flex items-center gap-3.5 rounded-3xl p-5 transition duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
        >
          <ClipboardList size={18} className="shrink-0 text-brand-400" aria-hidden="true" />
          <span className="min-w-0 flex-1">
            <span className="block text-[15px] font-bold text-white">Orders</span>
            <span className="block text-[12.5px] text-white/45">
              {unseenCount > 0
                ? `${unseenCount} you have not opened`
                : 'What people have ordered'}
            </span>
          </span>
          {unseenCount > 0 && (
            <span className="shrink-0 rounded-full bg-brand-500/25 px-2.5 py-1 font-mono text-[11px] font-extrabold text-brand-300">
              {unseenCount > 99 ? '99+' : unseenCount}
            </span>
          )}
        </Link>
      )}

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

        {mine.data && listed.length === 0 && (
          <p className="text-[14px] leading-relaxed text-white/45">
            You have not listed anything yet. Anything you submit shows up here, including while it
            is waiting for approval.
          </p>
        )}

        {listed.map((venture) => (
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
            {/* Only while it is not live. A live listing is something people
                have found and may have messaged, so taking it down is a
                moderator conversation rather than a button next to Edit. */}
            {venture.status !== 'live' && (
              <button
                type="button"
                onClick={() => setConfirmDelete(venture)}
                aria-label={`Delete ${venture.name}`}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/40 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </div>
        ))}

        {notice && (
          <p role="status" className="text-[13.5px] text-white/55">
            {notice}
          </p>
        )}
      </section>

      <div className="text-center">
        <Button variant="secondary" onClick={() => void signOut()}>
          <LogOut size={13} aria-hidden="true" />
          Sign out
        </Button>
      </div>

      <Modal
        open={confirmDelete !== null}
        onClose={() => {
          setConfirmDelete(null)
          setDeleteError(null)
        }}
        title={`Delete ${confirmDelete?.name ?? ''}?`}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setConfirmDelete(null)
                setDeleteError(null)
              }}
            >
              Cancel
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-white/70">
          This removes the listing and everything on its menu. It cannot be undone, and the
          moderators will not see it in the queue any more.
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 text-[13.5px] text-red-400">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}
