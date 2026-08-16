import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Clock,
  MessageCircle,
  Minus,
  Phone,
  Plus,
  SearchX,
  ShoppingCart,
} from 'lucide-react'
import Button from '../components/ui/Button'
import ChoiceGroup from '../components/ui/ChoiceGroup'
import EmptyState from '../components/ui/EmptyState'
import Field from '../components/ui/Field'
import Modal from '../components/ui/Modal'
import TextField, { inputClass } from '../components/ui/TextField'
import ReviewSection from '../components/ReviewSection'
import LoadingLine from '../components/ui/LoadingLine'
import VentureLogo from '../components/ui/VentureLogo'
import { LogoMark } from '../components/ui/Logo'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems, recordInquiry, recordVentureView } from '../data/ventures'
import type { MenuItem, Venture } from '../data/ventures'
import { createOrder } from '../data/orders'
import { orderTotal } from '../data/orderLines'
import type { ContactPreference, OrderLine, PaymentMethod } from '../data/orders'
import { notifyOrderPlaced } from '../lib/notifyOrder'
import { cartLink } from '../lib/whatsapp'
import type { Buyer } from '../lib/whatsapp'
import { displayUrl } from '../lib/cloudinary'

function PhotoGallery({ venture }: { venture: Venture }) {
  const [active, setActive] = useState(0)
  const photo = venture.photos[active]
  if (!photo) return null

  return (
    <div className="liquid-glass-panel rounded-3xl p-3">
      <img
        src={displayUrl(photo, 800)}
        alt={`${venture.name}, photo ${active + 1} of ${venture.photos.length}`}
        // max-h wins over the aspect ratio once the container is wide. Without
        // it, removing the page's max-width turned this into a 1140px-tall
        // photo you had to scroll past to reach the menu -- on a page whose
        // whole purpose is tapping a menu item.
        className="aspect-4/3 max-h-[60vh] w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
      />
      {venture.photos.length > 1 && (
        <div className="mt-3 flex gap-2 px-1 pb-1">
          {venture.photos.map((image, index) => (
            <button
              key={image.url + index}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 transition duration-150 active:scale-[0.94] ${
                index === active ? 'ring-brand-400' : 'ring-white/10 hover:ring-white/30'
              }`}
            >
              <img src={displayUrl(image, 400)} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * How many more of this item may be added.
 *
 * `stock` absent means the seller is not counting, so there is no ceiling.
 * Zero stock is a real answer and caps at zero.
 */
function remaining(item: MenuItem, quantity: number): number {
  if (item.stock === undefined) return Infinity
  return Math.max(0, item.stock - quantity)
}

/**
 * One menu item, with the add control that turns into a counter in place.
 *
 * The whole card used to be one big <button>, which was a nice tap target and
 * is why the counter could not live here — a stepper is two buttons, and
 * nesting buttons is invalid HTML that browsers resolve by throwing the inner
 * ones away. So the card is a plain container now and the strip along its foot
 * is the control: full width for Add, split into − n + once there is one in
 * the order. Adjusting quantity no longer means opening the checkout dialog to
 * find the only steppers in the app.
 */
function ItemCard({
  item,
  quantity,
  askedCount,
  showAsked,
  onSetQuantity,
}: {
  item: MenuItem
  quantity: number
  askedCount: number
  showAsked: boolean
  onSetQuantity: (quantity: number) => void
}) {
  const left = remaining(item, quantity)
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)

  return (
    <div
      className={`liquid-glass-panel flex flex-col overflow-hidden rounded-2xl text-left transition duration-150 ${
        sellable ? '' : 'opacity-60'
      }`}
    >
      <div className="relative">
        {item.photo ? (
          <img
            src={displayUrl(item.photo, 400)}
            alt=""
            loading="lazy"
            className={`aspect-square w-full object-cover ${sellable ? '' : 'grayscale'}`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex aspect-square w-full items-center justify-center bg-white/[0.04] text-white/25"
          >
            <LogoMark size={24} />
          </span>
        )}
        {!sellable && (
          <span className="absolute top-2 left-2 rounded-full border border-red-500/40 bg-black/75 px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider text-red-300 uppercase">
            Sold out
          </span>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-[13.5px] font-bold text-white">{item.name}</p>
        <p className="mt-auto font-mono text-[13px] font-bold text-white/90">₹{item.price}</p>

        {!sellable ? (
          <p className="rounded-xl bg-white/[0.06] py-1.5 text-center font-mono text-[10px] font-bold tracking-wide text-white/40 uppercase">
            Unavailable
          </p>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => onSetQuantity(1)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-1.5 text-[11px] font-bold tracking-wide text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.96]"
          >
            <Plus size={12} aria-hidden="true" />
            Add
            <span className="sr-only">{item.name} to your order</span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-1 rounded-xl bg-brand-500/15 p-1">
            <button
              type="button"
              onClick={() => onSetQuantity(quantity - 1)}
              aria-label={`Remove one ${item.name}`}
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9]"
            >
              <Minus size={13} aria-hidden="true" />
            </button>
            {/* Announced as a live region so a screen-reader user pressing +
                hears the new count without moving focus off the button. */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className="font-mono text-[13px] font-extrabold text-brand-300"
            >
              <span className="sr-only">{item.name}, </span>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onSetQuantity(quantity + 1)}
              disabled={left === 0}
              aria-label={
                left === 0
                  ? `No more ${item.name} in stock`
                  : `Add one more ${item.name}`
              }
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9] disabled:opacity-30"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Only once the ceiling is close enough to matter. "37 left" on a
            sticker sheet is noise; "2 left" is why you order now. */}
        {sellable && item.stock !== undefined && left <= 5 && (
          <p className="font-mono text-[9px] font-bold text-amber-400">
            {left === 0 ? 'That is all of them' : `${left} left`}
          </p>
        )}
        {showAsked && (
          <p className="font-mono text-[9px] font-bold text-brand-400">
            {askedCount.toLocaleString('en-IN')} asked
          </p>
        )}
      </div>
    </div>
  )
}

export default function VentureDetail() {
  const { ventureId = '' } = useParams()
  const { profile, status: authStatus } = useAuth()
  /** itemId -> quantity. Page-local: a cart is for one checkout, not a thing
   *  to resume days later, and this app keeps no account state to hang it on
   *  even if it were. */
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [contactPreference, setContactPreference] = useState<ContactPreference>('buyerContacts')
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [deliveryAddress, setDeliveryAddress] = useState('')
  const [deliverySlot, setDeliverySlot] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placeError, setPlaceError] = useState<string | null>(null)
  /**
   * Set once the order document exists. The dialog switches to a confirmation
   * rather than closing, because the WhatsApp handoff has to be a link the
   * buyer taps: window.open() after an await is not a user gesture any more
   * and popup blockers eat it, which would leave someone who chose "I will
   * message them" with an order placed and nothing having happened.
   */
  const [placed, setPlaced] = useState<{ lines: OrderLine[]; total: number } | null>(null)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})
  /** Category name -> collapsed. Absent means expanded — the default, so a
   *  venture with one section never opens on a page that looks empty. */
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  /** Category name -> its heading element, so the chip row can jump to it. */
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])
  const menu = useAsyncData(() => listMenuItems(ventureId), [ventureId])

  // One venture-level open per visit. Deliberately not in the same effect as
  // the data load, which re-runs whenever the id changes for other reasons.
  useEffect(() => {
    if (!ventureId) return
    void recordVentureView(ventureId)
  }, [ventureId])

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }, [])

  // Expands the section too, in case the chip was tapped while it was
  // folded — landing on a heading with nothing under it defeats the point.
  const jumpToCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: false }))
    sectionRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /**
   * The single write path for cart quantities, used by the card steppers and
   * the ones in the dialog alike. Clamped to the item's stock here rather than
   * at each call site: the ceiling has to hold wherever the number comes from,
   * and a `+` that is merely disabled in the UI is not a rule.
   */
  const setQuantity = useCallback((item: MenuItem, quantity: number) => {
    const ceiling = item.stock ?? Infinity
    const next = Math.min(quantity, ceiling)
    setCart((prev) => {
      if (next <= 0) {
        const rest = { ...prev }
        delete rest[item.id]
        return rest
      }
      return { ...prev, [item.id]: next }
    })
  }, [])

  /**
   * Counting on confirm rather than on the WhatsApp tap: the anchor navigates
   * away the moment it is activated, so anything queued behind it is a race.
   * Confirming is also the honest signal — it is the point the buyer decided.
   *
   * The rules let signed-out visitors do this, capped at exactly plus one per
   * call, so one item added twice to the cart still counts as one ask, not
   * two — the count tracks interest in the item, not units ordered.
   */
  const confirmInquiries = useCallback(async (items: MenuItem[]) => {
    setLocalCounts((prev) => {
      const next = { ...prev }
      for (const item of items) next[item.id] = (prev[item.id] ?? item.inquiryCount) + 1
      return next
    })
    await Promise.allSettled(items.map((item) => recordInquiry(item.id)))
  }, [])

  if (venture.error || menu.error) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-red-400">
        Could not load this venture: {(venture.error ?? menu.error)?.message}
      </p>
    )
  }

  if (venture.loading) {
    return (
      <LoadingLine label="Loading venture…" />
    )
  }

  if (!venture.data) {
    return (
      <EmptyState
        icon={SearchX}
        title="No such venture"
        action={
          <Button variant="secondary" to="/browse">
            Back to browse
          </Button>
        }
      >
        It may have been removed, or the link is wrong.
      </EmptyState>
    )
  }

  const v = venture.data

  // Per-item enquiry counts are the seller's own evidence of what sells, so
  // they belong to the owner and the moderator, not to every passing browser.
  const showItemStats = Boolean(profile && (profile.uid === v.ownerId || profile.isModerator))

  // listMenuItems returns items already sorted category-then-name, with
  // uncategorised items last — grouping here just has to walk that order
  // once, not re-sort it. The uncategorised group (key '') renders with no
  // heading and is never collapsible.
  const menuGroups: { category: string; items: MenuItem[] }[] = []
  for (const item of menu.data ?? []) {
    const category = item.category ?? ''
    const last = menuGroups[menuGroups.length - 1]
    if (last && last.category === category) last.items.push(item)
    else menuGroups.push({ category, items: [item] })
  }

  const cartLines = (menu.data ?? [])
    .filter((item) => cart[item.id] > 0)
    .map((item) => ({ item, quantity: cart[item.id] }))
  const cartTotal = cartLines.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0)
  const buyer: Buyer = { name: buyerName.trim(), phone: buyerPhone.trim() }

  /**
   * The WhatsApp message, built from whichever lines are current — the live
   * cart before the order is placed, the frozen copy afterwards. It has to be
   * the frozen copy on the confirmation screen, because placing the order
   * empties the cart and the link would otherwise be null exactly when it is
   * the only thing on screen.
   */
  const messageLines = placed?.lines ?? cartLines.map(({ item, quantity }) => ({
    itemId: item.id,
    name: item.name,
    price: item.price,
    quantity,
  }))
  const waLink =
    messageLines.length > 0
      ? cartLink(
          v.phone,
          v.name,
          messageLines.map(({ name, price, quantity }) => ({ name, price, quantity })),
          buyer,
        )
      : null

  // A slot is only required of the buyer if the seller published any. A seller
  // who has not is agreeing to sort the time out in conversation.
  const slotRequired = v.deliverySlots.length > 0
  const canPlace =
    cartLines.length > 0 &&
    buyer.name !== '' &&
    buyer.phone.replace(/\D/g, '').length >= 8 &&
    deliveryAddress.trim() !== '' &&
    (!slotRequired || deliverySlot !== '')

  const closeCheckout = () => {
    setCheckoutOpen(false)
    setPlaceError(null)
    // Cleared on close rather than on place, so the confirmation screen still
    // has something to show while it is open.
    setPlaced(null)
  }

  /**
   * Writes the order, then hands the dialog over to the confirmation screen.
   *
   * The cart is emptied and the inquiry counters bumped only after the write
   * succeeds. Doing either first would, on a refused write, leave the buyer
   * looking at an empty cart and an error with no way back to what they had
   * chosen.
   */
  const placeOrder = async () => {
    if (!profile || !canPlace) return
    setPlacing(true)
    setPlaceError(null)

    const lines: OrderLine[] = cartLines.map(({ item, quantity }) => ({
      itemId: item.id,
      name: item.name,
      price: item.price,
      quantity,
    }))

    let orderId: string
    try {
      orderId = await createOrder({
        venture: { id: v.id, name: v.name, ownerId: v.ownerId },
        buyerUid: profile.uid,
        buyerName: buyer.name,
        buyerPhone: buyer.phone.replace(/\D/g, ''),
        lines,
        contactPreference,
        payment,
        deliveryAddress: deliveryAddress.trim(),
        deliverySlot,
      })
    } catch (cause) {
      setPlaceError(cause instanceof Error ? cause.message : 'Could not place that order.')
      setPlacing(false)
      return
    }

    setPlaced({ lines, total: orderTotal(lines) })
    // Not awaited. The confirmation screen must not wait on a push that is
    // optional, may be unconfigured, and cannot fail in a way the buyer could
    // do anything about.
    void notifyOrderPlaced(orderId)
    void confirmInquiries(cartLines.map(({ item }) => item))
    setCart({})
    setPlacing(false)
  }

  return (
    <div className="space-y-4">
      <Link
        to="/browse"
        className="inline-flex items-center gap-2 rounded-full px-1 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase transition-colors hover:text-white"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        All ventures
      </Link>

      {/* Said before the menu, not after it. Someone who reads this only once
          they have tapped an item has already tried to message a business that
          does not exist. */}
      {v.isDemo && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 text-[13.5px] leading-relaxed text-amber-300">
          <span className="font-bold">This is a demo listing.</span> It is placeholder content
          showing what a complete entry looks like — the business is not real and the WhatsApp
          number will not reach anyone.
        </p>
      )}

      {/* Side by side from lg. Stacked, the photo pushed the menu below the
          fold on the one page whose purpose is tapping a menu item; this seats
          the details in the width the layout change reclaimed. */}
      <div
        className={
          v.photos.length > 0
            ? 'grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start'
            : ''
        }
      >
        <PhotoGallery venture={v} />

        <section className="liquid-glass-panel rounded-3xl p-5">
        {/* The name, which this page did not show anywhere before — the only
            h1 is the shell's visually-hidden one, so a visitor arriving from a
            shared link had to infer whose menu they were reading. The logo sits
            with it, which is the one place a venture's own mark belongs. */}
        <div className="mb-3.5 flex items-center gap-3">
          <VentureLogo name={v.name} logo={v.logo} size={44} />
          {/* A heading, not a paragraph: the shell's only h1 is the static
              "Venture", so navigating this page by headings would otherwise
              never reach the name of the venture it is about. */}
          <h2 className="min-w-0 flex-1 text-[21px] leading-tight font-extrabold text-white">
            {v.name}
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5 text-white/40">
            <Clock size={12} aria-hidden="true" />
            <span className="font-mono text-[10px] tracking-wider uppercase">{v.hours}</span>
          </span>
        </div>

        <p className="mt-3 text-[14.5px] leading-relaxed text-white/70">{v.description}</p>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          Run by {v.ownerUsername}
        </p>
        </section>
      </div>

      <section className="space-y-3">
        <header className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Menu
          </h2>
          <span className="font-mono text-[10px] font-bold text-white/30">
            Tap an item to add it to your order
          </span>
        </header>

        {menu.data?.length === 0 && (
          <p className="liquid-glass-panel rounded-2xl px-5 py-6 text-center text-[14px] text-white/45">
            This venture has not listed any items yet.
          </p>
        )}

        {/* Only when there is more than one named section — a single section
            has nowhere else to jump to. Horizontally scrollable rather than
            wrapped, so six categories stay one reachable row instead of
            pushing the grid down before a visitor has seen any items. */}
        {menuGroups.filter((group) => group.category !== '').length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {menuGroups
              .filter((group) => group.category !== '')
              .map((group) => (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => jumpToCategory(group.category)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[13px] font-bold whitespace-nowrap text-white/80 transition duration-150 hover:border-brand-400/40 hover:bg-brand-500/15 hover:text-brand-300 active:scale-[0.96]"
                >
                  {group.category}
                </button>
              ))}
          </div>
        )}

        <div className="space-y-6">
          {menuGroups.map((group) => {
            const collapsed = group.category !== '' && collapsedCategories[group.category]
            return (
              <div
                key={group.category || ' uncategorised'}
                ref={(el) => {
                  sectionRefs.current[group.category] = el
                }}
              >
                {group.category !== '' && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    aria-expanded={!collapsed}
                    className="mb-3 flex w-full items-center gap-2 px-1 text-left"
                  >
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-brand-400 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="text-[17px] font-extrabold text-white">{group.category}</span>
                    <span className="font-mono text-[11px] font-bold text-white/35">
                      {group.items.length}
                    </span>
                  </button>
                )}
                {!collapsed && (
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                    {group.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        quantity={cart[item.id] ?? 0}
                        askedCount={localCounts[item.id] ?? item.inquiryCount}
                        showAsked={showItemStats}
                        onSetQuantity={(quantity) => setQuantity(item, quantity)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      <ReviewSection ventureId={v.id} ownerId={v.ownerId} />

      {/* Also on bare backdrop, and smaller again — see the note in SignIn. */}
      <p className="px-1 pb-2 text-center font-mono text-[9px] tracking-[0.18em] text-white/50 uppercase">
        Payment is settled directly with the seller
      </p>

      {/* Fixed rather than sticky-in-flow: the review section below the menu
          would otherwise scroll the bar out of reach on a long page, right
          when someone has finally decided what they want. */}
      {cartLines.length > 0 && (
        // bottom-24 clears MobileNav, which is fixed at bottom-3 below md;
        // above md there is no bottom nav, so it sits flush with the edge.
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center p-3 sm:p-4 md:bottom-0">
          {/* OPAQUE, not .liquid-glass-panel. Glass takes its contrast from
              whatever is behind it, and what is behind this bar is a grid of
              product photos — a sticker shop's white-background PNGs turned it
              into unreadable grey-on-white. A checkout bar is the one element
              on the page that must be legible over every possible backdrop, so
              it brings its own. The blur stays for the edges. */}
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-[#0a0d12]/95 px-5 py-3.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-xl transition duration-150 hover:border-white/25 active:scale-[0.98]"
          >
            <ShoppingCart size={18} className="shrink-0 text-brand-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[13px] font-bold text-white">
                {cartLines.length} {cartLines.length === 1 ? 'item' : 'items'}
              </span>
              <span className="block text-[11px] text-white/50">Tap to review and order</span>
            </span>
            <span className="shrink-0 font-mono text-[15px] font-extrabold text-brand-400">
              ₹{cartTotal}
            </span>
          </button>
        </div>
      )}

      <Modal
        open={checkoutOpen}
        onClose={closeCheckout}
        title={placed ? 'Order placed' : `Order from ${v.name}`}
        footer={
          placed ? (
            <>
              <Button variant="ghost" onClick={closeCheckout}>
                Done
              </Button>
              {/* Only for the buyer who said they would make contact. The one
                  who asked to be contacted has already done their part, and
                  putting a WhatsApp button in front of them anyway would make
                  the choice they just made look like it did nothing. */}
              {contactPreference === 'buyerContacts' && waLink && (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp bg-whatsapp px-5 py-2.5 text-[12px] font-bold tracking-wider text-black uppercase transition duration-150 hover:bg-whatsapp/85 active:scale-[0.97]"
                >
                  <MessageCircle size={13} aria-hidden="true" />
                  Message the seller
                </a>
              )}
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={closeCheckout}>
                Cancel
              </Button>
              {profile ? (
                <Button
                  variant="primary"
                  loading={placing}
                  disabled={!canPlace}
                  onClick={() => void placeOrder()}
                >
                  Place order · ₹{cartTotal}
                </Button>
              ) : (
                <Button variant="primary" to="/signin">
                  Sign in to order
                </Button>
              )}
            </>
          )
        }
      >
        {placed ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2
                size={20}
                className="mt-0.5 shrink-0 text-brand-400"
                aria-hidden="true"
              />
              <p className="text-[14px] leading-relaxed text-white/75">
                {v.name} has your order for{' '}
                <span className="font-mono font-bold text-white">₹{placed.total}</span>. It is on
                their dashboard now.
              </p>
            </div>

            {contactPreference === 'sellerContacts' ? (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-white/60">
                They will call or message you on{' '}
                <span className="font-mono text-white/85">{buyer.phone}</span>. Sellers here are
                students with classes, so give it a few hours — and you can always reach them
                yourself on <span className="font-mono text-white/85">{v.phone}</span>.
              </p>
            ) : (
              <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-white/60">
                Send them the message below to confirm it. Your order is saved either way, but a
                seller who has heard from you starts on it sooner.
              </p>
            )}

            {payment === 'cod' && (
              <p className="text-[12.5px] leading-relaxed text-white/45">
                Cash on delivery: expect a quick call to check the order is genuine before they
                make it.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2.5">
              {cartLines.map(({ item, quantity }) => (
                <div key={item.id} className="flex items-center gap-3">
                  <span className="min-w-0 flex-1 truncate text-[14px] text-white">{item.name}</span>
                  <span className="shrink-0 font-mono text-[13px] text-white/50">
                    ₹{item.price * quantity}
                  </span>
                  <span className="flex shrink-0 items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => setQuantity(item, quantity - 1)}
                      aria-label={`Remove one ${item.name}`}
                      className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94]"
                    >
                      <Minus size={12} aria-hidden="true" />
                    </button>
                    <span className="w-4 text-center font-mono text-[12px] text-white">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity(item, quantity + 1)}
                      disabled={remaining(item, quantity) === 0}
                      aria-label={`Add one more ${item.name}`}
                      className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94] disabled:opacity-30"
                    >
                      <Plus size={12} aria-hidden="true" />
                    </button>
                  </span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between border-t border-white/8 pt-3">
              <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase">
                Total
              </span>
              <span className="font-mono text-[16px] font-extrabold text-brand-400">
                ₹{cartTotal}
              </span>
            </div>

            {/* Signed-out buyers still get the whole form to read, with a
                sign-in button in the footer instead of a place-order one.
                Hiding it until they sign in asks for an account before saying
                what the account is for. */}
            {authStatus === 'signedOut' && (
              <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-300">
                Ordering needs an account, so the seller knows who they are making this for.
                Browsing never will.
              </p>
            )}

            <div className="space-y-3.5 border-t border-white/8 pt-3.5">
              <TextField
                id="checkout-name"
                label="Your name"
                required
                maxLength={60}
                value={buyerName}
                onChange={(event) => setBuyerName(event.target.value)}
                placeholder="Aarav"
              />
              <TextField
                id="checkout-phone"
                label="Your number"
                hint="With country code, so the seller can reach you."
                required
                inputMode="tel"
                value={buyerPhone}
                onChange={(event) => setBuyerPhone(event.target.value)}
                placeholder="919876543210"
              />
              <TextField
                id="checkout-address"
                label="Where to bring it"
                hint="A hostel room, a block and floor, a classroom — whatever you would tell a friend."
                required
                maxLength={200}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Hostel J, room 214"
              />

              {slotRequired && (
                <Field id="checkout-slot" label="When" hint="The windows this seller offers.">
                  <select
                    id="checkout-slot"
                    required
                    value={deliverySlot}
                    onChange={(event) => setDeliverySlot(event.target.value)}
                    className={inputClass}
                  >
                    <option value="">Pick a time…</option>
                    {v.deliverySlots.map((slot) => (
                      <option key={slot} value={slot}>
                        {slot}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
            </div>

            <div className="space-y-3.5 border-t border-white/8 pt-3.5">
              <ChoiceGroup
                label="Paying by"
                value={payment}
                onChange={setPayment}
                choices={[
                  {
                    value: 'cod',
                    label: 'Cash on delivery',
                    detail:
                      'The seller may call first to check the order is genuine before making it.',
                  },
                  {
                    value: 'online',
                    label: 'Online',
                    detail:
                      'UPI, or whatever you both use. Nothing is paid through this site — you settle it between yourselves.',
                  },
                ]}
              />

              <ChoiceGroup
                label="Who gets in touch"
                value={contactPreference}
                onChange={setContactPreference}
                choices={[
                  {
                    value: 'buyerContacts',
                    label: 'I will message the seller',
                    detail: 'Opens WhatsApp with the order written out, once you have placed it.',
                  },
                  {
                    value: 'sellerContacts',
                    label: 'The seller contacts me',
                    detail:
                      'They see it on their dashboard and call you. Worth messaging them anyway if it is urgent.',
                  },
                ]}
              />
            </div>

            <p className="flex items-start gap-2 border-t border-white/8 pt-3.5 text-[12.5px] leading-relaxed text-white/45">
              <Phone size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden="true" />
              <span>
                Seller&rsquo;s number: <span className="font-mono text-white/70">{v.phone}</span>.
                No payment happens on this site.
              </span>
            </p>

            {placeError && (
              <p role="alert" className="text-[13px] text-red-400">
                {placeError}
              </p>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

