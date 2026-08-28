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
  /**
   * Whether checkout offers "the seller contacts me".
   *
   * OFF UNLESS A MODERATOR TURNS IT ON, and the default is the point. The
   * option puts an order on the seller's dashboard and then asks the buyer to
   * wait for a call — which is a promise the site cannot keep, because nothing
   * here makes a seller open that dashboard. A buyer who picks it and hears
   * nothing concludes the site is broken, and they are not wrong. Every order
   * therefore goes out the way the site can actually deliver: the buyer taps
   * through to WhatsApp with the order written out.
   *
   * It stays in the code rather than being deleted because the sellers who do
   * watch their dashboard are exactly who it was built for, and turning it
   * back on is one switch on the moderator page.
   */
  sellerContact?: boolean
  /** Absent means the default backdrop baked into the app, public/atmosphere.jpg. */
  backdrop?: StoredImage
  /**
   * The wallpaper for day mode, which needs its own picture rather than the
   * night one turned up.
   *
   * The shipped backdrop is a night sky. Light panels with dark text cannot
   * sit on it, so day mode washes it out — and washing out a starfield leaves
   * exactly the stars, which read as snow on a blank page. There is no
   * treatment of a dark photograph that makes it a light one; the honest fix
   * is a second photograph. Until one is set, day mode uses a plain gradient,
   * which at least looks chosen.
   */
  backdropLight?: StoredImage
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

/** null clears the day wallpaper and falls back to the gradient. */
export async function setBackdropLight(image: StoredImage | null): Promise<void> {
  await setDoc(settingsRef, { backdropLight: image ?? deleteField() }, { merge: true })
}

/** Whether checkout offers "the seller contacts me". Off when unset. */
export async function setSellerContact(enabled: boolean): Promise<void> {
  await setDoc(settingsRef, { sellerContact: enabled }, { merge: true })
}

/** null cancels a scheduled window. */
export async function setMaintenance(window: MaintenanceWindow | null): Promise<void> {
  await setDoc(settingsRef, { maintenance: window ?? deleteField() }, { merge: true })
}
