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

/**
 * `inStock` is deliberately not part of this test. It defaults to true on a
 * fresh row, so treating it as content would make every spare row non-blank
 * and resurrect the very rows this filter exists to discard.
 */
function isBlank(item: MenuItemDraft): boolean {
  return (
    item.name.trim() === '' &&
    item.price.trim() === '' &&
    item.description.trim() === '' &&
    item.category.trim() === '' &&
    item.stock.trim() === '' &&
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

  /**
   * A PRICE IS OPTIONAL NOW. It used to be required, on the reasoning that ₹0
   * in front of a buyer is worse than no listing — which is true, and is not
   * an argument for demanding a number. Plenty of what gets sold here is
   * priced in the conversation: a custom cake, an embroidered jacket, a
   * sticker sheet that depends on how many you want. Refusing those items
   * meant refusing the listing.
   *
   * So an empty price is allowed and means "ask" — the item shows without a
   * number and cannot be added to a cart, because a cart total made of guesses
   * is the failure this whole check was written to prevent. A price that was
   * TYPED and is not a whole non-negative number is still refused: that is a
   * mistake, not a decision.
   */
  const badPrice = started.find((item) => {
    if (item.price.trim() === '') return false
    const value = Number(item.price)
    return !Number.isFinite(value) || value < 0
  })
  if (badPrice) {
    return {
      ok: false,
      error: `"${badPrice.name}" has a price that is not a whole number of rupees. Clear it to let buyers ask instead.`,
    }
  }

  // Blank is the normal case and means "not counting" — only a value that was
  // typed and is not a whole non-negative number is refused. A fractional or
  // negative count would reach the buyer's stepper as a nonsense ceiling.
  const badStock = started.find((item) => {
    if (item.stock.trim() === '') return false
    const value = Number(item.stock)
    return !Number.isInteger(value) || value < 0
  })
  if (badStock) {
    return {
      ok: false,
      error: `"${badStock.name}" needs a whole number of units in stock, or nothing at all.`,
    }
  }

  return { ok: true, items: started }
}
