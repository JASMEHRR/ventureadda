import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import type { Timestamp } from 'firebase/firestore'
import { db } from '../lib/firebase'

export type ChatMessage = {
  id: string
  userId: string
  username: string
  text: string
  /** Null for the moment between a local echo and the server stamping it. */
  createdAt: Date | null
  deleted: boolean
}

const messagesRef = collection(db, 'chatMessages')

/** Matches the cap in firestore.rules. */
export const MAX_MESSAGE_LENGTH = 1000

/**
 * How many messages the room holds.
 *
 * A single shared room grows without bound, and every open would otherwise
 * read the entire history — on Spark that is a real quota cost and on a phone
 * it is a real page weight. Older messages are still in Firestore; they are
 * just not loaded.
 */
const WINDOW = 100

/**
 * Live subscription to the room.
 *
 * Ordered newest-first so the limit takes the most recent hundred rather than
 * the oldest, then reversed for display, because the room reads bottom-up.
 * Single-field ordering, so no composite index is needed.
 */
export function subscribeToMessages(
  onChange: (messages: ChatMessage[]) => void,
  onError: (error: Error) => void,
): () => void {
  return onSnapshot(
    query(messagesRef, orderBy('createdAt', 'desc'), limit(WINDOW)),
    (snapshot) => {
      const messages = snapshot.docs.map((document) => {
        const data = document.data()
        const stamp = data.createdAt as Timestamp | null
        return {
          id: document.id,
          userId: data.userId ?? '',
          username: data.username ?? 'someone',
          text: data.text ?? '',
          createdAt: stamp?.toDate ? stamp.toDate() : null,
          deleted: data.deleted === true,
        }
      })
      onChange(messages.reverse())
    },
    (cause) => onError(cause instanceof Error ? cause : new Error(String(cause))),
  )
}

export async function sendMessage(
  author: { uid: string; username: string },
  text: string,
): Promise<void> {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Type something first.')
  if (trimmed.length > MAX_MESSAGE_LENGTH) {
    throw new Error(`Keep it under ${MAX_MESSAGE_LENGTH} characters.`)
  }
  await addDoc(messagesRef, {
    userId: author.uid,
    username: author.username,
    text: trimmed,
    deleted: false,
    // The rules require exactly this; a client clock could be backdated.
    createdAt: serverTimestamp(),
  })
}

/**
 * Moderator removal.
 *
 * Blanks the text in the same write that sets the flag. Leaving the text in
 * place behind a flag would mean the message is still readable straight from
 * Firestore, so the button would look like it worked without doing anything
 * that matters.
 */
export async function deleteMessage(messageId: string): Promise<void> {
  await updateDoc(doc(messagesRef, messageId), { deleted: true, text: '' })
}
