import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MessageCircle, Minus, Plus, SearchX, ShoppingCart, UtensilsCrossed } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ListRow from '../components/ui/ListRow'
import Modal from '../components/ui/Modal'
import TextField from '../components/ui/TextField'
import ReviewSection from '../components/ReviewSection'
import LoadingLine from '../components/ui/LoadingLine'
import VentureLogo from '../components/ui/VentureLogo'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems, recordInquiry, recordVentureView } from '../data/ventures'
import type { MenuItem, Venture } from '../data/ventures'
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

export default function VentureDetail() {
  const { ventureId = '' } = useParams()
  const { profile } = useAuth()
  /** itemId -> quantity. Page-local: a cart is for one checkout, not a thing
   *  to resume days later, and this app keeps no account state to hang it on
   *  even if it were. */
  const [cart, setCart] = useState<Record<string, number>>({})
  const [checkoutOpen, setCheckoutOpen] = useState(false)
  const [buyerName, setBuyerName] = useState('')
  const [buyerPhone, setBuyerPhone] = useState('')
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])
  const menu = useAsyncData(() => listMenuItems(ventureId), [ventureId])

  // One venture-level open per visit. Deliberately not in the same effect as
  // the data load, which re-runs whenever the id changes for other reasons.
  useEffect(() => {
    if (!ventureId) return
    void recordVentureView(ventureId)
  }, [ventureId])

  const addToCart = useCallback((item: MenuItem) => {
    setCart((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? 0) + 1 }))
  }, [])

  const setQuantity = useCallback((itemId: string, quantity: number) => {
    setCart((prev) => {
      if (quantity <= 0) {
        const rest = { ...prev }
        delete rest[itemId]
        return rest
      }
      return { ...prev, [itemId]: quantity }
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

  const cartLines = (menu.data ?? [])
    .filter((item) => cart[item.id] > 0)
    .map((item) => ({ item, quantity: cart[item.id] }))
  const cartTotal = cartLines.reduce((sum, { item, quantity }) => sum + item.price * quantity, 0)
  const buyer: Buyer = { name: buyerName.trim(), phone: buyerPhone.trim() }
  const waLink =
    cartLines.length > 0
      ? cartLink(
          v.phone,
          v.name,
          cartLines.map(({ item, quantity }) => ({ name: item.name, price: item.price, quantity })),
          buyer,
        )
      : null

  const canCheckout = waLink !== null && buyer.name !== ''

  // The anchor's own href + target="_blank" does the actual navigation; this
  // only runs the side effects that go with it, so the tab doesn't open twice.
  const afterCheckout = () => {
    void confirmInquiries(cartLines.map(({ item }) => item))
    setCart({})
    setCheckoutOpen(false)
    setBuyerName('')
    setBuyerPhone('')
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

        <div className="space-y-2.5">
          {menu.data?.map((item, index) => {
            const quantity = cart[item.id] ?? 0
            // listMenuItems returns items grouped by category already; a
            // heading goes above the first item of each group only, and
            // never above uncategorised items, which sort last with no
            // heading of their own.
            const previousCategory = index > 0 ? menu.data![index - 1].category : undefined
            const showHeading = Boolean(item.category) && item.category !== previousCategory

            return (
              <div key={item.id}>
                {showHeading && (
                  <h3 className="mb-2.5 px-1 font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
                    {item.category}
                  </h3>
                )}
                <ListRow
                  title={item.name}
                  description={item.description}
                  meta={
                    <span className="flex flex-col items-end gap-0.5">
                      <span>₹{item.price}</span>
                      {showItemStats && (
                        <span className="text-[10px] font-bold text-brand-400">
                          {(localCounts[item.id] ?? item.inquiryCount).toLocaleString('en-IN')} asked
                        </span>
                      )}
                      {quantity > 0 && (
                        <span className="text-[10px] font-bold text-brand-400">
                          {quantity} in order
                        </span>
                      )}
                    </span>
                  }
                  thumbnail={item.photo ? displayUrl(item.photo, 400) : undefined}
                  icon={item.photo ? undefined : UtensilsCrossed}
                  actionIcon={Plus}
                  actionLabel={`Add ${item.name} to your order`}
                  onClick={() => addToCart(item)}
                />
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
          <button
            type="button"
            onClick={() => setCheckoutOpen(true)}
            className="liquid-glass-panel flex w-full max-w-md items-center gap-3 rounded-2xl px-5 py-3.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.6)] transition duration-150 active:scale-[0.98]"
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
        onClose={() => setCheckoutOpen(false)}
        title={`Order from ${v.name}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setCheckoutOpen(false)}>
              Cancel
            </Button>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => {
                  if (!canCheckout) {
                    event.preventDefault()
                    return
                  }
                  afterCheckout()
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp bg-whatsapp px-5 py-2.5 text-[12px] font-bold tracking-wider text-black uppercase transition duration-150 hover:bg-whatsapp/85 active:scale-[0.97]"
              >
                <MessageCircle size={13} aria-hidden="true" />
                Continue on WhatsApp
              </a>
            ) : (
              <Button variant="secondary" disabled>
                {v.phone ? 'Add your details' : 'No number on file'}
              </Button>
            )}
          </>
        }
      >
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
                    onClick={() => setQuantity(item.id, quantity - 1)}
                    aria-label={`Remove one ${item.name}`}
                    className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94]"
                  >
                    <Minus size={12} aria-hidden="true" />
                  </button>
                  <span className="w-4 text-center font-mono text-[12px] text-white">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(item.id, quantity + 1)}
                    aria-label={`Add one more ${item.name}`}
                    className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94]"
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
            <span className="font-mono text-[16px] font-extrabold text-brand-400">₹{cartTotal}</span>
          </div>

          <div className="space-y-3 border-t border-white/8 pt-3.5">
            <p className="text-[12.5px] leading-relaxed text-white/50">
              This opens WhatsApp with your order written out, sent from your own number — the seller
              can reply there or call you on it directly.
            </p>
            <TextField
              id="checkout-name"
              label="Your name"
              required
              value={buyerName}
              onChange={(event) => setBuyerName(event.target.value)}
              placeholder="Aarav"
            />
            <TextField
              id="checkout-phone"
              label="Your number"
              hint="With country code, so the seller can call you back."
              required
              inputMode="tel"
              value={buyerPhone}
              onChange={(event) => setBuyerPhone(event.target.value)}
              placeholder="919876543210"
            />
          </div>
        </div>
      </Modal>
    </div>
  )
}
