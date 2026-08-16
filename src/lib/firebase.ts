import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

/**
 * Firebase is on the Spark (free) plan. Two consequences shape the whole app:
 *
 * - No Cloud Functions, so every piece of logic is client-side and every rule
 *   that actually matters has to live in firestore.rules.
 * - No Firebase Storage, which needs Blaze. Photo uploads go to Cloudinary
 *   instead. Nothing here should ever import firebase/storage.
 */

const REQUIRED = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

const missing = REQUIRED.filter((key) => !import.meta.env[key])
if (missing.length > 0) {
  // Failing loudly at startup beats a blank screen and an opaque Firebase
  // error the first time somebody tries to sign in.
  throw new Error(
    `Missing Firebase environment variables: ${missing.join(', ')}. ` +
      'Copy .env.example to .env and fill it in from the Firebase console.',
  )
}

// Exported for lib/push.ts, which needs the app instance to build a Messaging
// instance. Nothing else should reach past `auth` and `db`.
export const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
})

export const auth = getAuth(app)
export const db = getFirestore(app)

/**
 * The domain that may post and list. NOT the domain that may sign in.
 *
 * That distinction is the whole shape of the access model now. Anyone with a
 * verified Google address can hold an account, browse and review. Posting in
 * All Chat and listing a venture stay behind this domain, matching
 * isThaparUser() in firestore.rules — which is the copy that actually enforces
 * it. Everything here runs in the browser and can be skipped by calling the
 * Firebase Auth REST API directly, so it exists to explain a restriction
 * before someone hits it, never to impose one.
 */
export const ALLOWED_EMAIL_DOMAIN = 'thapar.edu'

/**
 * The site owner, who is not a Thapar address and would otherwise be unable to
 * post or moderate. Mirrors isOwner() in firestore.rules.
 */
export const OWNER_EMAIL = 'jasmehr2005@gmail.com'

/**
 * May this address post in chat and list a venture?
 *
 * Named for what it now gates. It used to be isAllowedEmail and was checked at
 * the door; with Google Sign-In the door is open to everyone, and the same test
 * moved to guarding actions. Keeping the old name would have left every call
 * site reading like an entry check when none of them is one any more.
 */
export function isThaparEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalised = email.trim().toLowerCase()
  return normalised === OWNER_EMAIL || normalised.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
}
