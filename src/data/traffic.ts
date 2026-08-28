import {
  collection,
  doc,
  documentId,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '../lib/firebase'

/**
 * How many people came to the site, counted a day at a time.
 *
 * WHY NOT A ROW PER VISIT. That is the obvious design and it is the expensive
 * one: every visit becomes a document, forever, and the moderator page then
 * reads thousands of them to draw one number. A counter per day is one
 * document per day, one write per visit, and a fortnight of history is a
 * fourteen-document read.
 *
 * WHY NOT VERCEL ANALYTICS or anything similar. This site is on free tiers
 * throughout and the question being asked is small — is anybody coming, and is
 * it more than last week. That is a number in a database, not a product.
 *
 * ONE COUNT PER SESSION, NOT PER PAGE. A single-page app navigates without
 * reloading, so counting page views would count how much somebody clicked
 * around rather than whether they came. `sessionStorage` is exactly the right
 * scope for that: it lasts as long as the tab and dies with it, so a return
 * visit tomorrow counts again and a rummage through six ventures does not.
 *
 * IT IS DELIBERATELY CRUDE. No identity, no fingerprint, no cookie that
 * outlives the tab, nothing about who anybody is — the whole record is a date
 * and a number. Somebody who opens the site on their phone and their laptop is
 * two, and somebody who clears their tab is two tomorrow. That is honest
 * enough for the question, and it is the smallest thing that answers it.
 */
const trafficRef = collection(db, 'traffic')

/** The key a day's counter is stored under, in the reader's own timezone —
 *  everyone using this site is in one, and UTC would put an evening's visits
 *  under tomorrow's date. */
function dayKey(at = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`
}

const SESSION_KEY = 'ventureadda:counted'

export type TrafficDay = { day: string; count: number }

/**
 * Counts this visit, once per tab.
 *
 * Never throws and never blocks: a refused write, a blocked storage API or an
 * offline phone must not cost somebody the page they came for. The number
 * being one short is not worth a broken render.
 */
export async function recordVisit(): Promise<void> {
  try {
    if (window.sessionStorage.getItem(SESSION_KEY)) return
    window.sessionStorage.setItem(SESSION_KEY, '1')
  } catch {
    // Storage blocked. Counting every navigation is worse than counting none,
    // so this stops here rather than falling through.
    return
  }

  const today = doc(trafficRef, dayKey())
  try {
    // UPDATE FIRST, CREATE ONLY IF THERE IS NOTHING THERE — and the order is
    // the fix rather than a preference.
    //
    // `setDoc({ count: increment(1) }, { merge: true })` looks like it handles
    // both, and it does not. An increment is a field TRANSFORM, and on a
    // document that does not exist yet the transformed field is not visible to
    // the security rules at all: `request.resource.data.count` is simply
    // absent, so a create rule asserting `count == 1` can never pass. The
    // first visit of every day was silently refused and the counter never
    // started. On an existing document the transform is visible, which is why
    // the venture click counter — an update, always — has always worked.
    //
    // So: increment when there is something to increment, and write a literal
    // 1 when there is not.
    await updateDoc(today, { count: increment(1) })
  } catch {
    try {
      await setDoc(today, { count: 1 })
    } catch {
      // Refused, or offline. Nothing to tell the visitor about — they came
      // here to read a menu.
    }
  }
}

/**
 * The most recent days, newest first. Moderators only, per the rules.
 *
 * A RANGE RATHER THAN A SORT-AND-LIMIT, and that is not a style choice.
 * `orderBy(documentId(), 'desc')` with a limit is the obvious way to say "the
 * last fourteen" and Firestore refuses it without a composite index — a
 * failed-precondition error the panel swallowed, so it sat there reporting
 * nothing counted while the counter behind it was on six.
 *
 * Asking for every id at or after a cutoff date needs no index at all: it is a
 * single-field range on the document id, which every collection has by
 * default. The ids are YYYY-MM-DD, so they sort lexicographically in
 * chronological order, and the reversing is done here rather than by the
 * database — fourteen items.
 */
export async function listTraffic(days = 14): Promise<TrafficDay[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - (days - 1))

  const snapshot = await getDocs(
    query(trafficRef, where(documentId(), '>=', dayKey(cutoff))),
  )

  return snapshot.docs
    .map((document) => ({
      day: document.id,
      count: typeof document.data().count === 'number' ? (document.data().count as number) : 0,
    }))
    .sort((a, b) => b.day.localeCompare(a.day))
}
