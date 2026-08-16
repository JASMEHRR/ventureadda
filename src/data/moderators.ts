import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, updateDoc } from 'firebase/firestore'
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

export type ApprovedEmail = { email: string; moderator: boolean }

const approvedEmailsRef = collection(db, 'approvedEmails')

/**
 * Pre-approves an address before it has an account. Two things follow from a
 * document existing here at all: isThaparUser() in the rules treats it as
 * Thapar-equivalent (can post in chat, list a venture), and if `moderator` is
 * true, the account is promoted to moderator itself the moment it first signs
 * in — see AuthProvider's self-promotion effect.
 *
 * The document id is the lowercased address, same pattern as usernames: the
 * id alone enforces "one entry per address" without a query.
 */
export async function approveEmail(email: string, moderator: boolean): Promise<void> {
  const key = email.trim().toLowerCase()
  if (!key) throw new Error('Enter an email address.')
  await setDoc(doc(approvedEmailsRef, key), { moderator })
}

export async function revokeApprovedEmail(email: string): Promise<void> {
  await deleteDoc(doc(approvedEmailsRef, email.trim().toLowerCase()))
}

/** Moderator-only, per the rules — the panel that manages this list. */
export async function listApprovedEmails(): Promise<ApprovedEmail[]> {
  const snapshot = await getDocs(approvedEmailsRef)
  return snapshot.docs
    .map((entry) => ({ email: entry.id, moderator: entry.data().moderator === true }))
    .sort((a, b) => a.email.localeCompare(b.email))
}
