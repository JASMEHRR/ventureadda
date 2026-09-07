import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { AlertTriangle, Plus, Store, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import InviteSellers from '../components/InviteSellers'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import Modal from '../components/ui/Modal'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { deleteVenture, listMenuItems, listVenturesForUser, touchVenture } from '../data/ventures'
import PushToggle from '../components/PushToggle'
import { STALE_DAYS, ago, daysSince } from '../data/freshness'
import type { Venture } from '../data/ventures'
import { categoryName } from '../data/types'

/**
 * Manage your listings.
 *
 * Moved out of the profile page, where it was a section under the account
 * card. Profile is "who am I signed in as, and how do I sign out"; this is a
 * seller's workbench — status, rejection reasons, the missing-menu warning,
 * edit and delete — and it earns a tab of its own in the sidebar rather than
 * being something you find by scrolling your own profile.
 *
 * The behaviour is unchanged from that section, including the two rules worth
 * repeating: a live listing has no delete button, because people have found it
 * and may have messaged about it, so taking one down is a moderator
 * conversation; and a venture with no menu items gets a warning, because
 * createVenture commits the venture first and the menu second, so a dropped
 * connection leaves a listing with nothing to tap.
 */

const STATUS_STYLE: Record<string, string> = {
  live: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  rejected: 'border-red-500/30 bg-red-500/15 text-red-400',
}

export default function MyVentures() {
  const { profile, status, canPost, user } = useAuth()
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Venture | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  /** Confirmed in this session, so the row stops asking before the refetch. */
  const [confirmed, setConfirmed] = useState<string[]>([])
  const [confirming, setConfirming] = useState<string | null>(null)
  /** Deleted this session, so the list can drop them before the refetch lands. */
  const [removed, setRemoved] = useState<string[]>([])

  const mine = useAsyncData(
    () => (profile ? listVenturesForUser(profile.uid, user?.email) : Promise.resolve([])),
    [profile?.uid, user?.email, refreshToken],
  )

  const itemCounts = useAsyncData(async () => {
    const ventures = mine.data ?? []
    const counts: Record<string, number> = {}
    for (const venture of ventures) {
      counts[venture.id] = (await listMenuItems(venture.id)).length
    }
    return counts
  }, [mine.data])

  if (status === 'loading') return <LoadingLine label="Loading your ventures…" />
  if (status === 'signedOut') return <Navigate to="/signin" replace />
  if (!profile) {
    return <ChooseUsername reason="Your listings are filed under a name, so pick one first." />
  }

  const listed = (mine.data ?? []).filter((venture) => !removed.includes(venture.id))

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

  /**
   * "Still right" — one tap, one field.
   *
   * Optimistic: the row stops asking the moment it is pressed, because the
   * only thing worse than a nudge is a nudge that stays on screen after you
   * have answered it. A failure puts it back with the reason.
   */
  const confirmFresh = async (id: string) => {
    setConfirming(id)
    setDeleteError(null)
    try {
      await touchVenture(id)
      setConfirmed((prev) => [...prev, id])
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : 'Could not save that. Try again in a moment.',
      )
    } finally {
      setConfirming(null)
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="liquid-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-3xl px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Your ventures
          </h2>
          <p className="mt-2 text-[16px] leading-relaxed text-white/50">
            Everything you have submitted, live or waiting for approval.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Somebody who has already listed one is the likeliest person to
              know the next seller, so the ask lives where they already are. */}
          <InviteSellers subtle />
          {canPost && (
            <Button to="/add">
              <Plus size={13} aria-hidden="true" />
              Add venture
            </Button>
          )}
        </div>
      </header>

      {mine.error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-4 text-[16px] text-red-400">
          Could not load your ventures: {mine.error.message}
        </p>
      )}

      {!mine.data && !mine.error && <LoadingLine label="Loading your ventures…" />}

      {/* THE PROMPT LIVES WHERE THE SELLER IS. Push has worked for a while and
          almost nobody has it on, because the only two places offering it were
          Settings and the orders page — one that sellers open once, and one
          they only open after they already know an order exists. This is the
          page they come back to. It renders nothing at all on a deployment
          with no push key and on a browser that cannot receive push, and it
          never asks for permission on its own — see PushToggle. */}
      {mine.data && listed.length > 0 && <PushToggle uid={profile.uid} />}

      {mine.data && listed.length === 0 && (
        <EmptyState
          icon={Store}
          title="Nothing listed yet"
          action={
            canPost && (
              <Button to="/add">
                <Plus size={13} aria-hidden="true" />
                List your venture
              </Button>
            )
          }
        >
          {canPost
            ? 'Anything you submit shows up here, including while it waits for approval.'
            : 'Listing needs a Thapar address, or an invite from the owner.'}
        </EmptyState>
      )}

      {listed.length > 0 && (
        <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
          {listed.map((venture) => (
            <div
              key={venture.id}
              className="flex flex-wrap items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-[17px] font-bold text-white">{venture.name}</p>
                <p className="truncate text-[15px] text-white/60">
                  {categoryName(venture.categoryId)}
                  {/* This list is no longer only your own listings: it is
                      everything you can edit, and a shop somebody added you to
                      behaves differently — no delete, and the co-owner list is
                      theirs to change, not yours. Saying so here is cheaper
                      than letting them find out at the button. */}
                  {venture.ownerId !== profile.uid && ' — you are a co-owner'}
                </p>
                {venture.status === 'rejected' && venture.rejectionReason && (
                  <p className="mt-1 text-[15px] text-red-400">{venture.rejectionReason}</p>
                )}
                {itemCounts.data?.[venture.id] === 0 && (
                  <p className="mt-1 flex items-center gap-1.5 text-[15px] text-amber-400">
                    <AlertTriangle size={11} aria-hidden="true" className="shrink-0" />
                    No items yet — add them so buyers have something to tap.
                  </p>
                )}

                {/* THE STALENESS QUESTION, asked once and answerable in a tap.
                    A seller who has stopped selling is the one who never comes
                    back to mark anything sold out, so the menu keeps offering
                    what is not there. Only on live listings: a pending one is
                    waiting on a moderator, not on its owner. */}
                {(() => {
                  const at = venture.updatedAt
                  if (!at || venture.status !== 'live') return null
                  const days = daysSince(at)
                  if (confirmed.includes(venture.id)) {
                    return (
                      <p className="mt-1 text-[15px] text-white/55">Updated just now. Thanks.</p>
                    )
                  }
                  if (days < STALE_DAYS) {
                    return <p className="mt-1 text-[15px] text-white/55">Updated {ago(days)}</p>
                  }
                  return (
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px] text-amber-400">
                      <AlertTriangle size={11} aria-hidden="true" className="shrink-0" />
                      Not touched since {ago(days)}. Is the menu still right?
                      <button
                        type="button"
                        onClick={() => void confirmFresh(venture.id)}
                        disabled={confirming === venture.id}
                        className="rounded-lg border border-amber-500/30 bg-amber-500/15 px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-wider text-amber-300 uppercase transition duration-150 hover:bg-amber-500/25 active:scale-[0.96] disabled:opacity-50"
                      >
                        {confirming === venture.id ? 'Saving' : 'Still right'}
                      </button>
                    </p>
                  )
                })()}
              </div>
              <span
                className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-wider uppercase ${
                  STATUS_STYLE[venture.status] ?? STATUS_STYLE.pending
                }`}
              >
                {venture.status}
              </span>
              <Link
                to={`/venture/${venture.id}`}
                className="shrink-0 font-mono text-[13px] tracking-wider text-white/60 uppercase transition hover:text-white"
              >
                View
              </Link>
              <Link
                to={`/venture/${venture.id}/edit`}
                className="shrink-0 font-mono text-[13px] tracking-wider text-white/60 uppercase transition hover:text-white"
              >
                Edit
              </Link>
              {/* Only while it is not live. A live listing is something people
                  have found and may have messaged, so taking it down is a
                  moderator conversation rather than a button next to Edit. */}
              {venture.status !== 'live' && venture.ownerId === profile.uid && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(venture)}
                  aria-label={`Delete ${venture.name}`}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          ))}

          {notice && (
            <p role="status" className="text-[16px] text-white/55">
              {notice}
            </p>
          )}
        </section>
      )}

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
        <p className="text-[16px] leading-relaxed text-white/70">
          This removes the listing and everything on its menu. It cannot be undone, and the
          moderators will not see it in the queue any more.
        </p>
        {deleteError && (
          <p role="alert" className="mt-3 text-[16px] text-red-400">
            {deleteError}
          </p>
        )}
      </Modal>
    </div>
  )
}
