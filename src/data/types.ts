export type Category = {
  id: string
  name: string
}

export type VentureStatus = 'pending' | 'live' | 'rejected'

/**
 * Both halves are stored. The URL is what renders; the public id is the only
 * thing that can delete the asset later, and Cloudinary will not accept a URL
 * in its place.
 */
export type StoredImage = {
  url: string
  publicId: string
}

export type Venture = {
  id: string
  ownerId: string
  ownerUsername: string
  name: string
  categoryId: string
  description: string
  hours: string
  /** International format, no plus sign — the shape wa.me expects. */
  phone: string
  photos: StoredImage[]
  status: VentureStatus
  rejectionReason?: string
  clickCount: number
  /**
   * Placeholder content, not a real business.
   *
   * Stored on the document rather than inferred from the owner, because the
   * moderator who imports demo data is also the person with real listings of
   * their own — "owned by the owner" cannot tell the two apart. It is what
   * makes "remove all demo data" a single action, and what puts the badge on
   * the card so a visitor never messages a venture that does not exist.
   */
  isDemo?: boolean
  // No rating or reviewCount here on purpose. A denormalised score would need
  // its own write path on this document, open to anyone signed in, and rules
  // cannot verify that a claimed delta matches a real review — so a rating
  // could be moved without leaving anything to delete. Averages are computed
  // from the reviews collection instead, which means the only way to shift a
  // score is to leave a review a moderator can remove.
}

export type MenuItem = {
  id: string
  ventureId: string
  name: string
  description?: string
  /** Whole rupees. No fractional currency anywhere in this product. */
  price: number
  photo?: StoredImage
  inquiryCount: number
}

/** Draft shape the form works with, before anything reaches Firestore. */
export type MenuItemDraft = {
  /** Local only, for React keys while editing. */
  key: string
  id?: string
  name: string
  description: string
  price: string
  photo?: StoredImage
}

/**
 * The six launch categories from the plan, Part 7.
 *
 * Deliberately a constant rather than a Firestore collection. Renaming or
 * removing one would orphan every venture filed under it, so that needs a
 * migration path rather than a delete button — see the moderator panel note.
 */
export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Snacks' },
  { id: 'fashion', name: 'Fashion & Accessories' },
  { id: 'art', name: 'Art & Craft' },
  { id: 'services', name: 'Services' },
  { id: 'tech', name: 'Tech & Gadgets' },
  { id: 'other', name: 'Other' },
]

export function categoryName(id: string): string {
  return CATEGORIES.find((category) => category.id === id)?.name ?? 'Other'
}
