/**
 * Firebase ID token verification against Google's public JWKS.
 *
 * Shared by every endpoint under api/. The leading underscore is what keeps
 * Vercel from routing this file as a function of its own.
 *
 * Written by hand rather than pulling in firebase-admin or jose. firebase-admin
 * is a large dependency that wants a service account key we would then have to
 * store; jose would do fine but this is sixty lines of Web Crypto that runs
 * unchanged on the Edge runtime, and every check it performs is visible here
 * rather than behind a call.
 *
 * SECURITY: every one of the checks below matters. Verifying the signature and
 * skipping `aud` accepts a valid Firebase token from somebody else's project;
 * skipping `iss` accepts a token this project never issued; skipping `exp`
 * accepts a token forever. They are not defence in depth, they are the check.
 */

/** Google's public keys for Firebase ID tokens, in JWK form. */
const JWKS_URL = 'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'

type Jwk = JsonWebKey & { kid: string; alg?: string }

/**
 * Cached across invocations that happen to reuse a warm container, and
 * refreshed when a kid is missing — Google rotates these roughly daily, and
 * fetching the set on every request would add a round trip to every call.
 */
let cache: { keys: Jwk[]; fetchedAt: number } | null = null
const CACHE_MS = 60 * 60 * 1000

async function getKeys(forceRefresh = false): Promise<Jwk[]> {
  if (!forceRefresh && cache && Date.now() - cache.fetchedAt < CACHE_MS) {
    return cache.keys
  }
  const response = await fetch(JWKS_URL)
  if (!response.ok) {
    throw new Error(`Could not fetch Google signing keys (${response.status}).`)
  }
  const payload = (await response.json()) as { keys?: Jwk[] }
  if (!Array.isArray(payload.keys) || payload.keys.length === 0) {
    throw new Error('Google signing key set was empty.')
  }
  cache = { keys: payload.keys, fetchedAt: Date.now() }
  return payload.keys
}

export function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/**
 * A token with three dot-separated parts that are not base64url JSON is
 * malformed, not a JSON syntax problem. Left unhandled, JSON.parse's own
 * message reaches the client verbatim — "Unexpected token '?', ... is not
 * valid JSON" — which describes our parser rather than their token.
 */
function decodeJson(segment: string): Record<string, unknown> {
  try {
    const decoded = JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as unknown
    if (!decoded || typeof decoded !== 'object' || Array.isArray(decoded)) {
      throw new Error('not an object')
    }
    return decoded as Record<string, unknown>
  } catch {
    throw new Error('Malformed token.')
  }
}

export type VerifiedUser = {
  uid: string
  email: string
}

/**
 * Who an endpoint is for. Deliberately a required field with no default.
 *
 * The two endpoints under api/ want different answers — menu scanning spends a
 * shared Groq quota and is for sellers, order notifications are triggered by
 * buyers, who may hold any verified address. A boolean with a default would
 * make "everyone" the thing you get by forgetting, which is the wrong way
 * round for a check that is the only gate on the endpoint.
 */
export type Audience =
  | { kind: 'thaparOnly'; allowedDomain: string; ownerEmail: string }
  | { kind: 'anyVerifiedAccount' }

/**
 * Returns the verified user, or throws with a message safe to send to the
 * client. Never returns a partially-checked token.
 */
export async function verifyFirebaseToken(
  idToken: string,
  options: { projectId: string; audience: Audience },
): Promise<VerifiedUser> {
  const parts = idToken.split('.')
  if (parts.length !== 3) throw new Error('Malformed token.')
  const [headerSegment, payloadSegment, signatureSegment] = parts

  const header = decodeJson(headerSegment)
  // Pinned, not read-and-trusted. Accepting the token's own `alg` is how you
  // get talked into "none", or into verifying an RSA token with HMAC using the
  // public key as the secret.
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.')
  if (typeof header.kid !== 'string') throw new Error('Token has no key id.')

  let keys = await getKeys()
  let jwk = keys.find((key) => key.kid === header.kid)
  if (!jwk) {
    // Unknown kid usually means Google rotated since the cache was filled.
    keys = await getKeys(true)
    jwk = keys.find((key) => key.kid === header.kid)
  }
  if (!jwk) throw new Error('Token was signed with an unrecognised key.')

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  )

  const signed = new TextEncoder().encode(`${headerSegment}.${payloadSegment}`)
  const valid = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    base64UrlToBytes(signatureSegment),
    signed,
  )
  if (!valid) throw new Error('Token signature is not valid.')

  const claims = decodeJson(payloadSegment)
  const now = Math.floor(Date.now() / 1000)
  // 60s of slack, for clock skew between Google and this container only.
  const skew = 60

  if (typeof claims.exp !== 'number' || claims.exp + skew < now) {
    throw new Error('Token has expired. Sign in again.')
  }
  if (typeof claims.iat !== 'number' || claims.iat - skew > now) {
    throw new Error('Token is not valid yet.')
  }
  if (claims.aud !== options.projectId) {
    throw new Error('Token was issued for a different project.')
  }
  if (claims.iss !== `https://securetoken.google.com/${options.projectId}`) {
    throw new Error('Token has the wrong issuer.')
  }
  if (typeof claims.sub !== 'string' || claims.sub.length === 0) {
    throw new Error('Token has no subject.')
  }
  if (claims.email_verified !== true || typeof claims.email !== 'string') {
    throw new Error('This account has no verified email address.')
  }

  // The same rule as firestore.rules and lib/firebase.ts. Re-checked here
  // because an endpoint that spends a shared quota is reachable by anyone with
  // any valid Firebase token from this project.
  const email = claims.email.toLowerCase()
  if (options.audience.kind === 'thaparOnly') {
    const { allowedDomain, ownerEmail } = options.audience
    const allowed = email === ownerEmail || email.endsWith(`@${allowedDomain}`)
    if (!allowed) {
      throw new Error('This feature is for Thapar accounts.')
    }
  }

  return { uid: claims.sub, email }
}
