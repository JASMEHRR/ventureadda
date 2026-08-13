/**
 * Seed content for Step 1, standing in for Firestore.
 *
 * The shapes below mirror the collections in the plan (ventures, menuItems,
 * categories) so moving to Firestore is a change of source, not of model.
 *
 * PHONE NUMBERS ARE DELIBERATELY INVALID. A plausible-looking Indian mobile
 * number would almost certainly belong to a real person, and every tap of the
 * WhatsApp button would open a chat with a stranger. These resolve to
 * WhatsApp's "phone number is invalid" page instead, which exercises the whole
 * flow without messaging anyone. Replace them with real numbers only when the
 * ventures are real.
 */

export type Category = {
  id: string
  name: string
}

export type Venture = {
  id: string
  name: string
  ownerName: string
  categoryId: string
  description: string
  hours: string
  /** International format, no plus sign — the shape wa.me expects. */
  phone: string
  photos: string[]
  status: 'live' | 'pending' | 'rejected'
  /** Venture-level opens. Item-level counts live on MenuItem. */
  clickCount: number
  rating: number | null
  reviewCount: number
}

export type MenuItem = {
  id: string
  ventureId: string
  name: string
  description?: string
  /** Whole rupees. No fractional currency anywhere in this product. */
  price: number
  photo?: string
  inquiryCount: number
}

/** The six launch categories from the plan, Part 7. */
export const CATEGORIES: Category[] = [
  { id: 'food', name: 'Food & Snacks' },
  { id: 'fashion', name: 'Fashion & Accessories' },
  { id: 'art', name: 'Art & Craft' },
  { id: 'services', name: 'Services' },
  { id: 'tech', name: 'Tech & Gadgets' },
  { id: 'other', name: 'Other' },
]

export const VENTURES: Venture[] = [
  {
    id: 'hostel-bakes',
    name: 'Hostel Bakes',
    ownerName: 'Ananya',
    categoryId: 'food',
    description:
      'Fresh brownies, jar desserts and celebration cakes, baked in H-block. Order by 6pm for same-day pickup.',
    hours: '4pm – 11pm, daily',
    phone: '910000000001',
    photos: ['/seed/pastries.jpg', '/seed/cake.jpg', '/seed/brownies.jpg'],
    status: 'live',
    clickCount: 128,
    rating: 4.6,
    reviewCount: 23,
  },
  {
    id: 'thread-and-needle',
    name: 'Thread & Needle',
    ownerName: 'Kabir',
    categoryId: 'fashion',
    description:
      'Thrifted and upcycled pieces, plus custom embroidery on anything you already own. Pickup from the main gate.',
    hours: '6pm – 10pm, Mon to Sat',
    phone: '910000000002',
    photos: ['/seed/rack.jpg', '/seed/tote.jpg'],
    status: 'live',
    clickCount: 54,
    rating: 4.3,
    reviewCount: 11,
  },
  {
    id: 'inkwell-and-bead',
    name: 'Inkwell & Bead',
    ownerName: 'Meera',
    categoryId: 'art',
    description:
      'Handmade earrings, beaded bracelets and commissioned portraits. Everything made to order, nothing mass produced.',
    hours: '2pm – 9pm, weekends only',
    phone: '910000000003',
    photos: ['/seed/earrings.jpg', '/seed/beads.jpg'],
    status: 'live',
    clickCount: 71,
    rating: 4.8,
    reviewCount: 16,
  },
]

export const MENU_ITEMS: MenuItem[] = [
  {
    id: 'hb-fudge-cake',
    ventureId: 'hostel-bakes',
    name: 'Chocolate Fudge Cake',
    description: 'Dark chocolate, 500g, serves four',
    price: 450,
    photo: '/seed/cake.jpg',
    inquiryCount: 41,
  },
  {
    id: 'hb-brownie-box',
    ventureId: 'hostel-bakes',
    name: 'Walnut Brownie Box',
    description: 'Six pieces, freshly baked',
    price: 280,
    photo: '/seed/brownies.jpg',
    inquiryCount: 63,
  },
  {
    id: 'hb-cookie-jar',
    ventureId: 'hostel-bakes',
    name: 'Assorted Cookie Jar',
    description: 'Choc chip, oatmeal and butter',
    price: 199,
    inquiryCount: 18,
  },
  {
    id: 'tn-custom-tote',
    ventureId: 'thread-and-needle',
    name: 'Custom Embroidered Tote',
    description: 'Your design, cotton canvas',
    price: 349,
    photo: '/seed/tote.jpg',
    inquiryCount: 27,
  },
  {
    id: 'tn-denim-jacket',
    ventureId: 'thread-and-needle',
    name: 'Thrifted Denim Jacket',
    description: 'One of a kind, sizes vary',
    price: 899,
    photo: '/seed/rack.jpg',
    inquiryCount: 12,
  },
  {
    id: 'tn-patch',
    ventureId: 'thread-and-needle',
    name: 'Embroidered Patch',
    description: 'Iron-on, any small design',
    price: 99,
    inquiryCount: 8,
  },
  {
    id: 'ib-earrings',
    ventureId: 'inkwell-and-bead',
    name: 'Handmade Earrings',
    description: 'Polymer clay, hypoallergenic hooks',
    price: 249,
    photo: '/seed/earrings.jpg',
    inquiryCount: 34,
  },
  {
    id: 'ib-bracelet',
    ventureId: 'inkwell-and-bead',
    name: 'Beaded Bracelet',
    description: 'Pick your colours',
    price: 149,
    photo: '/seed/beads.jpg',
    inquiryCount: 22,
  },
  {
    id: 'ib-portrait',
    ventureId: 'inkwell-and-bead',
    name: 'Custom Portrait, A4',
    description: 'Ink on paper, from a photo',
    price: 599,
    inquiryCount: 15,
  },
]
