import type { MenuItemInput, VentureInput } from './ventures'

/**
 * Demo content the moderator can import into an empty directory.
 *
 * Part 7 of the plan is blunt about this: an empty directory gets no
 * submissions, so seeding first is the difference between a link worth sharing
 * and one that looks broken.
 *
 * Photos point at files in public/seed rather than Cloudinary, so they carry no
 * public id and render through their plain URL. Replace these with real
 * ventures as soon as you have them.
 *
 * PHONE NUMBERS ARE DELIBERATELY INVALID. A plausible-looking Indian mobile
 * number would almost certainly belong to a real person, and every tap of the
 * WhatsApp button would open a chat with a stranger. These resolve to
 * WhatsApp's "phone number is invalid" page instead, which exercises the whole
 * flow without messaging anyone.
 */
export type SeedVenture = {
  venture: VentureInput
  items: MenuItemInput[]
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
      photos: [photo('pastries.jpg'), photo('cake.jpg'), photo('brownies.jpg')],
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
      photos: [photo('rack.jpg'), photo('tote.jpg')],
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
]
