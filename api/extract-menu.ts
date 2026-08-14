/**
 * Firebase ID token verification against Google's public JWKS.
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

function base64UrlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(padded.padEnd(Math.ceil(padded.length / 4) * 4, '='))
  const bytes = new Uint8Array(new ArrayBuffer(binary.length))
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function decodeJson(segment: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(base64UrlToBytes(segment))) as Record<string, unknown>
}

type VerifiedUser = {
  uid: string
  email: string
}

/**
 * Returns the verified user, or throws with a message safe to send to the
 * client. Never returns a partially-checked token.
 */
async function verifyFirebaseToken(
  idToken: string,
  options: { projectId: string; allowedDomain: string; ownerEmail: string },
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
  // because this endpoint spends a shared quota and is reachable by anyone with
  // any valid Firebase token from this project.
  const email = claims.email.toLowerCase()
  const allowed = email === options.ownerEmail || email.endsWith(`@${options.allowedDomain}`)
  if (!allowed) {
    throw new Error('This feature is for Thapar accounts.')
  }

  return { uid: claims.sub, email }
}

/**
 * Reads a photographed menu or price list and returns structured items.
 *
 * WHY THIS IS A SERVER FUNCTION. The Groq key must never reach the browser. A
 * VITE_ variable is compiled into the client bundle in plain text, so anyone
 * who opens devtools has the key and the quota. Firebase Spark gives us no
 * server, but Vercel Hobby includes functions at no cost, so the key lives
 * here, in GROQ_API_KEY with no VITE_ prefix.
 *
 * WHY IT CHECKS A TOKEN. The URL is public and unauthenticated by default, and
 * the free tier is 30 requests a minute and 14,400 a day shared across every
 * user of the site. One person with curl could spend the day's quota in an
 * afternoon. So the caller sends their Firebase ID token, it is verified
 * against Google's published keys, and the Thapar rule is applied again here —
 * the client-side copy of that check is a courtesy, not a control.
 *
 * The response is never written to Firestore by this function. It goes back to
 * the browser, into the menu builder, and a human confirms it. Extraction gets
 * prices wrong, and a wrong price is worse than no price because somebody acts
 * on it.
 */

export const config = { runtime: 'edge' }

/**
 * Groq's vision model, confirmed against console.groq.com/docs/vision rather
 * than remembered — the previous vision model (llama-4-scout) is deprecated and
 * a deprecated id fails at runtime, not at deploy. Kept as one constant so
 * moving to the next one is a single edit.
 *
 * It is a preview model: expect it to be replaced, and treat a 400 or 404
 * naming this id as "the model moved", not "the photo was bad".
 */
const MODEL = 'qwen/qwen3.6-27b'

/** Groq's documented ceiling for an image request. */
const MAX_IMAGE_BYTES = 20 * 1024 * 1024

/** A menu photo that yields more than this is almost certainly a misread. */
const MAX_ITEMS = 60

const PROMPT = `You are reading a photograph of a menu, price list or product catalogue from a small student-run business in India.

Extract every item you can actually read. Respond with ONLY a JSON array, no prose and no code fences, where each element is:
{"name": string, "price": number, "description": string}

Rules:
- "price" is a whole number of rupees. Strip currency symbols and separators. If an item shows a range, use the lowest number.
- If an item has no readable price, omit the item entirely. Never guess a price.
- "description" is whatever detail the menu gives (size, weight, contents). Use an empty string if there is none.
- Do not invent items that are not visible. Do not translate names into English if they are written in another script; transcribe them as written.
- If you cannot read any items at all, respond with exactly: []`

type ExtractedItem = { name: string; price: number; description: string }

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

function fail(message: string, status: number, code: string): Response {
  return json({ error: message, code }, status)
}

/**
 * Pulls the array out of whatever the model returned.
 *
 * Models wrap JSON in code fences and add a sentence in front of it often
 * enough that failing on it would be a bug, not strictness.
 */
export function parseItems(raw: string): ExtractedItem[] | null {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  const candidate = (fenced ? fenced[1] : raw).trim()
  const start = candidate.indexOf('[')
  const end = candidate.lastIndexOf(']')
  if (start === -1 || end === -1 || end < start) return null

  let parsed: unknown
  try {
    parsed = JSON.parse(candidate.slice(start, end + 1))
  } catch {
    return null
  }
  if (!Array.isArray(parsed)) return null

  const items: ExtractedItem[] = []
  for (const entry of parsed) {
    if (!entry || typeof entry !== 'object') continue
    const row = entry as Record<string, unknown>
    const name = typeof row.name === 'string' ? row.name.trim() : ''
    // The model occasionally returns "450" rather than 450.
    const price = typeof row.price === 'number' ? row.price : Number(row.price)
    if (!name) continue
    if (!Number.isFinite(price) || price < 0) continue
    items.push({
      name: name.slice(0, 120),
      price: Math.round(price),
      description:
        typeof row.description === 'string' ? row.description.trim().slice(0, 300) : '',
    })
    if (items.length >= MAX_ITEMS) break
  }
  return items
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return fail('Use POST.', 405, 'method_not_allowed')
  }

  const apiKey = process.env.GROQ_API_KEY
  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!apiKey || !projectId) {
    // Configuration, not user error. Say so plainly in the log and give the
    // client something that does not blame their photo.
    console.error('extract-menu: GROQ_API_KEY or FIREBASE_PROJECT_ID is not set.')
    return fail('Menu scanning is not configured yet. Type the items in for now.', 503, 'unconfigured')
  }

  const authorization = request.headers.get('authorization') ?? ''
  const idToken = authorization.startsWith('Bearer ') ? authorization.slice(7).trim() : ''
  if (!idToken) {
    return fail('Sign in to use menu scanning.', 401, 'unauthenticated')
  }

  try {
    await verifyFirebaseToken(idToken, {
      projectId,
      allowedDomain: process.env.ALLOWED_EMAIL_DOMAIN ?? 'thapar.edu',
      ownerEmail: (process.env.OWNER_EMAIL ?? 'jasmehr2005@gmail.com').toLowerCase(),
    })
  } catch (cause) {
    return fail(cause instanceof Error ? cause.message : 'Could not verify your account.', 401, 'unauthenticated')
  }

  let body: { image?: unknown }
  try {
    body = (await request.json()) as { image?: unknown }
  } catch {
    return fail('Expected a JSON body.', 400, 'bad_request')
  }

  const image = body.image
  if (typeof image !== 'string' || !image.startsWith('data:image/')) {
    return fail('Send the photo as a data URL.', 400, 'bad_request')
  }
  // Rough byte count of the base64 payload, without decoding it.
  const base64Length = image.length - (image.indexOf(',') + 1)
  if (base64Length * 0.75 > MAX_IMAGE_BYTES) {
    return fail('That photo is too large. Try one under 20MB.', 413, 'too_large')
  }

  let response: Response
  try {
    response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0,
        max_completion_tokens: 4096,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: PROMPT },
              { type: 'image_url', image_url: { url: image } },
            ],
          },
        ],
      }),
    })
  } catch {
    return fail('Could not reach the scanning service. Type the items in for now.', 502, 'upstream_unreachable')
  }

  if (response.status === 429) {
    return fail('Menu scanning is busy right now. Wait a minute, or type the items in.', 429, 'rate_limited')
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    console.error(`extract-menu: Groq returned ${response.status}`, detail.slice(0, 500))
    return fail('Scanning failed. Type the items in for now.', 502, 'upstream_error')
  }

  const payload = (await response.json().catch(() => null)) as {
    choices?: { message?: { content?: string } }[]
  } | null
  const content = payload?.choices?.[0]?.message?.content
  if (typeof content !== 'string') {
    console.error('extract-menu: unexpected Groq response shape')
    return fail('Scanning failed. Type the items in for now.', 502, 'upstream_error')
  }

  const items = parseItems(content)
  if (items === null) {
    return fail('Could not read that photo. Try a sharper one, or type the items in.', 422, 'unreadable')
  }
  if (items.length === 0) {
    return fail('No menu items found in that photo. Try a closer shot, or type them in.', 422, 'no_items')
  }

  return json({ items }, 200)
}
