import type { MenuItemInput, VentureInput } from './ventures'

/**
 * Demo content the moderator can import into an empty directory.
 *
 * Part 7 of the plan is blunt about this: an empty directory gets no
 * submissions, so seeding first is the difference between a link worth sharing
 * and one that looks broken.
 *
 * Photos point at files in public/seed rather than Cloudinary, so they carry no
 * public id and render through their plain URL.
 *
 * Lead photos are chosen against the order browse renders them in, which is
 * alphabetical within a category. Seven images across nine photographed
 * ventures means some are reused; the assignment below only ensures no two
 * cards sitting next to each other lead with the same one, because that reads
 * as a bug rather than as reuse.
 *
 * FIVE OF THESE HAVE NO PHOTO, on purpose. There are seven stock images in
 * public/seed and none of them depicts a repair bench, a print shop or a
 * cycle. Putting a photograph of a tote bag on a phone-repair listing would
 * make the directory look fuller and every one of those cards a small lie.
 * They render the ImageOff placeholder instead. Drop matching images into
 * public/seed and add them here to fix it.
 *
 * Glood is deliberately absent. It is a real business and its details have to
 * come from its owner, not from here — a fabricated listing for a real venture
 * is worse than no listing. It gets added as the flagship once those arrive.
 *
 * PHONE NUMBERS ARE DELIBERATELY INVALID. A plausible-looking Indian mobile
 * number would almost certainly belong to a real person, and every tap of the
 * WhatsApp button would open a chat with a stranger. These resolve to
 * WhatsApp's "phone number is invalid" page instead, which exercises the whole
 * flow without messaging anyone.
 */
/**
 * Fields with a sensible default for demo content are optional here.
 *
 * Every entry below would otherwise have to repeat `deliverySlots: []` and
 * `inStock: true` roughly forty times to say nothing — and the next field with
 * a default would mean touching all forty lines again. `seedInput` fills them
 * in on the way out, so the literals stay about the businesses.
 */
export type SeedVenture = {
  venture: Omit<VentureInput, 'deliverySlots'> & Partial<Pick<VentureInput, 'deliverySlots'>>
  items: (Omit<MenuItemInput, 'inStock'> & Partial<Pick<MenuItemInput, 'inStock'>>)[]
}

/** Fills the defaults so the result is what createVenture actually wants. */
export function seedInput(entry: SeedVenture): { venture: VentureInput; items: MenuItemInput[] } {
  return {
    venture: { deliverySlots: [], ...entry.venture },
    items: entry.items.map((item) => ({ inStock: true, ...item })),
  }
}

const photo = (file: string) => ({ url: `/seed/${file}`, publicId: '' })

export const SEED_VENTURES: SeedVenture[] = [
  {
    venture: {
      name: 'Hostel Bakes',
      categoryId: 'food',
      description:
        'Fresh brownies, jar desserts and celebration cakes, baked in H-block. Order by 6pm for same-day pickup.',
      hours: '4pm – 11pm, daily',
      phone: '910000000001',
      photos: [photo('cake.jpg'), photo('brownies.jpg'), photo('pastries.jpg')],
    },
    items: [
      {
        name: 'Chocolate Fudge Cake',
        description: 'Dark chocolate, 500g, serves four',
        price: 450,
        photo: photo('cake.jpg'),
      },
      {
        name: 'Walnut Brownie Box',
        description: 'Six pieces, freshly baked',
        price: 280,
        photo: photo('brownies.jpg'),
      },
      { name: 'Assorted Cookie Jar', description: 'Choc chip, oatmeal and butter', price: 199 },
    ],
  },
  {
    venture: {
      name: 'Thread & Needle',
      categoryId: 'fashion',
      description:
        'Thrifted and upcycled pieces, plus custom embroidery on anything you already own. Pickup from the main gate.',
      hours: '6pm – 10pm, Mon to Sat',
      phone: '910000000002',
      photos: [photo('tote.jpg'), photo('rack.jpg')],
    },
    items: [
      {
        name: 'Custom Embroidered Tote',
        description: 'Your design, cotton canvas',
        price: 349,
        photo: photo('tote.jpg'),
      },
      {
        name: 'Thrifted Denim Jacket',
        description: 'One of a kind, sizes vary',
        price: 899,
        photo: photo('rack.jpg'),
      },
      { name: 'Embroidered Patch', description: 'Iron-on, any small design', price: 99 },
    ],
  },
  {
    venture: {
      name: 'Inkwell & Bead',
      categoryId: 'art',
      description:
        'Handmade earrings, beaded bracelets and commissioned portraits. Everything made to order, nothing mass produced.',
      hours: '2pm – 9pm, weekends only',
      phone: '910000000003',
      photos: [photo('earrings.jpg'), photo('beads.jpg')],
    },
    items: [
      {
        name: 'Handmade Earrings',
        description: 'Polymer clay, hypoallergenic hooks',
        price: 249,
        photo: photo('earrings.jpg'),
      },
      {
        name: 'Beaded Bracelet',
        description: 'Pick your colours',
        price: 149,
        photo: photo('beads.jpg'),
      },
      { name: 'Custom Portrait, A4', description: 'Ink on paper, from a photo', price: 599 },
    ],
  },
  {
    venture: {
      name: 'Midnight Batter',
      categoryId: 'food',
      description:
        'Cake slices, mug cakes and cold coffee, after the mess shuts. Delivers to all hostels until 2am.',
      hours: '9pm – 2am, daily',
      phone: '910000000004',
      photos: [photo('brownies.jpg')],
    },
    items: [
      { name: 'Cake Slice', description: 'Chocolate, red velvet or vanilla', price: 90 },
      { name: 'Mug Cake', description: 'Ready in a minute, eat from the jar', price: 120 },
      { name: 'Cold Coffee, 300ml', description: 'Sweet or less sweet', price: 70 },
    ],
  },
  {
    venture: {
      name: 'Chai Point Corner',
      categoryId: 'food',
      description:
        'Masala chai, maggi and sandwiches from the back of J-block. Cash or UPI, whatever is quicker.',
      hours: '7am – 11pm, Mon to Sat',
      phone: '910000000005',
      photos: [photo('pastries.jpg')],
    },
    items: [
      { name: 'Masala Chai', description: 'Cutting or full glass', price: 20 },
      { name: 'Cheese Maggi', description: 'Two minutes, extra cheese', price: 60 },
      { name: 'Grilled Sandwich', description: 'Veg, with chutney', price: 80 },
    ],
  },
  {
    venture: {
      name: 'The Sweet Jar',
      categoryId: 'food',
      description:
        'Dessert jars, cheesecakes and festival mithai boxes, made to order with a day of notice.',
      hours: '5pm – 10pm, order a day ahead',
      phone: '910000000006',
      photos: [photo('cake.jpg'), photo('brownies.jpg')],
    },
    items: [
      { name: 'Biscoff Jar', description: 'Layered, 200ml', price: 180 },
      { name: 'Baked Cheesecake Slice', description: 'New York style', price: 220 },
      { name: 'Mithai Box, 500g', description: 'Assorted, for festivals', price: 450 },
    ],
  },
  {
    venture: {
      name: 'Second Rack',
      categoryId: 'fashion',
      description:
        'Thrifted shirts, jackets and jeans, all sized and photographed. What you see is the exact piece.',
      hours: '6pm – 10pm, daily',
      phone: '910000000007',
      photos: [photo('rack.jpg')],
    },
    items: [
      { name: 'Oversized Shirt', description: 'Thrifted, sizes M to XL', price: 349 },
      { name: 'Straight Fit Jeans', description: 'Washed, sizes 30 to 36', price: 499 },
      { name: 'Windcheater', description: 'Light, good for early mornings', price: 599 },
    ],
  },
  {
    venture: {
      name: 'Knot & Tote',
      categoryId: 'fashion',
      description:
        'Hand-painted tote bags and crocheted accessories. Bring your own design or pick from the album.',
      hours: '4pm – 9pm, Tue to Sun',
      phone: '910000000008',
      photos: [photo('tote.jpg')],
    },
    items: [
      { name: 'Painted Tote', description: 'Cotton canvas, your design', price: 399 },
      { name: 'Crochet Bag Charm', description: 'Small, made to order', price: 149 },
      { name: 'Scrunchie Set of 3', description: 'Matching fabrics', price: 129 },
    ],
  },
  {
    venture: {
      name: 'Paper & Pigment',
      categoryId: 'art',
      description:
        'Watercolour prints, bookmarks and hand-lettered cards for birthdays and farewells.',
      hours: '3pm – 10pm, daily',
      phone: '910000000009',
      photos: [photo('beads.jpg')],
    },
    items: [
      { name: 'A5 Print', description: 'Watercolour, thick paper', price: 149 },
      { name: 'Hand-lettered Card', description: 'Your message, written in', price: 99 },
      { name: 'Bookmark Set of 4', description: 'Laminated', price: 120 },
    ],
  },
  {
    venture: {
      name: 'Frame by Frame',
      categoryId: 'services',
      description:
        'Event and portfolio photography around campus, plus edited photos returned within two days.',
      hours: 'By appointment, evenings and weekends',
      phone: '910000000010',
      photos: [],
    },
    items: [
      { name: 'Portrait Session, 1hr', description: '20 edited photos', price: 1200 },
      { name: 'Event Coverage, 3hr', description: 'Fests, farewells, birthdays', price: 2500 },
      { name: 'Photo Editing, per 10', description: 'Send your own shots', price: 300 },
    ],
  },
  {
    venture: {
      name: 'Sorted Notes',
      categoryId: 'services',
      description:
        'Printing, spiral binding and last-minute assignment formatting. Drop a PDF on WhatsApp and collect.',
      hours: '9am – 9pm, Mon to Sat',
      phone: '910000000011',
      photos: [],
    },
    items: [
      { name: 'B&W Print, per page', description: 'A4, double sided available', price: 2 },
      { name: 'Spiral Binding', description: 'Up to 200 pages', price: 60 },
      { name: 'Report Formatting', description: 'Margins, headers, contents page', price: 200 },
    ],
  },
  {
    venture: {
      name: 'Fix My Phone',
      categoryId: 'tech',
      description:
        'Screen and battery replacements for most Android phones, done the same day. Parts quoted before any work starts.',
      hours: '11am – 8pm, Mon to Sat',
      phone: '910000000012',
      photos: [],
    },
    items: [
      { name: 'Screen Replacement', description: 'Price varies by model, this is labour', price: 500 },
      { name: 'Battery Replacement', description: 'Including the battery', price: 1200 },
      { name: 'Software Reset', description: 'Backup, wipe and restore', price: 300 },
    ],
  },
  {
    venture: {
      name: 'Cable Guy',
      categoryId: 'tech',
      description:
        'Chargers, cables, earphones and extension boards at less than the campus store charges.',
      hours: '6pm – 11pm, daily',
      phone: '910000000013',
      photos: [],
    },
    items: [
      { name: 'Type-C Cable, 1m', description: 'Braided, 65W', price: 199 },
      { name: 'Extension Board, 4 socket', description: 'With surge protection', price: 449 },
      { name: 'Wired Earphones', description: 'With mic', price: 249 },
    ],
  },
  {
    venture: {
      name: 'Cycle Doctor',
      categoryId: 'other',
      description:
        'Cycle repairs, punctures and servicing, done outside your hostel gate. Also buys and sells second-hand cycles.',
      hours: '5pm – 9pm, daily',
      phone: '910000000014',
      photos: [],
    },
    items: [
      { name: 'Puncture Repair', description: 'Per tube', price: 50 },
      { name: 'Full Service', description: 'Brakes, chain, gears, cleaning', price: 300 },
      { name: 'Second-hand Cycle', description: 'Serviced, varies by condition', price: 2500 },
    ],
  },
]
