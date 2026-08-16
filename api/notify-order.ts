import { verifyFirebaseToken } from './_verify-token.ts'
import { getAccessToken, readServiceAccount } from './_google-auth.ts'
import type { ServiceAccount } from './_google-auth.ts'

/**
 * Pushes "you have an order" to the seller's devices.
 *
 * WHY THE BUYER'S BROWSER TRIGGERS THIS. Firebase is on the Spark plan, so
 * there is no Cloud Function to fire on document creation and nothing
 * server-side is watching Firestore. The only moment anybody's code is running
 * when an order appears is the moment the buyer's client wrote it, so that is
 * what calls this. The cost is real and worth stating: a buyer whose
 * connection drops between the write and this call places an order that never
 * pings. The order document is still there, and the seller still sees it on
 * their dashboard — the push is an accelerant, not the record.
 *
 * WHAT STOPS THIS BEING A "PUSH ANYTHING TO ANYONE" ENDPOINT. It takes an
 * order id and nothing else. Every word of the notification is read from the
 * order document server-side, and the request is refused unless the caller is
 * the buyer named on that order and the order was written in the last few
 * minutes. A caller cannot choose the recipient, cannot choose the text, and
 * cannot replay an old order to pester a seller.
 *
 * WHAT IT DOES NOT STOP. A buyer who has genuinely just ordered can call this
 * repeatedly for the ten minutes their order stays fresh, and buzz the seller
 * once per call. Bounding that properly means marking the order notified,
 * which means this endpoint writing to Firestore — and "it only ever reads" is
 * half of why the paragraph above is short enough to be checkable. The nuisance
 * is time-boxed, attributable to a named account, and the seller can delete the
 * order. Revisit if it is ever actually used that way.
 *
 * DEGRADES TO NOTHING. With FIREBASE_SERVICE_ACCOUNT unset this returns 204 and
 * does no work, because push is optional and the order flow must not fail when
 * it is not configured.
 *
 * RUNTIME. Edge, matching extract-menu.ts — this handler uses the Fetch API
 * `(request: Request) => Response` signature, which Vercel's Node.js functions
 * do not support.
 */

export const config = { runtime: 'edge' }

/** An order older than this cannot be used to send a notification. */
const MAX_ORDER_AGE_MS = 10 * 60 * 1000

const FIRESTORE_SCOPE = [
  'https://www.googleapis.com/auth/datastore',
  'https://www.googleapis.com/auth/firebase.messaging',
].join(' ')

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
 * Firestore's REST representation wraps every value in a type tag —
 * `{ stringValue: "x" }`, `{ integerValue: "3" }`. These pull the handful of
 * shapes this endpoint reads back out, and return undefined for anything
 * unexpected rather than guessing.
 */
type FirestoreValue = Record<string, unknown>

function readString(fields: Record<string, FirestoreValue> | undefined, key: string): string {
  const value = fields?.[key]?.stringValue
  return typeof value === 'string' ? value : ''
}

function readNumber(fields: Record<string, FirestoreValue> | undefined, key: string): number {
  const field = fields?.[key]
  if (!field) return 0
  // Firestore returns integers as decimal STRINGS in JSON, because a 64-bit
  // integer does not survive a JavaScript number. Rupee totals here are far
  // below that, but the string is still what arrives.
  if (typeof field.integerValue === 'string') return Number(field.integerValue) || 0
  if (typeof field.doubleValue === 'number') return field.doubleValue
  return 0
}

function readTimestamp(fields: Record<string, FirestoreValue> | undefined, key: string): number {
  const value = fields?.[key]?.timestampValue
  if (typeof value !== 'string') return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

async function getDocument(
  account: ServiceAccount,
  token: string,
  path: string,
): Promise<Record<string, FirestoreValue> | null> {
  const url = `https://firestore.googleapis.com/v1/projects/${account.project_id}/databases/(default)/documents/${path}`
  const response = await fetch(url, { headers: { authorization: `Bearer ${token}` } })
  if (response.status === 404) return null
  if (!response.ok) {
    throw new Error(`Firestore refused a read of ${path} (${response.status}).`)
  }
  const body = (await response.json()) as { fields?: Record<string, FirestoreValue> }
  return body.fields ?? {}
}

/**
 * The seller's registered devices, read from users/{uid}/pushTokens.
 *
 * A subcollection rather than a field on the user document, because that
 * document is world-readable to signed-in accounts — see the rules. Read here
 * with service-account credentials, which bypass rules entirely.
 *
 * `pageSize` caps what one order can fan out to. A missing collection returns
 * an empty body rather than a 404, which is the normal case: most sellers will
 * never turn notifications on.
 */
async function getDeviceTokens(
  account: ServiceAccount,
  accessToken: string,
  ownerId: string,
): Promise<string[]> {
  const url =
    `https://firestore.googleapis.com/v1/projects/${account.project_id}` +
    `/databases/(default)/documents/users/${ownerId}/pushTokens?pageSize=10`

  const response = await fetch(url, { headers: { authorization: `Bearer ${accessToken}` } })
  if (response.status === 404) return []
  if (!response.ok) {
    throw new Error(`Firestore refused the push token read (${response.status}).`)
  }

  const body = (await response.json()) as {
    documents?: { fields?: Record<string, FirestoreValue> }[]
  }
  return (body.documents ?? [])
    .map((document) => readString(document.fields, 'token'))
    .filter((token) => token !== '')
}

/**
 * Sends to every device the seller has registered, and reports which tokens
 * FCM rejected.
 *
 * One request per token: HTTP v1 has no multicast endpoint, and a seller has
 * one or two devices. Failures are collected rather than thrown, because one
 * dead token from a phone they factory-reset must not stop the push to the
 * phone they are holding.
 */
async function sendToTokens(
  account: ServiceAccount,
  accessToken: string,
  deviceTokens: string[],
  notification: { title: string; body: string; link: string },
): Promise<{ sent: number; stale: string[] }> {
  const url = `https://fcm.googleapis.com/v1/projects/${account.project_id}/messages:send`
  const stale: string[] = []
  let sent = 0

  const results = await Promise.allSettled(
    deviceTokens.map(async (deviceToken) => {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title: notification.title, body: notification.body },
            webpush: {
              fcmOptions: { link: notification.link },
              notification: { icon: '/apple-touch-icon.png', tag: 'ventureadda-order' },
            },
          },
        }),
      })
      // 404 UNREGISTERED and 400 INVALID_ARGUMENT both mean this token will
      // never work again — the browser was cleared, or permission revoked.
      if (response.status === 404 || response.status === 400) {
        stale.push(deviceToken)
        return
      }
      if (!response.ok) {
        throw new Error(`FCM returned ${response.status}`)
      }
      sent += 1
    }),
  )

  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[ventureadda] push to one device failed', result.reason)
    }
  }

  return { sent, stale }
}

export default async function handler(request: Request): Promise<Response> {
  if (request.method !== 'POST') {
    return fail('Use POST.', 405, 'method_not_allowed')
  }

  const projectId = process.env.FIREBASE_PROJECT_ID
  if (!projectId) {
    return fail('The server is missing FIREBASE_PROJECT_ID.', 500, 'misconfigured')
  }

  let account: ServiceAccount | null
  try {
    account = readServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT)
  } catch (cause) {
    console.error('[ventureadda] service account could not be read', cause)
    return fail('Push notifications are not configured correctly.', 500, 'misconfigured')
  }

  // Not an error. Push is optional, and the buyer's client calls this after
  // every order — a deployment without a key should be silent, not noisy.
  if (!account) return new Response(null, { status: 204 })

  const header = request.headers.get('authorization') ?? ''
  const idToken = header.startsWith('Bearer ') ? header.slice(7).trim() : ''
  if (!idToken) {
    return fail('Sign in and try again.', 401, 'unauthenticated')
  }

  let caller
  try {
    // Buyers may hold any verified address, Thapar or not — the Thapar rule
    // gates selling, not buying. See the Audience type.
    caller = await verifyFirebaseToken(idToken, {
      projectId,
      audience: { kind: 'anyVerifiedAccount' },
    })
  } catch (cause) {
    return fail(
      cause instanceof Error ? cause.message : 'Could not verify your account.',
      401,
      'unauthenticated',
    )
  }

  let body: { orderId?: unknown }
  try {
    body = (await request.json()) as { orderId?: unknown }
  } catch {
    return fail('Send a JSON body.', 400, 'bad_request')
  }

  const orderId = body.orderId
  // Path segment, so anything with a slash or a traversal sequence is refused
  // outright rather than normalised. Firestore ids are alphanumeric.
  if (typeof orderId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(orderId)) {
    return fail('Send a valid orderId.', 400, 'bad_request')
  }

  try {
    const accessToken = await getAccessToken(account, FIRESTORE_SCOPE)

    const order = await getDocument(account, accessToken, `orders/${orderId}`)
    if (!order) return fail('No such order.', 404, 'not_found')

    // THE AUTHORISATION CHECK. Everything below is derived from the document,
    // so this is the only thing standing between an authenticated stranger and
    // a push to an arbitrary seller.
    if (readString(order, 'buyerUid') !== caller.uid) {
      return fail('That is not your order.', 403, 'forbidden')
    }

    const createdAt = readTimestamp(order, 'createdAt')
    if (createdAt === 0 || Date.now() - createdAt > MAX_ORDER_AGE_MS) {
      return fail('That order is too old to notify about.', 409, 'stale_order')
    }

    // Goes into a REST path below. It comes from a document the rules force to
    // match a real venture's owner, so it is already a Firebase uid — checking
    // the shape anyway costs nothing and is the difference between one bad
    // write and a path-traversal read.
    const ownerId = readString(order, 'ownerId')
    if (!/^[A-Za-z0-9]{1,128}$/.test(ownerId)) {
      return fail('That order has no valid seller.', 409, 'malformed_order')
    }

    const deviceTokens = await getDeviceTokens(account, accessToken, ownerId)
    // The seller has never turned notifications on. Not a failure — most
    // sellers will not have, and the dashboard is still there.
    if (deviceTokens.length === 0) return json({ sent: 0, reason: 'no_devices' }, 200)

    const total = readNumber(order, 'total')
    const buyerName = readString(order, 'buyerName') || 'Someone'
    const ventureName = readString(order, 'ventureName') || 'your venture'

    const { sent, stale } = await sendToTokens(account, accessToken, deviceTokens, {
      title: `New order · ₹${total}`,
      body: `${buyerName} ordered from ${ventureName}. Open VentureAdda to see it.`,
      link: `${new URL(request.url).origin}/orders`,
    })

    // Dead tokens are left in place deliberately. Pruning them means a write
    // to the seller's user document from an endpoint whose whole safety
    // argument is that it only reads, and a handful of stale strings costs one
    // wasted request each. The client overwrites the list when the seller next
    // opens the site anyway.
    if (stale.length > 0) {
      console.warn(`[ventureadda] ${stale.length} stale FCM token(s) for ${ownerId}`)
    }

    return json({ sent }, 200)
  } catch (cause) {
    console.error('[ventureadda] notify-order failed', cause)
    // The buyer must never see this. Their order succeeded; this is a
    // best-effort ping and the client ignores the response.
    return fail('Could not notify the seller.', 502, 'notify_failed')
  }
}
