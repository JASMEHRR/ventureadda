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

/**
 * Every account, for the moderator panel. The rules let any signed-in user
 * read this collection (usernames have to be resolvable next to chat messages),
 * so this needs no extra permission — the panel itself is what is gated.
 *
 * ponytail: one unpaginated read of the whole collection. Fine at campus
 * scale; add a limit + startAfter cursor if this ever grows past a few hundred.
 */
export async function listUsers(): Promise<ModeratorCandidate[]> {
  const snapshot = await getDocs(collection(db, 'users'))
  return snapshot.docs
    .map((entry) => {
      const data = entry.data()
      return {
        uid: entry.id,
        username: data.username ?? '',
        email: data.email ?? '',
        isModerator: data.isModerator === true,
      }
    })
    .sort((a, b) => a.username.localeCompare(b.username))
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

/**
 * Removes an account entirely: the sign-in credential and the profile.
 *
 * Goes through api/delete-user rather than writing here, because deleting the
 * Firestore document is the easy half and the useless half — the Firebase Auth
 * account would survive it, the person would sign in again, and the app would
 * provision them a fresh profile. Only a service account can delete a
 * credential, so only the server can actually remove somebody.
 *
 * The username claim is deliberately left behind. firestore.rules refuses to
 * release one so a name cannot be reused to impersonate whoever held it, and
 * that matters more once the account is gone, not less: the reviews and
 * messages signed with it are still on the site.
 */
export async function deleteUserAccount(idToken: string, uid: string): Promise<void> {
  const response = await fetch('/api/delete-user', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ idToken, uid }),
  })
  if (response.ok) return

  const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
  if (body.code === 'not-configured') {
    throw new Error('Account removal is not switched on for this deployment.')
  }
  throw new Error(body.error ?? 'Could not remove that account.')
}
