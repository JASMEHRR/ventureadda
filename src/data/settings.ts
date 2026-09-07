import { deleteField, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore'
import { db } from '../lib/firebase'
import { clampSeconds } from './billboardPick'
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
  /**
   * Whether signing in by email address is offered at all.
   *
   * OFF UNLESS A MODERATOR TURNS IT ON, and the reason is a quota rather than
   * a preference. Firebase's free tier caps the mail it will send, and the
   * sign-in link spends that cap — once it is gone, the email route stops
   * working for everybody and the failure looks like the site being broken.
   * Google sign-in sends no mail at all and is unaffected, so it carries the
   * whole load until there is a mail budget to spend.
   */
  emailSignIn?: boolean
  /**
   * The words on the front page.
   *
   * EDITABLE BECAUSE THEY ARE A GUESS. Nobody knows which line makes a
   * student stop scrolling — "Hungry?" is a hypothesis, and the only way to
   * find out is to change it on a Tuesday and see. That is a bad reason to
   * need a developer and a deploy, so it lives here with the backdrop and the
   * maintenance window: a moderator types it and the site says it.
   *
   * Absent means the wording shipped in the code, which is what every visitor
   * saw before this existed and what a reset goes back to.
   */
  landing?: LandingCopy
  /**
   * How long each advert holds the billboard, in seconds.
   *
   * A MODERATOR'S DIAL BECAUSE IT IS A GUESS, the same argument as the landing
   * copy above. Fifteen seconds is a hypothesis about how long somebody looks
   * at the top of a page, and the number that turns out to be right depends on
   * how many adverts are running and how long the lines are — neither of which
   * was knowable when it was written. Needing a developer and a deploy to try
   * twelve is a bad reason not to try twelve.
   *
   * Absent means the shipped default. See BILLBOARD_SECONDS.
   */
  billboardSeconds?: number
}

export type LandingCopy = {
  /** The hook, on its own line and largest. "Hungry?" */
  hook?: string
  /** The answer under it. "Someone on campus is already selling it." */
  line?: string
  /** The sentence under both, naming what is actually for sale. */
  sub?: string
  /** The buyer's door. "See what's on sale" */
  buyLabel?: string
  /** The seller's door. "Sell something" */
  sellLabel?: string
}

/**
 * The wording the site ships with.
 *
 * Here rather than inside the page so the moderator's form can show each one
 * as its placeholder: an empty box that displays what will be used is a reset
 * button that needs no explaining.
 */
export const LANDING_DEFAULTS: Required<LandingCopy> = {
  hook: 'Hungry?',
  line: 'Someone on campus is already selling it.',
  sub: 'Brownies at midnight, stickers, crochet, subscriptions, a cold drink two floors down. Run by students, a walk away, no delivery fee.',
  buyLabel: "See what's on sale",
  sellLabel: 'Sell something',
}

/** How long each advert holds the billboard. Clamped — see BILLBOARD_SECONDS. */
export async function setBillboardSeconds(seconds: number): Promise<void> {
  await setDoc(settingsRef, { billboardSeconds: clampSeconds(seconds) }, { merge: true })
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

/** Whether the email sign-in route is offered. Off when unset. */
export async function setEmailSignIn(enabled: boolean): Promise<void> {
  await setDoc(settingsRef, { emailSignIn: enabled }, { merge: true })
}

/** Whether checkout offers "the seller contacts me". Off when unset. */
export async function setSellerContact(enabled: boolean): Promise<void> {
  await setDoc(settingsRef, { sellerContact: enabled }, { merge: true })
}

/**
 * The front page's words. null on a field resets that one to the shipped copy.
 *
 * Written field by field rather than as a whole object so clearing the hook
 * does not take the sub-line with it, and so a future field added in code is
 * not wiped by a moderator saving an older form.
 */
export async function setLandingCopy(copy: LandingCopy): Promise<void> {
  const patch: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(copy)) {
    patch[`landing.${key}`] = value.trim() === '' ? deleteField() : value.trim()
  }
  // The dotted paths above need the document to exist; on a fresh project it
  // does not until something writes to it.
  await setDoc(settingsRef, {}, { merge: true })
  await updateDoc(settingsRef, patch)
}

/** null cancels a scheduled window. */
export async function setMaintenance(window: MaintenanceWindow | null): Promise<void> {
  await setDoc(settingsRef, { maintenance: window ?? deleteField() }, { merge: true })
}
