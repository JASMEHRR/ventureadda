/**
 * Builds the wa.me link that is the entire point of this site.
 *
 * No payment, no in-app messaging, no account needed on the buyer's side —
 * the tap hands the conversation to WhatsApp with the order already itemised,
 * and the two of them settle it themselves.
 */

/** Strips anything that is not a digit; wa.me rejects +, spaces and dashes. */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export type CartLine = { name: string; price: number; quantity: number }
export type Buyer = { name: string; phone: string }

/**
 * One line per item, then the total, then who to call back.
 *
 * The buyer's own number reaches the vendor anyway the moment they send this
 * from their own WhatsApp — it is in the message text too because a vendor
 * mid-rush finds a number in the text faster than they'd scroll up to a
 * contact card, and it is what lets the vendor call instead of typing back.
 */
export function cartMessage(ventureName: string, items: CartLine[], buyer: Buyer): string {
  const lines = items.map((item) => `${item.quantity} × ${item.name} — ₹${item.price * item.quantity}`)
  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  return [
    `Hi ${ventureName}, I found you on VentureAdda and want to order:`,
    '',
    ...lines,
    '',
    `Total: ₹${total}`,
    '',
    `Name: ${buyer.name}`,
    `Number: ${buyer.phone}`,
  ].join('\n')
}

/**
 * Returns null when either number is unusable, so the caller can disable the
 * button rather than sending someone to a broken WhatsApp page.
 */
export function cartLink(
  ventureNumber: string,
  ventureName: string,
  items: CartLine[],
  buyer: Buyer,
): string | null {
  const digits = normalisePhone(ventureNumber)
  // Shortest plausible international number is around 8 digits; longest valid
  // E.164 is 15. Anything outside that is a data-entry mistake.
  if (digits.length < 8 || digits.length > 15) return null
  const buyerDigits = normalisePhone(buyer.phone)
  if (buyerDigits.length < 8 || buyerDigits.length > 15) return null
  if (items.length === 0) return null

  return `https://wa.me/${digits}?text=${encodeURIComponent(cartMessage(ventureName, items, { ...buyer, phone: buyerDigits }))}`
}
