import { getAccessToken, readServiceAccount } from '../server/googleAuth'
import type { ServiceAccount } from '../server/googleAuth'
import { verifyFirebaseToken } from '../server/verifyToken'

/**
 * Removes an account, for a moderator.
 *
 * WHY A SERVER FUNCTION. Deleting the Firestore document is something the
 * rules already let a moderator do, and on its own it is worse than useless:
 * the Firebase Auth account survives, so the person signs in again and the app
 * — finding no profile — provisions them a fresh one. Removing somebody means
 * removing the credential, and only a service account can do that.
 *
 * WHAT IT REFUSES, AND WHY EACH ONE. The owner, because an account that can
 * delete the account that grants moderators is an account that can lock
 * everybody out permanently. Yourself, because the same tap would end the
 * session performing it and leave the job half done. And anybody who still
 * owns listings, because deleting them would leave ventures on the directory
 * with a seller who no longer exists — the moderator is told the count and
 * asked to deal with the listings first. That is a deliberate refusal rather
 * than a cascade: a cascade here would delete a real shopfront on the strength
 * of one tap, and this endpoint has no undo.
 *
 * THE USERNAME CLAIM IS KEPT. firestore.rules refuses update and delete on one
 * so a released name can never be used to impersonate whoever held it, and
 * that reasoning does not weaken because the account is gone — it strengthens,
 * since the reviews and messages signed with that name are still on the site.
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

async function readUser(
  account: ServiceAccount,
  token: string,
  uid: string,
): Promise<Fields | null> {
  const response = await fetch(documents(account, `users/${uid}`), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  return ((await response.json()) as { fields?: Fields }).fields ?? null
}

/** How many listings this account still owns. A structured query, because the
 *  REST list endpoint cannot filter. */
async function countVentures(
  account: ServiceAccount,
  token: string,
  uid: string,
): Promise<number> {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents:runQuery`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'ventures' }],
          where: {
            fieldFilter: {
              field: { fieldPath: 'ownerId' },
              op: 'EQUAL',
              value: { stringValue: uid },
            },
          },
          limit: 50,
        },
      }),
    },
  )
  if (!response.ok) return 0
  const rows = (await response.json()) as { document?: unknown }[]
  return rows.filter((row) => row.document).length
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const account = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!account) {
    return json({ error: 'Account removal is not configured here.', code: 'not-configured' }, 501)
  }
  const ownerEmail = (process.env.VITE_OWNER_EMAIL ?? 'jasmehr2005@gmail.com').toLowerCase()

  let payload: { idToken?: string; uid?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }
  if (!payload.idToken || !payload.uid) return json({ error: 'Missing token or account.' }, 400)

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

  // Moderator status is read from the database rather than taken from the
  // request, for the obvious reason: the request is written by the caller.
  const callerRecord = await readUser(account, firestore, caller.uid)
  const callerIsModerator =
    callerRecord?.isModerator?.booleanValue === true || caller.email.toLowerCase() === ownerEmail
  if (!callerIsModerator) return json({ error: 'Moderators only.' }, 403)

  if (payload.uid === caller.uid) {
    return json({ error: 'You cannot remove your own account from here.' }, 400)
  }

  const target = await readUser(account, firestore, payload.uid)
  if (!target) return json({ error: 'No such account.' }, 404)

  const targetEmail = (target.email?.stringValue as string | undefined)?.toLowerCase() ?? ''
  if (targetEmail === ownerEmail) return json({ error: 'The owner cannot be removed.' }, 403)

  const ventures = await countVentures(account, firestore, payload.uid)
  if (ventures > 0) {
    return json(
      {
        error: `That account still owns ${ventures} listing${ventures === 1 ? '' : 's'}. Remove or reassign ${ventures === 1 ? 'it' : 'them'} first.`,
        code: 'has-ventures',
        ventures,
      },
      409,
    )
  }

  // The credential first. If the document went first and this failed, the
  // account would be signed-in-able with no profile, which the app treats as a
  // brand new user and provisions afresh — the exact opposite of removal.
  const identity = await getAccessToken(account, IDENTITY_SCOPE)
  const deleted = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}/accounts:delete`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${identity}`, 'content-type': 'application/json' },
      body: JSON.stringify({ localId: payload.uid }),
    },
  )
  // A 404 here means the credential is already gone — which is the state being
  // aimed at, so the document cleanup below should still run.
  if (!deleted.ok && deleted.status !== 404) {
    return json({ error: 'Could not remove that sign-in. Try again.' }, 502)
  }

  const removed = await fetch(documents(account, `users/${payload.uid}`), {
    method: 'DELETE',
    headers: { authorization: `Bearer ${firestore}` },
  })
  if (!removed.ok && removed.status !== 404) {
    return json({ error: 'Sign-in removed, but the profile could not be deleted.' }, 502)
  }

  return json({ ok: true }, 200)
}
