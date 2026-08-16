import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { StoredImage } from './types'

/**
 * One global document, not one field per setting: everything here is site-wide
 * and moderator-only, and a single doc is a single read for every visitor —
 * including signed-out ones, since the backdrop shows before anyone signs in.
 */
const settingsRef = doc(db, 'settings', 'site')

export type SiteSettings = {
  /** Absent means the default backdrop baked into the app, public/atmosphere.jpg. */
  backdrop?: StoredImage
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const snapshot = await getDoc(settingsRef)
  return snapshot.exists() ? (snapshot.data() as SiteSettings) : {}
}

/** null resets to the default backdrop rather than deleting nothing. */
export async function setBackdrop(image: StoredImage | null): Promise<void> {
  await setDoc(settingsRef, image ? { backdrop: image } : {})
}
