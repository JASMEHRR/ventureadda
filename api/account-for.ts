import { getAccessToken, readServiceAccount } from '../server/googleAuth'
import type { ServiceAccount } from '../server/googleAuth'
import { verifyFirebaseToken } from '../server/verifyToken'
import { slugify } from '../src/data/slug'

/**
 * Finds or makes the account a venture will belong to, for a moderator
 * listing on somebody else's behalf.
 *
 * THE SITUATION THIS IS FOR. Friends say "list ours for us, we will sort our
 * account out later". Without this the only ways to do that are to sign in as
 * them — which means having their password, and is a bad habit to build — or
 * to file their shop under the moderator's own name, which puts the wrong
 * person on the listing and makes handing it over later a migration.
 *
 * So the account is created up front, empty, owned by nobody in particular:
 * an address with a profile and a username and no way to sign in yet. The
 * venture is filed against it from the start, so the listing is theirs before
 * they have ever opened the site.
 *
 * HANDOVER NEEDS NO STEP. Firebase matches accounts by address when the
 * project is set to one account per address, which is the default. The day
 * they sign in with Google on that same address, Google is attached to the
 * account that is already there — with their venture, their username and
 * their orders already on it. Nothing is migrated and nothing is claimed.
 *
 * NO PASSWORD IS SET AND NO MAIL IS SENT. A password would be one the
 * moderator knows, which is the thing being avoided; mail is the quota that
 * keeps running out. The account simply waits.
 *
 * MODERATORS ONLY, checked against the database rather than the request.
 *
 * RUNTIME. Edge, matching the other functions here.
 */
export const config = { runtime: 'edge' }

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const IDENTITY_SCOPE =
  'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase'

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type Fields = Record<string, Record<string, unknown>>

function documents(account: ServiceAccount, path: string): string {
  return `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/${path}`
}

async function readDocument(
  account: ServiceAccount,
  token: string,
  path: string,
): Promise<Fields | null> {
  const response = await fetch(documents(account, path), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return ((await response.json()) as { fields?: Fields }).fields ?? null
}

/**
 * A free username derived from the address, the same way the app derives one
 * for somebody signing in — so an account made this way is indistinguishable
 * from one made normally.
 *
 * `slugify` rather than the client's own helper because it is already shared,
 * Firebase-free and tested; the underscores a username allows are a superset
 * of what it emits, so everything it returns is a legal username.
 */
async function freeUsername(
  account: ServiceAccount,
  token: string,
  email: string,
): Promise<string> {
  const base = slugify(email.split('@')[0] ?? '').replace(/-/g, '_').slice(0, 20) || 'seller'
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(attempt + 1)
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`
    const taken = await readDocument(account, token, `usernames/${candidate.toLowerCase()}`)
    if (!taken) return candidate
  }
  return `${base.slice(0, 14)}${Date.now().toString().slice(-5)}`
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const account = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!account) {
    return json({ error: 'Listing for others is not configured here.', code: 'not-configured' }, 501)
  }
  const ownerEmail = (process.env.VITE_OWNER_EMAIL ?? 'jasmehr2005@gmail.com').toLowerCase()

  let payload: { idToken?: string; email?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }
  if (!payload.idToken || !payload.email) return json({ error: 'Missing token or address.' }, 400)

  let caller
  try {
    caller = await verifyFirebaseToken(payload.idToken, {
      projectId: account.project_id,
      audience: { kind: 'anyVerifiedAccount' },
    })
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Not signed in.' }, 401)
  }

  const firestore = await getAccessToken(account, FIRESTORE_SCOPE)
  const callerRecord = await readDocument(account, firestore, `users/${caller.uid}`)
  const isModerator =
    callerRecord?.isModerator?.booleanValue === true || caller.email.toLowerCase() === ownerEmail
  if (!isModerator) return json({ error: 'Moderators only.' }, 403)

  const email = payload.email.trim().toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return json({ error: 'That does not look like an email address.' }, 400)
  }

  const identity = await getAccessToken(account, IDENTITY_SCOPE)
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}`
  const headers = { authorization: `Bearer ${identity}`, 'content-type': 'application/json' }

  // An address that already has an account keeps it, profile and all. This
  // endpoint is "who owns this listing", not "make a new person".
  const lookup = await fetch(`${base}/accounts:lookup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: [email] }),
  })
  let uid = lookup.ok
    ? ((await lookup.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId
    : undefined

  if (!uid) {
    const created = await fetch(`${base}/accounts`, {
      method: 'POST',
      headers,
      // No password: one the moderator knows is exactly what this exists to
      // avoid. Not marked verified either — nobody has proved anything yet;
      // this is a placeholder waiting for its owner.
      body: JSON.stringify({ email, emailVerified: false }),
    })
    if (!created.ok) return json({ error: 'Could not create that account.' }, 502)
    uid = ((await created.json()) as { localId?: string }).localId
  }
  if (!uid) return json({ error: 'Could not create that account.' }, 502)

  // A profile may already exist — they may have signed in themselves. Keep it.
  const existing = await readDocument(account, firestore, `users/${uid}`)
  const existingName = existing?.username?.stringValue as string | undefined
  if (existingName) return json({ uid, username: existingName, created: false }, 200)

  const username = await freeUsername(account, firestore, email)

  const profile = await fetch(documents(account, `users/${uid}`), {
    method: 'PATCH',
    headers: { authorization: `Bearer ${firestore}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      fields: {
        uid: { stringValue: uid },
        email: { stringValue: email },
        username: { stringValue: username },
        // Never true from here. Listing on somebody's behalf says nothing
        // about whether they should moderate.
        isModerator: { booleanValue: false },
        avatar: { stringValue: 'initial' },
        createdAt: { timestampValue: new Date().toISOString() },
        createdBy: { stringValue: caller.email.toLowerCase() },
      },
    }),
  })
  if (!profile.ok) return json({ error: 'Could not create that profile.' }, 502)

  // The claim, so nobody else can take the name later. Best effort: a venture
  // filed under a real profile is the point, and a missing claim costs a name
  // rather than the listing.
  await fetch(documents(account, `usernames/${username.toLowerCase()}`), {
    method: 'PATCH',
    headers: { authorization: `Bearer ${firestore}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields: { uid: { stringValue: uid } } }),
  }).catch(() => {})

  return json({ uid, username, created: true }, 200)
}
