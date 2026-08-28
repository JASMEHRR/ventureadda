import { getAccessToken, readServiceAccount } from '../server/googleAuth'
import type { ServiceAccount } from '../server/googleAuth'
import { verifyFirebaseToken } from '../server/verifyToken'

/**
 * Proves a Thapar address belongs to the person already signed in, and grants
 * them posting rights.
 *
 * WHY THIS IS A SERVER FUNCTION, AND WHY THE CLIENT CANNOT DO IT. Somebody who
 * signed in with a personal Gmail can add their @thapar.edu address to the
 * same account, so they keep their username, orders and cart instead of
 * starting again. The client can prove ownership perfectly well — an email
 * link does that — but it cannot prove it TO THE RULES.
 *
 * The first attempt tried. firestore.rules granted posting rights for any
 * @thapar.edu address in the token's linked identities, which was safe only
 * while an email link was the one way into that slot. It was not: with the
 * Email/Password provider enabled — which it is —
 * `linkWithCredential(EmailAuthProvider.credential('anyone@thapar.edu', '…'))`
 * puts an address there from the browser console with no proof of anything,
 * and Firebase gives rules no per-address verified flag to tell the two apart.
 * That branch was removed, and this endpoint is what replaces it.
 *
 * HOW THE PROOF WORKS. The client asks Firebase to mail a sign-in link to the
 * Thapar address and sends the resulting oobCode here. This endpoint spends
 * that code against Google's identity toolkit — the same call the client SDK
 * makes to sign in with a link. A 200 means the code was genuine, unexpired,
 * unspent, and issued for that exact address, and Google says so with the
 * verified address in the response. That is proof of the inbox, established by
 * someone other than the caller. A code cannot be forged, replayed (it is
 * consumed here) or pointed at a different address than the one it was minted
 * for.
 *
 * WHAT IT GRANTS. An `approvedEmails/{their-signed-in-address}` entry, which is
 * the mechanism the rules already trust for exactly this — a moderator's
 * pre-approval. Never `moderator: true`: this proves somebody is at Thapar,
 * which is not the same as trusting them with the moderation queue.
 *
 * WITHOUT A SERVICE ACCOUNT it returns 501 and says so, rather than pretending
 * to have granted something. Same environment variable notify-order.ts uses.
 *
 * RUNTIME. Edge, matching the other functions here: the Fetch signature
 * `(request: Request) => Response`. See the note in extract-menu.ts.
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

/**
 * Spends the sign-in code and returns the address Google says it belongs to.
 *
 * The web API key is the public one already compiled into the client bundle;
 * it identifies the project and grants nothing on its own. The security here
 * is the oobCode, which only reaches the person who opened the mailbox.
 *
 * `returnSecureToken: false` because this endpoint has no use for a session —
 * it wants the verified address and nothing else, and a token it does not need
 * is a token that could leak.
 */
async function verifyEmailLink(
  apiKey: string,
  email: string,
  oobCode: string,
): Promise<string | null> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithEmailLink?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, oobCode, returnSecureToken: false }),
    },
  )
  if (!response.ok) return null
  const body = (await response.json()) as { email?: string }
  return typeof body.email === 'string' ? body.email.toLowerCase() : null
}

/**
 * The Thapar address on a GOOGLE identity attached to this account, if there
 * is one.
 *
 * WHY THIS IS THE BEST PROOF AVAILABLE, and why it needs a server. Thapar runs
 * on Google Workspace, so a student's @thapar.edu address IS a Google account:
 * signing in with it, or linking it to an account they already have, proves
 * ownership through Google with no mail sent and nothing to run out. What the
 * security rules cannot do is tell that identity apart from an unverified one
 * — `firebase.identities.email` in the token lumps every provider's address
 * together, which is exactly why the rule reading it had to be removed once
 * password sign-in existed.
 *
 * The Admin lookup does have that detail: `providerUserInfo` lists each
 * provider separately, with the address it carries. So this looks only at
 * entries whose providerId is google.com. A password credential for the same
 * address — the thing anyone could add from a browser console — is a
 * different provider and is ignored.
 */
async function thaparGoogleIdentity(
  account: ServiceAccount,
  token: string,
  uid: string,
  domain: string,
): Promise<string | null> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/projects/${account.project_id}/accounts:lookup`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ localId: [uid] }),
    },
  )
  if (!response.ok) return null

  const body = (await response.json()) as {
    users?: { providerUserInfo?: { providerId?: string; email?: string }[] }[]
  }
  const providers = body.users?.[0]?.providerUserInfo ?? []
  const match = providers.find(
    (entry) =>
      entry.providerId === 'google.com' &&
      typeof entry.email === 'string' &&
      entry.email.toLowerCase().endsWith(`@${domain}`),
  )
  return match?.email?.toLowerCase() ?? null
}

async function grantPostingRights(
  account: ServiceAccount,
  accessToken: string,
  callerEmail: string,
  thaparEmail: string,
): Promise<boolean> {
  // Keyed by the address on the caller's token, because that is the key
  // isThaparUser() looks the entry up by. The Thapar address that earned it is
  // stored alongside so the grant can be traced back to its proof.
  const path = `approvedEmails/${encodeURIComponent(callerEmail)}`
  const url =
    `https://firestore.googleapis.com/v1/projects/${account.project_id}` +
    `/databases/(default)/documents/${path}`

  const response = await fetch(url, {
    method: 'PATCH',
    headers: {
      authorization: `Bearer ${accessToken}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      fields: {
        // Never true. Proving somebody studies at Thapar is not the same as
        // trusting them with the moderation queue.
        moderator: { booleanValue: false },
        verifiedThaparEmail: { stringValue: thaparEmail },
        verifiedAt: { timestampValue: new Date().toISOString() },
        source: { stringValue: 'thapar-email-verification' },
      },
    }),
  })
  return response.ok
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'Use POST.' }, 405)

  const account = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  if (!account) {
    return json(
      {
        error: 'Address verification is not configured on this deployment.',
        code: 'not-configured',
      },
      501,
    )
  }

  const apiKey = process.env.VITE_FIREBASE_API_KEY
  if (!apiKey) return json({ error: 'Missing Firebase web key.', code: 'not-configured' }, 501)

  const allowedDomain = process.env.VITE_ALLOWED_EMAIL_DOMAIN ?? 'thapar.edu'

  let payload: { idToken?: string; email?: string; oobCode?: string; mode?: string }
  try {
    payload = (await request.json()) as typeof payload
  } catch {
    return json({ error: 'Malformed request.' }, 400)
  }

  const { idToken, email, oobCode, mode } = payload
  if (!idToken) return json({ error: 'Not signed in.' }, 400)
  if (mode !== 'google' && (!email || !oobCode)) {
    return json({ error: 'Missing address or code.' }, 400)
  }

  // Who is asking. Any verified account may ask — the whole point is that they
  // do not have a Thapar address yet.
  let caller
  try {
    caller = await verifyFirebaseToken(idToken, {
      projectId: account.project_id,
      audience: { kind: 'anyVerifiedAccount' },
    })
  } catch (cause) {
    return json({ error: cause instanceof Error ? cause.message : 'Not signed in.' }, 401)
  }

  /**
   * The Google route: no address typed, no mail sent, nothing to expire.
   *
   * The caller has just linked their Thapar Google account in the browser;
   * this checks that it really is attached to their Firebase user and really
   * is on the right domain, using provider detail the security rules cannot
   * see. Everything the client claims is ignored — the answer comes from
   * Google's own record of the account.
   */
  if (mode === 'google') {
    const identityToken = await getAccessToken(account, IDENTITY_SCOPE)
    const found = await thaparGoogleIdentity(account, identityToken, caller.uid, allowedDomain)
    if (!found) {
      return json(
        {
          error: `No @${allowedDomain} Google account is linked to this sign-in yet.`,
          code: 'not-linked',
        },
        403,
      )
    }

    const firestoreToken = await getAccessToken(account, FIRESTORE_SCOPE)
    const ok = await grantPostingRights(
      account,
      firestoreToken,
      caller.email.toLowerCase(),
      found,
    )
    if (!ok) return json({ error: 'Could not record the approval. Try again.' }, 502)
    return json({ ok: true, verified: found }, 200)
  }

  const target = (email ?? '').trim().toLowerCase()
  if (!target.endsWith(`@${allowedDomain}`)) {
    return json({ error: `That is not an @${allowedDomain} address.` }, 400)
  }

  // The proof. Everything above this line is the caller's own claim.
  const verified = await verifyEmailLink(apiKey, target, oobCode ?? '')
  if (verified !== target) {
    return json(
      { error: 'That link is expired, already used, or was not sent to this address.' },
      403,
    )
  }

  const accessToken = await getAccessToken(account, FIRESTORE_SCOPE)
  const granted = await grantPostingRights(account, accessToken, caller.email.toLowerCase(), target)
  if (!granted) return json({ error: 'Could not record the approval. Try again.' }, 502)

  return json({ ok: true, verified: target }, 200)
}
