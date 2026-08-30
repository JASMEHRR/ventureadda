import { useCallback, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Avatar from './ui/Avatar'
import Button from './ui/Button'
import Modal from './ui/Modal'
import Textarea from './ui/Textarea'
import LoadingLine from './ui/LoadingLine'
import ChooseUsername from '../pages/ChooseUsername'
import { StarDisplay, StarInput } from './ui/StarRating'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { MAX_COMMENT_LENGTH, deleteReview, listReviews, saveReview, summarise } from '../data/reviews'
import type { Review } from '../data/reviews'

function dateLabel(date: Date | null): string {
  if (!date) return 'just now'
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ReviewSection({
  ventureId,
  ownerId,
}: {
  ventureId: string
  ownerId: string
}) {
  const { profile, status, needsUsername } = useAuth()
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Review | null>(null)
  const [rating, setRating] = useState(0)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)

  const reviews = useAsyncData(() => listReviews(ventureId), [ventureId, refreshToken])
  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])

  const all = reviews.data ?? []
  const summary = summarise(all)
  const mine = profile ? all.find((review) => review.userId === profile.uid) : undefined
  const isOwner = profile?.uid === ownerId

  // Load an existing review into the form the first time it is opened, so
  // revising starts from what was actually said rather than a blank slate.
  const beginEditing = () => {
    if (mine && !started) {
      setRating(mine.rating)
      setComment(mine.comment)
    }
    setStarted(true)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    setError(null)
    if (rating === 0) {
      setError('Pick a rating first.')
      return
    }
    setBusy(true)
    try {
      await saveReview(ventureId, { uid: profile.uid, username: profile.username }, rating, comment)
      setStarted(false)
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your review.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-baseline justify-between gap-3 px-1">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Reviews
        </h2>
        {summary.count > 0 && (
          <span className="flex items-center gap-2">
            <StarDisplay value={summary.average} />
            <span className="font-mono text-[15px] font-bold text-white">
              {summary.average.toFixed(1)}
            </span>
            <span className="font-mono text-[13px] text-white/55">
              {summary.count} {summary.count === 1 ? 'review' : 'reviews'}
            </span>
          </span>
        )}
      </header>

      {/* Owners cannot review their own venture — the rules refuse it, and
          saying so here is friendlier than a permission error. */}
      {isOwner && (
        <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] text-white/60">
          This is your venture, so you cannot review it.
        </p>
      )}

      {/* Reviewing is open to any signed-in account, Thapar or not — the rules
          gate it on isVerifiedUser, not isThaparUser. The name is claimed here
          rather than at sign-up, because this is the first place it is shown. */}
      {!isOwner && status === 'ready' && needsUsername && (
        <ChooseUsername reason="This is the name shown next to your review." />
      )}

      {!isOwner && status === 'ready' && profile && (
        <div className="liquid-glass-panel rounded-2xl p-5">
          {!started ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[16.5px] font-bold text-white">
                  {mine ? 'You reviewed this' : 'Been here? Say how it went.'}
                </p>
                {mine && (
                  <span className="mt-1 flex items-center gap-2">
                    <StarDisplay value={mine.rating} size={12} />
                    <span className="text-[15.5px] text-white/60">{mine.comment || 'No comment'}</span>
                  </span>
                )}
              </div>
              <Button variant="secondary" onClick={beginEditing}>
                {mine ? 'Change it' : 'Write a review'}
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <span className="mb-1.5 block font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/60 uppercase">
                  Your rating
                </span>
                <StarInput value={rating} onChange={setRating} />
              </div>

              <Textarea
                id="review-comment"
                label="Comment"
                maxLength={MAX_COMMENT_LENGTH}
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Was it good? Did it turn up on time?"
                error={error ?? undefined}
              />

              <div className="flex flex-wrap gap-2.5">
                <Button type="submit" variant="primary" loading={busy}>
                  {mine ? 'Save changes' : 'Post review'}
                </Button>
                <Button type="button" variant="ghost" onClick={() => setStarted(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </div>
      )}

      {!isOwner && status !== 'loading' && !profile && (
        <div className="liquid-glass-panel flex flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5">
          <p className="text-[16px] text-white/50">Sign in to leave a review. Any account works.</p>
          <Button variant="secondary" to="/signin">
            Sign in
          </Button>
        </div>
      )}

      {reviews.error && (
        <p className="liquid-glass-panel rounded-2xl px-5 py-4 text-[16px] text-red-400">
          Could not load reviews: {reviews.error.message}
        </p>
      )}

      {!reviews.data && !reviews.error && (
        <LoadingLine label="Loading reviews…" inset={false} />
      )}

      {reviews.data && all.length === 0 && (
        <p className="liquid-glass-panel rounded-2xl px-5 py-6 text-center text-[16px] text-white/60">
          No reviews yet.
        </p>
      )}

      <div className="space-y-2.5">
        {all.map((review) => (
          <article key={review.id} className="liquid-glass-panel rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Avatar name={review.username} />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
                  <span className="text-[16px] font-bold text-white">{review.username}</span>
                  {!review.deleted && <StarDisplay value={review.rating} size={11} />}
                  <time className="font-mono text-[13px] tracking-wider text-white/55">
                    {dateLabel(review.createdAt)}
                  </time>
                </div>
                {review.deleted ? (
                  <p className="mt-1 text-[16px] text-white/50 italic">
                    Review removed by a moderator
                  </p>
                ) : (
                  review.comment && (
                    <p className="mt-1 text-[16px] leading-relaxed break-words text-white/70">
                      {review.comment}
                    </p>
                  )
                )}
              </div>

              {profile?.isModerator && !review.deleted && (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(review)}
                  aria-label={`Remove review from ${review.username}`}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/55 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                >
                  <Trash2 size={13} aria-hidden="true" />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove this review?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = confirmDelete
                if (!target) return
                setConfirmDelete(null)
                void deleteReview(target.id).then(refresh)
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-[16px] leading-relaxed text-white/70">
          The comment is erased, not hidden, and the star rating stops counting toward the average —
          otherwise removing a malicious one-star would take the words and leave the damage. Who
          wrote it and when stays visible to you.
        </p>
      </Modal>
    </section>
  )
}
