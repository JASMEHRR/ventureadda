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
  /**
   * Optional, and separate from photos: this is the venture's identity, shown
   * small and square wherever the name appears, while photos are what it sells.
   * Absent is the normal case — VentureLogo falls back to an initial tile.
   */
  logo?: StoredImage
  /**
   * Collection or delivery windows the seller is prepared to offer, in their
   * own words — "6pm – 8pm", "After 9pm, weekends only". Chosen from at
   * checkout rather than typed by the buyer, because a buyer-typed time is a
   * request the seller then has to decline, and a seller who has not set any
   * gets no slot picker at all rather than an empty one.
   */
  deliverySlots: string[]
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
  /**
   * Free text, e.g. "Snacks", "Drinks" — a section within one venture's own
   * menu, not the fixed top-level Category every venture is filed under.
   * Absent items render in a flat list with no heading.
   */
  category?: string
  /**
   * Whether the item can be ordered at all. Deliberately separate from `stock`
   * rather than derived from it: most sellers here bake to order and never
   * count units, so "sold out today" has to be one tap that does not require
   * inventing a number. Absent on documents written before this existed, which
   * is why the reader defaults it to true — an old item must not vanish from
   * every menu the moment this field ships.
   */
  inStock: boolean
  /**
   * Units on hand, when the seller is counting. Absent means they are not, and
   * the buyer's stepper has no ceiling. Zero is a real value and is not the
   * same as absent — it caps the stepper at nothing addable, which is why
   * `inStock` still exists to say so in words.
   */
  stock?: number
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
  category: string
  /** Empty string means "not counting", which is the common case. */
  stock: string
  inStock: boolean
  photo?: StoredImage
}

/**
 * Where the order stands, as far as the seller is concerned.
 *
 * There is no payment gateway anywhere in this product and there is not going
 * to be one, so none of these is verified by anything — they are the seller's
 * own record of a conversation that happened off the site. 'paid' means the
 * seller says they were paid, not that money moved through us.
 */
export type OrderStatus = 'pending' | 'paid' | 'completed'

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: 'Payment pending',
  paid: 'Payment received',
  completed: 'Completed',
}

/**
 * Who reaches out once the order is placed, chosen by the buyer.
 *
 * The seller has no say in this and no way to withhold their number: the
 * number is already on the listing, it is how this site has always worked, and
 * a "hide my number" switch would leave buyers with an order and no way to
 * chase it.
 */
export type ContactPreference = 'buyerContacts' | 'sellerContacts'

/**
 * How the buyer intends to pay. Neither is processed by this site — there is
 * no gateway and no money touches us. 'online' means the buyer will send it
 * by UPI or whatever the two of them agree; it is a statement of intent that
 * saves the seller a question, nothing more.
 */
export type PaymentMethod = 'cod' | 'online'

export const PAYMENT_LABEL: Record<PaymentMethod, string> = {
  cod: 'Cash on delivery',
  online: 'Paying online',
}

/**
 * A line is copied, not referenced.
 *
 * Name and price are frozen at the moment of ordering rather than read back
 * from menuItems, because the seller may edit or delete the item tomorrow and
 * an order that silently reprices itself afterwards is a dispute, not a record.
 */
export type OrderLine = {
  itemId: string
  name: string
  price: number
  quantity: number
}

export type Order = {
  id: string
  ventureId: string
  /** Denormalised so the seller's list needs no second read per order. */
  ventureName: string
  /**
   * Copied from the venture at creation and checked against it by the rules.
   * This is what lets the seller's query be `where ownerId == me` with no
   * per-document get() in the read rule.
   */
  ownerId: string
  buyerUid: string
  buyerName: string
  buyerPhone: string
  lines: OrderLine[]
  /** Whole rupees, summed from the lines at creation. */
  total: number
  contactPreference: ContactPreference
  payment: PaymentMethod
  /**
   * Where it goes. A hostel room or a classroom, in the buyer's own words —
   * this is a campus, not a postal system, and "Hostel J, room 214" is a
   * complete address here while a structured form would be theatre.
   */
  deliveryAddress: string
  /**
   * One of the venture's own `deliverySlots`, or empty when the seller has not
   * published any — in which case the two of them agree a time in the
   * conversation that follows, same as they always have.
   */
  deliverySlot: string
  status: OrderStatus
  /** False until the seller has opened their orders page. Drives the badge. */
  seen: boolean
  /** Null only in the instant before the server timestamp resolves locally. */
  createdAt: Date | null
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
