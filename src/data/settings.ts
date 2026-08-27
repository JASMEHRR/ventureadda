import { deleteField, doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import type { StoredImage } from './types'
import type { MaintenanceWindow } from './maintenance'

export type { MaintenanceWindow }
export { isDown, nextEdge } from './maintenance'

/**
 * One global document, not one field per setting: everything here is site-wide
 * and moderator-only, and a single doc is a single read for every visitor —
 * including signed-out ones, since the backdrop shows before anyone signs in.
 */
const settingsRef = doc(db, 'settings', 'site')

export type SiteSettings = {
  /** Absent means the default backdrop baked into the app, public/atmosphere.jpg. */
  backdrop?: StoredImage
  /** Absent means the site is not scheduled to go down. */
  maintenance?: MaintenanceWindow
}

export async function getSiteSettings(): Promise<SiteSettings> {
  const snapshot = await getDoc(settingsRef)
  return snapshot.exists() ? (snapshot.data() as SiteSettings) : {}
}

/**
 * null resets to the default backdrop rather than deleting nothing.
 *
 * Merged rather than replaced. This used to overwrite the whole document,
 * which was harmless while a backdrop was the only thing in it and would now
 * cancel a scheduled maintenance window as a side effect of changing a
 * photograph.
 */
export async function setBackdrop(image: StoredImage | null): Promise<void> {
  await setDoc(settingsRef, { backdrop: image ?? deleteField() }, { merge: true })
}

/** null cancels a scheduled window. */
export async function setMaintenance(window: MaintenanceWindow | null): Promise<void> {
  await setDoc(settingsRef, { maintenance: window ?? deleteField() }, { merge: true })
}
