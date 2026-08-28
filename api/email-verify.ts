import { getAccessToken, readServiceAccount, signJwt } from '../server/googleAuth'
import type { ServiceAccount } from '../server/googleAuth'

/**
 * Confirm your address on any device; finish signing in on the one you
 * started from.
 *
 * THE PROBLEM. A Firebase email link signs in whichever browser opens it. Type
 * your address on a phone, open the mail on a laptop, and you are now signed
 * in on the laptop — while the phone, the device you were actually using, sits
 * on the same screen it was on. Every later sign-in has the same shape, so
 * "check your email" becomes a permanent part of using the site.
 *
 * THE FIX is a challenge the two devices share. The phone asks this endpoint
 * to open one and gets back an unguessable id, which travels out in the
 * mailed link. Whichever device opens that link spends the code here — proving
 * the inbox — and the challenge is marked verified. The phone, polling, sees
 * that and moves straight to "set a password", then finishes with a custom
 * token minted here for the address that was proved. The laptop is never
 * signed in at all; it says "go back to the device you started on", which is
 * the honest instruction and the one people expect.
 *
 * WHY THE CODE IS SPENT SERVER-SIDE. `accounts:signInWithEmailLink` is the
 * same call the client SDK makes, and a 200 from it means the code was
 * genuine, unexpired, unspent, and minted for that exact address. Spending it
 * here also consumes it, so a link cannot be replayed by anyone who later gets
 * hold of the mail.
 *
 * WHAT AN ATTACKER WOULD NEED. The challenge id is 32 random bytes and never
 * leaves the device that opened it except inside the mailed link. Holding it
 * alone proves nothing: `finish` refuses a challenge that has not been
 * verified, and verifying one requires a code that only arrives in the
 * mailbox. Each challenge is single-use and expires in fifteen minutes.
 *
 * RUNTIME. Edge, matching the other functions here.
 */
export const config = { runtime: 'edge' }

const FIRESTORE_SCOPE = 'https://www.googleapis.com/auth/datastore'
const IDENTITY_SCOPE =
  'https://www.googleapis.com/auth/identitytoolkit https://www.googleapis.com/auth/firebase'
const CUSTOM_TOKEN_AUDIENCE =
  'https://identitytoolkit.googleapis.com/google.identity.identitytoolkit.v1.IdentityToolkit'

/** Long enough to walk to another room and find the mail; short enough that a
 *  challenge left lying about is worthless by the time anyone finds it. */
const CHALLENGE_TTL_MS = 15 * 60 * 1000

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

type Fields = Record<string, Record<string, unknown>>

const str = (fields: Fields | undefined, key: string): string => {
  const value = fields?.[key]?.stringValue
  return typeof value === 'string' ? value : ''
}

const bool = (fields: Fields | undefined, key: string): boolean => fields?.[key]?.booleanValue === true

const num = (fields: Fields | undefined, key: string): number => {
  const value = fields?.[key]?.integerValue
  return typeof value === 'string' ? Number(value) : 0
}

function documentUrl(account: ServiceAccount, id: string): string {
  return (
    `https://firestore.googleapis.com/v1/projects/${account.project_id}` +
    `/databases/(default)/documents/emailVerifications/${id}`
  )
}

async function readChallenge(
  account: ServiceAccount,
  token: string,
  id: string,
): Promise<Fields | null> {
  const response = await fetch(documentUrl(account, id), {
    headers: { authorization: `Bearer ${token}` },
  })
  if (!response.ok) return null
  const body = (await response.json()) as { fields?: Fields }
  return body.fields ?? null
}

async function writeChallenge(
  account: ServiceAccount,
  token: string,
  id: string,
  fields: Fields,
): Promise<boolean> {
  const response = await fetch(documentUrl(account, id), {
    method: 'PATCH',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({ fields }),
  })
  return response.ok
}

/** Creates the account if the address is new, or resets its password if it is
 *  not. Both are legitimate here: the challenge proved the mailbox, which is
 *  the same proof a password reset rests on. */
async function upsertAccount(
  account: ServiceAccount,
  token: string,
  email: string,
  password: string,
): Promise<string | null> {
  const base = `https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}`
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' }

  const lookup = await fetch(`${base}/accounts:lookup`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email: [email] }),
  })
  const found = lookup.ok
    ? ((await lookup.json()) as { users?: { localId?: string }[] }).users?.[0]?.localId
    : undefined

  if (found) {
    const update = await fetch(`${base}/accounts:update`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ localId: found, password, emailVerified: true }),
    })
    return update.ok ? found : null
  }

  const created = await fetch(`${base}/accounts`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ email, password, emailVerified: true }),
  })
  if (!created.ok) return null
  const body = (await created.json()) as { localId?: string }
  return typeof body.localId === 'string' ? body.localId : null
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const account = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!account) {
    return json({ error: 'Sign-in is not configured on this deployment.', code: 'not-configured' }, 501)
  }
  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (!apiKey) return json({ error: 'Missing Firebase web key.', code: 'not-configured' }, 501)

  let payload: { action?: string; id?: string; email?: string; oobCode?: string; password?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  const firestoreToken = await getAccessToken(account, FIRESTORE_SCOPE)

  // ---------------------------------------------------------------- start
  if (payload.action === 'start') {
    const email = (payload.email ?? '').trim().toLowerCase()
    if (!email.includes('@')) return json({ error: 'Enter a valid address.' }, 400)

    // 32 bytes from the platform CSPRNG. This is the only secret tying the two
    // devices together, so it must not be guessable from a timestamp or a
    // counter.
    const bytes = crypto.getRandomValues(new Uint8Array(32))
    const id = [...bytes].map((byte) => byte.toString(16).padStart(2, '0')).join('')

    const ok = await writeChallenge(account, firestoreToken, id, {
      email: { stringValue: email },
      verified: { booleanValue: false },
      used: { booleanValue: false },
      expiresAt: { integerValue: String(Date.now() + CHALLENGE_TTL_MS) },
    })
    if (!ok) return json({ error: 'Could not start that. Try again.' }, 502)
    return json({ id }, 200)
  }

  // -------------------------------------------------------------- confirm
  // Called by whichever device opened the mail. It does not sign that device
  // in, and deliberately returns nothing about the account.
  if (payload.action === 'confirm') {
    const id = payload.id ?? ''
    const oobCode = payload.oobCode ?? ''
    if (!id || !oobCode) return json({ error: 'Missing code.' }, 400)

    const fields = await readChallenge(account, firestoreToken, id)
    if (!fields) return json({ error: 'That link has expired. Start again.' }, 404)
    if (num(fields, 'expiresAt') < Date.now()) {
      return json({ error: 'That link has expired. Start again.' }, 410)
    }

    const email = str(fields, 'email')
    const check = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        // No session wanted: this endpoint needs the address confirmed, not a
        // token it would then have to be careful with.
        body: JSON.stringify({ email, oobCode, returnSecureToken: false }),
      },
    )
    if (!check.ok) {
      return json({ error: 'That link is expired, already used, or not for this address.' }, 403)
    }
    const confirmed = ((await check.json()) as { email?: string }).email?.toLowerCase()
    if (confirmed !== email) return json({ error: 'That link is for a different address.' }, 403)

    await writeChallenge(account, firestoreToken, id, {
      email: { stringValue: email },
      verified: { booleanValue: true },
      used: { booleanValue: bool(fields, 'used') },
      expiresAt: { integerValue: String(num(fields, 'expiresAt')) },
    })
    return json({ ok: true, email }, 200)
  }

  // --------------------------------------------------------------- status
  // Polled by the device that started it. Says only whether the address has
  // been confirmed — never anything about the account behind it.
  if (payload.action === 'status') {
    const fields = await readChallenge(account, firestoreToken, payload.id ?? '')
    if (!fields) return json({ verified: false, expired: true }, 200)
    return json(
      {
        verified: bool(fields, 'verified'),
        expired: num(fields, 'expiresAt') < Date.now(),
      },
      200,
    )
  }

  // --------------------------------------------------------------- finish
  // Sets the password and hands back a custom token, so the device that
  // started all this is the one that ends up signed in.
  if (payload.action === 'finish') {
    const id = payload.id ?? ''
    const password = payload.password ?? ''
    if (password.length < 8) return json({ error: 'Use at least 8 characters.' }, 400)

    const fields = await readChallenge(account, firestoreToken, id)
    if (!fields) return json({ error: 'That request has expired. Start again.' }, 404)
    if (!bool(fields, 'verified')) return json({ error: 'That address is not confirmed yet.' }, 403)
    if (bool(fields, 'used')) return json({ error: 'That link has already been used.' }, 409)
    if (num(fields, 'expiresAt') < Date.now()) {
      return json({ error: 'That request has expired. Start again.' }, 410)
    }

    const email = str(fields, 'email')
    const identityToken = await getAccessToken(account, IDENTITY_SCOPE)
    const uid = await upsertAccount(account, identityToken, email, password)
    if (!uid) return json({ error: 'Could not set that password. Try again.' }, 502)

    // Burned before the token is handed out, so a repeated request cannot mint
    // a second one even if the response never arrives.
    await writeChallenge(account, firestoreToken, id, {
      email: { stringValue: email },
      verified: { booleanValue: true },
      used: { booleanValue: true },
      expiresAt: { integerValue: String(num(fields, 'expiresAt')) },
    })

    const issued = Math.floor(Date.now() / 1000)
    const customToken = await signJwt(account, {
      iss: account.client_email,
      sub: account.client_email,
      aud: CUSTOM_TOKEN_AUDIENCE,
      uid,
      iat: issued,
      // An hour is the Firebase maximum, and this one is spent within seconds.
      exp: issued + 3600,
    })

    return json({ customToken, email }, 200)
  }

  return json({ error: 'Unknown action.' }, 400)
}
