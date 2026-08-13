import {
  collection,
  doc,
  getDocs,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import type { DocumentData, QueryDocumentSnapshot, Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export type Review = {
  id: string
  ventureId: string
  userId: string
  username: string
  rating: number
  comment: string
  createdAt: Date | null
  deleted: boolean
}

export type RatingSummary = {
  average: number
  count: number
}

const reviewsRef = collection(db, 'reviews')

export const MAX_COMMENT_LENGTH = 500

/**
 * One review per person per venture, enforced by the document id rather than
 * by remembering to check. The rules require this exact shape, so a second
 * review from the same person lands on the same document and is an edit.
 */
function reviewId(ventureId: string, userId: string): string {
  return `${ventureId}_${userId}`
}

function toReview(snapshot: QueryDocumentSnapshot<DocumentData>): Review {
  const data = snapshot.data()
  const stamp = data.createdAt as Timestamp | null
  return {
    id: snapshot.id,
    ventureId: data.ventureId ?? '',
    userId: data.userId ?? '',
    username: data.username ?? 'someone',
    rating: typeof data.rating === 'number' ? data.rating : 0,
    comment: data.comment ?? '',
    createdAt: stamp?.toDate ? stamp.toDate() : null,
    deleted: data.deleted === true,
  }
}

/**
 * Averages are computed from the reviews themselves rather than kept as a
 * running total on the venture.
 *
 * A denormalised sum would need its own write path on the venture document,
 * open to anyone signed in, and rules cannot check that a claimed delta
 * matches a real review — so a score could be moved without leaving anything
 * to delete. Computing from the source means the only way to shift a rating is
 * to leave a review that a moderator can remove, which is exactly the defence
 * the plan relies on. The cost is one collection read, which is nothing at
 * class size.
 */
export function summarise(reviews: Review[]): RatingSummary {
  const counted = reviews.filter((review) => !review.deleted)
  if (counted.length === 0) return { average: 0, count: 0 }
  const total = counted.reduce((sum, review) => sum + review.rating, 0)
  return { average: total / counted.length, count: counted.length }
}

export async function listReviews(ventureId: string): Promise<Review[]> {
  const snapshot = await getDocs(query(reviewsRef, where('ventureId', '==', ventureId)))
  return snapshot.docs
    .map(toReview)
    .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
}

/** Per-venture summaries for the browse grid, in one read. */
export async function listRatingSummaries(): Promise<Record<string, RatingSummary>> {
  const snapshot = await getDocs(reviewsRef)
  const byVenture: Record<string, Review[]> = {}
  for (const document of snapshot.docs) {
    const review = toReview(document)
    ;(byVenture[review.ventureId] ??= []).push(review)
  }
  const summaries: Record<string, RatingSummary> = {}
  for (const [ventureId, reviews] of Object.entries(byVenture)) {
    summaries[ventureId] = summarise(reviews)
  }
  return summaries
}

/**
 * Creates or revises a review. `setDoc` on the deterministic id is both, which
 * is why the rules allow the author an update path as well as a create.
 */
export async function saveReview(
  ventureId: string,
  author: { uid: string; username: string },
  rating: number,
  comment: string,
): Promise<void> {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Pick a rating from one to five stars.')
  }
  const trimmed = comment.trim()
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Keep the comment under ${MAX_COMMENT_LENGTH} characters.`)
  }
  await setDoc(doc(reviewsRef, reviewId(ventureId, author.uid)), {
    ventureId,
    userId: author.uid,
    username: author.username,
    rating,
    comment: trimmed,
    deleted: false,
    createdAt: serverTimestamp(),
  })
}

/**
 * Moderator removal.
 *
 * Blanks the comment in the same write that sets the flag, and `summarise`
 * drops flagged reviews from the average — so removing a malicious one-star
 * takes the score with the words rather than leaving the damage behind.
 */
export async function deleteReview(id: string): Promise<void> {
  await updateDoc(doc(reviewsRef, id), { deleted: true, comment: '' })
}
