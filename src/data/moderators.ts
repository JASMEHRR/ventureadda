import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'

export type ModeratorCandidate = {
  uid: string
  username: string
  email: string
  isModerator: boolean
}

/**
 * Resolves a username to the account behind it, the same way sign-in resolves
 * one to a uid: usernames/{lowercased username} -> uid, then users/{uid} for
 * the rest. Returns null for "no such username" rather than throwing — that
 * is the ordinary answer to a typo, not a fault.
 */
export async function findUserByUsername(username: string): Promise<ModeratorCandidate | null> {
  const key = username.trim().toLowerCase()
  if (!key) return null

  const usernameSnap = await getDoc(doc(db, 'usernames', key))
  if (!usernameSnap.exists()) return null
  const uid = usernameSnap.data().uid as string

  const userSnap = await getDoc(doc(db, 'users', uid))
  if (!userSnap.exists()) return null
  const data = userSnap.data()

  return {
    uid,
    username: data.username ?? username,
    email: data.email ?? '',
    isModerator: data.isModerator === true,
  }
}

/**
 * Grants or revokes moderator status. The rules restrict this write to the
 * site owner and to exactly this one field — see firestore.rules on
 * users/{uid}, which is the actual enforcement; this is just the call site.
 */
export async function setModerator(uid: string, isModerator: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), { isModerator })
}
