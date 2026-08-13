/**
 * Builds the wa.me link that is the entire point of this site.
 *
 * No payment, no in-app messaging, no account needed on the buyer's side —
 * the tap hands the conversation to WhatsApp with the item already named, and
 * the two of them settle it themselves.
 */

/** Strips anything that is not a digit; wa.me rejects +, spaces and dashes. */
function normalisePhone(phone: string): string {
  return phone.replace(/\D/g, '')
}

export function inquiryMessage(ventureName: string, itemName: string): string {
  return `Hi ${ventureName}, I found you on VentureAdda and wanted to ask about your ${itemName} — is it available, and what's the price?`
}

/**
 * Returns null when the number is unusable, so the caller can disable the
 * button rather than sending someone to a broken WhatsApp page.
 */
export function inquiryLink(phone: string, ventureName: string, itemName: string): string | null {
  const digits = normalisePhone(phone)
  // Shortest plausible international number is around 8 digits; longest valid
  // E.164 is 15. Anything outside that is a data-entry mistake.
  if (digits.length < 8 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(inquiryMessage(ventureName, itemName))}`
}
