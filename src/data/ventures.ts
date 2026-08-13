import { CATEGORIES, MENU_ITEMS, VENTURES } from './seed'
import type { Category, MenuItem, Venture } from './seed'

export type { Category, MenuItem, Venture }

/**
 * The whole data boundary for the app. Pages call only these functions and
 * never touch the seed arrays, so pointing VentureAdda at Firestore is a
 * change to this one file.
 *
 * Every function is async even though the seed data is synchronous. That is
 * the point: Firestore reads are promises, and writing the call sites against
 * promises now means the swap does not ripple into loading states across every
 * page later.
 */

/** Tap counts survive reloads so the counter demonstrates something real. */
const INQUIRY_STORAGE_KEY = 'ventureadda.inquiryCounts.v1'

type CountMap = Record<string, number>

function readLocalCounts(): CountMap {
  try {
    const raw = localStorage.getItem(INQUIRY_STORAGE_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    // Trust nothing from storage: another tab, an old build or a user with
    // devtools open can all put arbitrary shapes here.
    const clean: CountMap = {}
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === 'number' && Number.isFinite(value) && value >= 0) clean[key] = value
    }
    return clean
  } catch {
    // Malformed JSON, or storage blocked in private browsing. Counts are a
    // nice-to-have, so degrade to zero rather than breaking the menu.
    return {}
  }
}

function writeLocalCounts(counts: CountMap): void {
  try {
    localStorage.setItem(INQUIRY_STORAGE_KEY, JSON.stringify(counts))
  } catch {
    // Quota exceeded or storage disabled. The tap still opens WhatsApp, which
    // is the part that matters, so this is not worth surfacing to the user.
  }
}

function matchesQuery(venture: Venture, items: MenuItem[], query: string): boolean {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  if (venture.name.toLowerCase().includes(needle)) return true
  if (venture.description.toLowerCase().includes(needle)) return true
  if (venture.ownerName.toLowerCase().includes(needle)) return true
  // Searching "brownie" should find the venture that sells brownies, not just
  // ventures with "brownie" in their name.
  return items.some((item) => item.name.toLowerCase().includes(needle))
}

export async function listCategories(): Promise<Category[]> {
  return CATEGORIES
}

export async function listVentures(
  options: { categoryId?: string; query?: string } = {},
): Promise<Venture[]> {
  const { categoryId, query = '' } = options
  return VENTURES.filter((venture) => {
    if (venture.status !== 'live') return false
    if (categoryId && venture.categoryId !== categoryId) return false
    const items = MENU_ITEMS.filter((item) => item.ventureId === venture.id)
    return matchesQuery(venture, items, query)
  })
}

export async function getVenture(ventureId: string): Promise<Venture | null> {
  return VENTURES.find((venture) => venture.id === ventureId && venture.status === 'live') ?? null
}

export async function listMenuItems(ventureId: string): Promise<MenuItem[]> {
  const counts = readLocalCounts()
  return MENU_ITEMS.filter((item) => item.ventureId === ventureId).map((item) => ({
    ...item,
    inquiryCount: item.inquiryCount + (counts[item.id] ?? 0),
  }))
}

/** Count per category, for the Categories page. */
export async function countVenturesByCategory(): Promise<Record<string, number>> {
  const counts: Record<string, number> = {}
  for (const category of CATEGORIES) counts[category.id] = 0
  for (const venture of VENTURES) {
    if (venture.status !== 'live') continue
    counts[venture.categoryId] = (counts[venture.categoryId] ?? 0) + 1
  }
  return counts
}

/**
 * Records an item-level inquiry tap and returns the new total.
 *
 * This is the number the whole commission conversation later rests on — if a
 * venture got 40 taps and reports two sales, that gap is the conversation. It
 * ships in v1 for exactly that reason, well before anyone is charged.
 */
export async function recordInquiry(itemId: string): Promise<number> {
  const counts = readLocalCounts()
  const next = (counts[itemId] ?? 0) + 1
  counts[itemId] = next
  writeLocalCounts(counts)
  const base = MENU_ITEMS.find((item) => item.id === itemId)?.inquiryCount ?? 0
  return base + next
}
