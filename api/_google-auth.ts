/**
 * Mints a Google OAuth2 access token from a service account, on the Edge
 * runtime, with no dependencies.
 *
 * WHY THIS EXISTS. Firebase is on the Spark plan, so there are no Cloud
 * Functions and no admin SDK anywhere in this project. But sending a push
 * through FCM's HTTP v1 API needs an OAuth2 bearer token, and reading a
 * document the caller is not allowed to read needs one too. Both come from the
 * same place: a service account key, exchanged for a short-lived access token
 * using the JWT bearer grant.
 *
 * The mirror image of _verify-token.ts — that file verifies an RS256 signature
 * Google made, this one produces an RS256 signature Google will verify. Same
 * Web Crypto primitives, opposite direction. firebase-admin would do this too,
 * and would also pull a Node-only dependency tree into an Edge function that
 * currently ships as a few kilobytes.
 *
 * SECURITY. The private key here is the whole project. It is read from
 * FIREBASE_SERVICE_ACCOUNT, which must never carry a VITE_ prefix — anything
 * that does is compiled into the client bundle in plain text. Nothing in this
 * file logs the key, and the errors it throws never quote it.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token'

/** Google issues these for an hour; refreshing early avoids racing the expiry. */
const LIFETIME_SECONDS = 3600
const REFRESH_MARGIN_MS = 5 * 60 * 1000

export type ServiceAccount = {
  client_email: string
  private_key: string
  project_id: string
}

/**
 * Parses FIREBASE_SERVICE_ACCOUNT, which holds the downloaded key JSON.
 *
 * Returns null rather than throwing when it is absent, so an unconfigured
 * deployment degrades to "no push notifications" instead of 500ing on an
 * endpoint the rest of the app calls after every order.
 *
 * The literal `\n` handling is not optional. Pasting a key into a Vercel
 * environment variable turns the newlines in the PEM body into two-character
 * escapes, and a PEM whose base64 is one unbroken line is rejected by
 * importKey with an error that says nothing about newlines.
 */
export function readServiceAccount(raw: string | undefined): ServiceAccount | null {
  if (!raw || raw.trim() === '') return null

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not valid JSON.')
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('FIREBASE_SERVICE_ACCOUNT is not an object.')
  }

  const account = parsed as Record<string, unknown>
  const { client_email: email, private_key: key, project_id: project } = account
  if (typeof email !== 'string' || typeof key !== 'string' || typeof project !== 'string') {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT is missing client_email, private_key or project_id.',
    )
  }

  return { client_email: email, private_key: key.replace(/\\n/g, '\n'), project_id: project }
}

function base64Url(bytes: ArrayBuffer | Uint8Array): string {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)
  let binary = ''
  for (const byte of view) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function encodeSegment(value: unknown): string {
  return base64Url(new TextEncoder().encode(JSON.stringify(value)))
}

/** Strips the PEM armour and decodes the base64 body into DER bytes. */
function pemToDer(pem: string): ArrayBuffer {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const binary = atob(body)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

/**
 * Cached across invocations that reuse a warm container.
 *
 * Keyed on the service account's address, so a redeploy that swaps the key
 * cannot serve a token minted from the old one. Without the cache, every push
 * would cost an extra RSA sign plus a round trip to Google before the round
 * trip to FCM.
 */
let cache: { email: string; token: string; expiresAt: number } | null = null

export async function getAccessToken(
  account: ServiceAccount,
  scope: string,
): Promise<string> {
  const now = Date.now()
  if (cache && cache.email === account.client_email && cache.expiresAt - REFRESH_MARGIN_MS > now) {
    return cache.token
  }

  const issued = Math.floor(now / 1000)
  const claims = {
    iss: account.client_email,
    scope,
    aud: TOKEN_URL,
    iat: issued,
    exp: issued + LIFETIME_SECONDS,
  }

  const unsigned = `${encodeSegment({ alg: 'RS256', typ: 'JWT' })}.${encodeSegment(claims)}`

  let key: CryptoKey
  try {
    key = await crypto.subtle.importKey(
      'pkcs8',
      pemToDer(account.private_key),
      { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
      false,
      ['sign'],
    )
  } catch {
    // Deliberately does not include the underlying error, which on some
    // runtimes echoes part of the key material back.
    throw new Error('The service account private key could not be read.')
  }

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsigned),
  )

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${unsigned}.${base64Url(signature)}`,
    }),
  })

  const payload = (await response.json().catch(() => null)) as {
    access_token?: string
    expires_in?: number
    error_description?: string
  } | null

  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new Error(
      `Google refused the service account assertion (${response.status})` +
        (payload?.error_description ? `: ${payload.error_description}` : '.'),
    )
  }

  cache = {
    email: account.client_email,
    token: payload.access_token,
    expiresAt: now + (payload.expires_in ?? LIFETIME_SECONDS) * 1000,
  }
  return payload.access_token
}
