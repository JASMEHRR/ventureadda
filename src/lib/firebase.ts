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

const app = initializeApp({
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
 * The only domain allowed to sign in.
 *
 * Enforced here for the user's benefit — a clear message before an email is
 * ever sent — and enforced again in firestore.rules, which is the copy that
 * actually counts. This check runs in the browser and anyone can skip it by
 * calling the Firebase Auth REST API directly, so it must never be the only
 * thing standing between a stranger and the database.
 */
export const ALLOWED_EMAIL_DOMAIN = 'thapar.edu'

/**
 * The site owner, who is not a Thapar address and would otherwise be unable to
 * sign in at all. Mirrors isOwner() in firestore.rules — that copy is the one
 * that actually grants anything; this one only avoids a confusing rejection
 * before the email is ever sent.
 */
export const OWNER_EMAIL = 'jasmehr2005@gmail.com'

export function isAllowedEmail(email: string): boolean {
  const normalised = email.trim().toLowerCase()
  return normalised === OWNER_EMAIL || normalised.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`)
}
