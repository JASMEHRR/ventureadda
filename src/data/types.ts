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
  /**
   * Who took it and under what licence, when it came from the photo finder
   * rather than the seller's camera.
   *
   * Absent on every photograph a seller uploaded themselves, which is the
   * common case and needs no credit. Present ones are used under a Creative
   * Commons licence that requires the creator to be named — so this is not
   * metadata, it is the condition the picture is on the page under, and
   * VentureDetail prints it.
   */
  credit?: ImageCredit
  /**
   * Show the whole picture on white rather than cropping it to fill.
   *
   * For product shots — a packet of Kurkure photographed front-on against a
   * plain ground. Cropping one of those to a square takes the ends off the
   * packet, which is the part with the name on it. Padding shows all of it and
   * puts the leftover space on white, which is also what makes a grid of
   * mixed-shape packets look like a shelf rather than a collage.
   *
   * Absent on a seller's own photographs, which are framed the way they framed
   * them and should fill the tile.
   */
  padWhite?: boolean
}

export type ImageCredit = {
  creator: string
  /** "CC BY 2.0", "CC0 1.0" — already formatted for display. */
  license: string
  /** The page the photograph came from, for anyone checking. */
  source: string
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
  /**
   * The grid this seller wants their own menu shown in. Absent on every
   * venture written before this field existed, and 'default' is exactly what
   * those were rendered as, so the reader fills it in rather than treating it
   * as a missing setting.
   */
  /**
   * The readable name in this venture's link, e.g. "glood".
   *
   * Absent on every venture written before slugs existed, and on any whose
   * claim lost a race. The document id still resolves and always will, so an
   * absent slug means a longer link rather than a broken one.
   */
  slug?: string
  /**
   * Addresses allowed to edit this listing besides the owner's own.
   *
   * Lower-cased, and compared in the rules against the signed-in token's
   * verified address — so this is a real permission, not a display field.
   * A co-owner may edit the venture and its menu; they cannot delete it,
   * change the owner, or edit this list. See firestore.rules.
   */
  managerEmails: string[]
  /**
   * What this shop sells, in one word: "Stickers", "Crochet",
   * "Subscriptions", "Cakes".
   *
   * THE PRODUCTS PAGE NEEDS A PARENT for a seller's own sections, and nothing
   * in the data was one. A rail listing "F1, Cars & Car Logos" tells a visitor
   * nothing — F1 what? Stickers, posters, phone cases? Under a heading that
   * says Stickers it is obvious, and it stays obvious for the twenty other
   * sections that shop will add.
   *
   * The six launch categories cannot do this job. They are deliberately broad
   * — "Art & Craft" covers stickers, crochet and painting alike — and they are
   * filled in once at signup and rarely revisited, so half of them are wrong
   * anyway: the subscriptions shop on this site is filed under Food & Snacks.
   *
   * Empty is normal and means "use the category", which is what every venture
   * written before this field existed gets.
   */
  kind: string
  /**
   * When the seller last touched this listing, by their own hand.
   *
   * NOT A DISPLAY DETAIL — it is the only way anyone can tell a shop that is
   * still trading from one that closed in April. Sold-out is a switch somebody
   * has to remember to flip, and the ones who stop selling are exactly the ones
   * who stop coming back to flip it, so the menu goes on offering things that
   * are not there.
   *
   * Absent on every venture written before this existed, and absent is not
   * "stale": nothing can be said about a listing whose last edit was never
   * recorded, so the reader shows nothing at all rather than guessing.
   */
  updatedAt?: Date | null
  /**
   * Draw items with no photograph as the logo of the brand they name.
   *
   * OFF UNLESS THE SELLER SAYS OTHERWISE, and that is the whole point of it
   * being a setting rather than something inferred. A shop reselling software
   * lists a hundred and fifty products it will never photograph, every one of
   * them a company with a logo people recognise. A bakery is not that shop —
   * its unphotographed "Monster white" was drawn with the logo of monster.com,
   * a jobs board, which is a claim about what is in the bottle.
   *
   * Every heuristic tried here (a long menu, mostly unphotographed) put real
   * bakeries on the wrong side of the line. The seller knows; nobody else
   * does. See components/ui/BrandIcon.
   */
  brandLogos: boolean
  menuDensity: MenuDensity
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

/**
 * How tightly a menu is packed into its grid.
 *
 * The seller picks one, because they are the only person who knows what their
 * items look like: four photographed cakes want the room, forty stationery
 * items at ₹10 each do not, and a single grid tuned for the average serves
 * neither. A buyer can still override it for their own screen — see
 * `menuDensity` in lib/appearance.ts — which is why this is a default rather
 * than a lock.
 */
export type MenuDensity = 'roomy' | 'default' | 'dense' | 'list'

export const MENU_DENSITIES: MenuDensity[] = ['roomy', 'default', 'dense', 'list']

/**
 * Column counts per density, smallest breakpoint first.
 *
 * Written out as whole class strings rather than assembled from parts, because
 * Tailwind scans source text for complete class names — `grid-cols-${n}` is a
 * class that never reaches the stylesheet.
 */
export const MENU_GRID_CLASS: Record<MenuDensity, string> = {
  roomy: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  default: 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4',
  dense: 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-6',
  /**
   * A LIST, NOT A GRID — one column, and each item a row rather than a card.
   *
   * A photo grid is the right shape for a bakery: four cakes, four
   * photographs, and the picture is most of what the buyer is deciding on. It
   * is the wrong shape for a hundred and fifty software subscriptions, which
   * have no photographs at all — that page renders as screen after screen of
   * identical empty tiles, each a placeholder above a name.
   *
   * Same items, same data; the row simply puts the name first and drops the
   * space a picture would have taken.
   */
  list: 'grid-cols-1',
}

export type MenuItem = {
  id: string
  ventureId: string
  name: string
  description?: string
  /**
   * Whole rupees, or absent when the seller has not set one.
   *
   * Absent means "ask" rather than free: the item is shown without a number
   * and cannot be added to a cart, because a total made partly of guesses is
   * worse than no total. Plenty here is priced in conversation — a custom
   * cake, an embroidered jacket — and refusing those items refused the listing.
   */
  price?: number
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
