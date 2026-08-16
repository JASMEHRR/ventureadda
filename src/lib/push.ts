import { deleteDoc, doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { app, db } from './firebase'
import { reportError } from './errors'

/**
 * Web push registration for sellers.
 *
 * WHAT THIS IS FOR. Firebase is on the Spark plan, so nothing server-side
 * watches Firestore and a seller has no way to learn about an order except by
 * opening the site. FCM web push is the one channel that reaches them with the
 * tab closed and costs nothing on the free plan.
 *
 * ENTIRELY OPTIONAL, at every layer. Without VITE_FIREBASE_VAPID_KEY set, this
 * reports itself unavailable and no UI for it is drawn. Without permission it
 * does nothing. Without a service account on the server the push is never
 * sent. None of those paths may break ordering, and none of them do.
 *
 * NOT USED FOR BUYERS. Only the seller is notified, and only about their own
 * orders. There is no marketing channel here and there should not be one.
 */

/** Public by design — the VAPID public key identifies the sender, it authorises nothing. */
const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY as string | undefined

/**
 * firebase/messaging is loaded on demand, never at module scope.
 *
 * A static import put it in the shared firebase vendor chunk, which every
 * visitor downloads before the landing page paints — 25KB of push machinery on
 * the critical path of a directory most people arrive at from a WhatsApp link
 * and never sell anything on. Every caller below is already async, so
 * deferring it costs nothing, and when VAPID_KEY is unset the chunk is never
 * requested at all. vite.config.ts gives it its own chunk so this actually
 * splits rather than dragging the whole SDK along.
 */
const messagingSdk = () => import('firebase/messaging')

/**
 * The worker cannot read import.meta.env, so the config rides in the query
 * string. Every value here is already in the client bundle in plain text; see
 * the note in .env.example about why Firebase web config is not a secret.
 */
function workerUrl(): string {
  const params = new URLSearchParams({
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  })
  return `/firebase-messaging-sw.js?${params.toString()}`
}

export type PushAvailability =
  | { state: 'unsupported'; reason: string }
  | { state: 'unconfigured' }
  | { state: 'blocked' }
  | { state: 'ready'; enabled: boolean }

/**
 * What the UI should offer, without asking for anything.
 *
 * Deliberately never triggers the permission prompt: a prompt fired on page
 * load is the fastest way to get permanently blocked, because people dismiss
 * what they did not ask for and Chrome remembers that.
 */
export async function pushAvailability(): Promise<PushAvailability> {
  if (!VAPID_KEY) return { state: 'unconfigured' }

  // iOS Safari only supports web push for a site installed to the home screen,
  // and reports no Notification API at all until then.
  if (typeof Notification === 'undefined' || !('serviceWorker' in navigator)) {
    return { state: 'unsupported', reason: 'This browser cannot show notifications.' }
  }
  if (!(await (await messagingSdk()).isSupported())) {
    return {
      state: 'unsupported',
      reason:
        'This browser cannot receive push. On an iPhone, add VentureAdda to your home screen first.',
    }
  }
  if (Notification.permission === 'denied') return { state: 'blocked' }

  return { state: 'ready', enabled: Notification.permission === 'granted' }
}

/**
 * The document id for a token: its SHA-256, in hex.
 *
 * Deterministic, so re-enabling on a device the seller already registered
 * overwrites one document instead of adding a second. Hashed rather than used
 * raw because an FCM token contains a colon, and a colon in a Firestore REST
 * path segment collides with the `:method` syntax Google's own API uses —
 * api/notify-order.ts has to read these back over REST.
 */
async function tokenId(token: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token))
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Registers the worker and asks FCM for this device's token. */
async function currentToken(): Promise<{ token: string; registration: ServiceWorkerRegistration }> {
  const { getMessaging, getToken } = await messagingSdk()
  const registration = await navigator.serviceWorker.register(workerUrl())
  const token = await getToken(getMessaging(app), {
    vapidKey: VAPID_KEY,
    serviceWorkerRegistration: registration,
  })
  return { token, registration }
}

/**
 * Asks for permission, then stores this device's token where
 * api/notify-order.ts can find it.
 *
 * One document per device, not one list: a seller may have a phone and a
 * laptop and both should ring, and a subcollection is what keeps the tokens
 * out of the user document that every signed-in account can read.
 *
 * Returns false rather than throwing when permission is refused, because that
 * is an answer, not a fault.
 */
export async function enablePush(uid: string): Promise<boolean> {
  if (!VAPID_KEY) return false

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return false

  try {
    const { token } = await currentToken()
    if (!token) return false

    await setDoc(doc(db, 'users', uid, 'pushTokens', await tokenId(token)), {
      token,
      createdAt: serverTimestamp(),
    })
    return true
  } catch (cause) {
    throw new Error(reportError('enablePush', cause))
  }
}

/**
 * Drops this device's token and unregisters the worker.
 *
 * Only this device. Turning notifications off on a laptop must not silence the
 * phone in the seller's pocket, which is the one that matters.
 */
export async function disablePush(uid: string): Promise<void> {
  if (!VAPID_KEY) return
  try {
    const { token, registration } = await currentToken()
    if (token) {
      await deleteDoc(doc(db, 'users', uid, 'pushTokens', await tokenId(token)))
    }
    await registration.unregister()
  } catch (cause) {
    throw new Error(reportError('disablePush', cause))
  }
}
