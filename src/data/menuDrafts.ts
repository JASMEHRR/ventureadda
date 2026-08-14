import type { MenuItemDraft } from './types'

/**
 * Decides which draft rows get submitted, and refuses the ambiguous ones.
 *
 * Pure and separate from the form so it can be tested without rendering
 * anything. It is worth testing: every failure mode here is silent by nature —
 * a dropped row or a zero price submits successfully and goes wrong later, in
 * front of a buyer.
 */
export type MenuDraftResult =
  | { ok: true; items: MenuItemDraft[] }
  | { ok: false; error: string }

function isBlank(item: MenuItemDraft): boolean {
  return (
    item.name.trim() === '' &&
    item.price.trim() === '' &&
    item.description.trim() === '' &&
    item.photo === undefined
  )
}

export function validateMenuDrafts(items: MenuItemDraft[]): MenuDraftResult {
  // Wholly empty rows are discarded without comment — leaving the spare row
  // alone is not a mistake anyone needs telling about.
  const started = items.filter((item) => !isBlank(item))

  // A row with a price, a description or a photo but no name used to be
  // dropped on the floor: the form reported success and the item was gone.
  // Silent data loss is the worst way to fail, because the owner has no reason
  // to check and finds out when a buyer asks for something that is not listed.
  const nameless = started.find((item) => item.name.trim() === '')
  if (nameless) {
    // Numbered against the original list, which is how the rows on screen are
    // numbered. Reporting a position within the filtered list would point at
    // the wrong row as soon as any row above it is blank.
    return {
      ok: false,
      error: `Item ${items.indexOf(nameless) + 1} has details but no name. Give it a name, or clear the row to drop it.`,
    }
  }

  if (started.length === 0) {
    return { ok: false, error: 'Add at least one item to your menu — that is what buyers tap.' }
  }

  // Number('') is 0, which is finite and not negative, so a named item with no
  // price used to publish at ₹0 — a wrong price in front of a buyer, which is
  // worse than no listing.
  const badPrice = started.find((item) => {
    const value = Number(item.price)
    return item.price.trim() === '' || !Number.isFinite(value) || value < 0
  })
  if (badPrice) {
    return { ok: false, error: `"${badPrice.name}" needs a price in whole rupees.` }
  }

  return { ok: true, items: started }
}
