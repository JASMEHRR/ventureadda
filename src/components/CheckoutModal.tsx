import { useEffect, useRef, useState } from 'react'
import { CheckCircle2, MessageCircle, Minus, Phone, Plus } from 'lucide-react'
import Button from './ui/Button'
import ChoiceGroup from './ui/ChoiceGroup'
import Select from './ui/Select'
import type { SelectOption } from './ui/Select'
import Modal from './ui/Modal'
import TextField from './ui/TextField'
import { useAuth } from '../auth/AuthProvider'
import { createOrder } from '../data/orders'
import { orderTotal } from '../data/orderLines'
import type { ContactPreference, OrderLine, PaymentMethod } from '../data/orders'
import type { CartEntry } from '../data/cart'
import { cartTotal } from '../data/cart'
import type { Venture } from '../data/ventures'
import { getSiteSettings } from '../data/settings'
import { notifyOrderPlaced } from '../lib/notifyOrder'
import { cartLink } from '../lib/whatsapp'
import type { Buyer } from '../lib/whatsapp'

/**
 * Checkout for one venture's worth of cart.
 *
 * Lifted wholesale out of VentureDetail, which is where it used to live when
 * the cart was a page-local `useState`. Now that the cart is global and spans
 * ventures, checkout happens on the cart page — once per venture, because an
 * order has one ownerId, one delivery slot and one seller to message, and
 * pretending otherwise would mean inventing a basket concept the Firestore
 * rules have no idea about.
 *
 * The buyer's own details are remembered between checkouts (see BUYER_KEY):
 * ordering from three sellers should not mean typing your hostel room three
 * times.
 */

const BUYER_KEY = 'ventureadda:buyer'

/**
 * Who the buyer is, which is what the seller needs before they set off.
 *
 * Three answers because three is what this campus has, and each one changes
 * the journey: a hosteller is a block and a room, a day scholar is usually the
 * gate at a particular hour, and faculty is an office. Stored as the label
 * rather than the key — it is read by a person on a dashboard, not by code.
 */
type BuyerType = 'hosteller' | 'dayScholar' | 'faculty'

const BUYER_TYPE_LABELS: Record<BuyerType, string> = {
  hosteller: 'Hosteller',
  dayScholar: 'Day scholar',
  faculty: 'Faculty',
}

const BUYER_TYPES: SelectOption<BuyerType>[] = (
  Object.keys(BUYER_TYPE_LABELS) as BuyerType[]
).map((value) => ({ value, label: BUYER_TYPE_LABELS[value] }))

type RememberedBuyer = { name: string; phone: string; address: string }

function readBuyer(): RememberedBuyer {
  try {
    const raw = window.localStorage.getItem(BUYER_KEY)
    if (!raw) return { name: '', phone: '', address: '' }
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return { name: '', phone: '', address: '' }
    const value = parsed as Record<string, unknown>
    return {
      name: typeof value.name === 'string' ? value.name : '',
      phone: typeof value.phone === 'string' ? value.phone : '',
      address: typeof value.address === 'string' ? value.address : '',
    }
  } catch {
    // Blocked storage or malformed JSON. An empty form is a fine fallback.
    return { name: '', phone: '', address: '' }
  }
}

function rememberBuyer(buyer: RememberedBuyer): void {
  try {
    window.localStorage.setItem(BUYER_KEY, JSON.stringify(buyer))
  } catch {
    // Not worth telling anyone about: the order still goes through, they will
    // just retype it next time.
  }
}

export default function CheckoutModal({
  open,
  onClose,
  venture,
  entries,
  onSetQuantity,
  onPlaced,
}: {
  open: boolean
  onClose: () => void
  venture: Venture
  entries: CartEntry[]
  onSetQuantity: (entry: CartEntry, quantity: number) => void
  /** Called once the order document exists, so the caller can clear the cart. */
  onPlaced: (orderId: string) => void
}) {
  const { profile, signInWithGoogle } = useAuth()
  const remembered = readBuyer()

  const [buyerName, setBuyerName] = useState(remembered.name || (profile?.username ?? ''))
  const [buyerPhone, setBuyerPhone] = useState(remembered.phone)
  const [deliveryAddress, setDeliveryAddress] = useState(remembered.address)
  const [contactPreference, setContactPreference] = useState<ContactPreference>('buyerContacts')

  /**
   * Whether the "seller contacts me" route is offered at all.
   *
   * Read here rather than passed in: this dialog is the only thing that asks
   * the question, and one settings read on a modal that is already waiting on
   * a cart is cheaper than threading a flag through every page that can open
   * it. Defaults to false, including when the read fails — an option the site
   * cannot honour must not appear because a network call went wrong.
   */
  const [sellerContact, setSellerContact] = useState(false)

  useEffect(() => {
    let cancelled = false
    getSiteSettings()
      .then((settings) => {
        if (!cancelled) setSellerContact(settings.sellerContact === true)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const [payment, setPayment] = useState<PaymentMethod>('cod')
  const [buyerType, setBuyerType] = useState<BuyerType>('hosteller')

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

  // A fresh dialog per venture. Without this, checking out of a second venture
  // straight after the first would open on the previous one's confirmation
  // screen, because `placed` is only cleared on close.
  useEffect(() => {
    if (open) {
      setPlaced(null)
      setPlaceError(null)
      setBuyerType('hosteller')
    }
  }, [open, venture.id])

  /**
   * The live profile, for the sign-in-then-place path above.
   *
   * `placeOrder` closes over the render's `profile`, so after signing in mid
   * call it would still see null forever. A ref updated on every render is the
   * smallest thing that lets an async function read what is true now rather
   * than what was true when it started.
   */
  const profileRef = useRef(profile)
  profileRef.current = profile

  const waitForProfile = async () => {
    // Ten seconds in tenths. Long enough for a first-time account, whose
    // profile is created by a write after the sign-in resolves; short enough
    // that a wedged state ends in a message rather than a spinner.
    for (let attempt = 0; attempt < 100; attempt += 1) {
      if (profileRef.current) return profileRef.current
      await new Promise((resolve) => window.setTimeout(resolve, 100))
    }
    return null
  }

  const total = cartTotal(entries)
  const buyer: Buyer = { name: buyerName.trim(), phone: buyerPhone.trim() }

  /**
   * The WhatsApp message, built from whichever lines are current — the live
   * cart before the order is placed, the frozen copy afterwards. It has to be
   * the frozen copy on the confirmation screen, because placing the order
   * empties the cart and the link would otherwise be null exactly when it is
   * the only thing on screen.
   */
  const messageLines =
    placed?.lines ??
    entries.map((entry) => ({
      itemId: entry.itemId,
      name: entry.name,
      price: entry.price,
      quantity: entry.quantity,
    }))
  const waLink =
    messageLines.length > 0
      ? cartLink(
          venture.phone,
          venture.name,
          messageLines.map(({ name, price, quantity }) => ({ name, price, quantity })),
          buyer,
        )
      : null

  const canPlace =
    entries.length > 0 &&
    buyer.name !== '' &&
    buyer.phone.replace(/\D/g, '').length >= 8 &&
    deliveryAddress.trim() !== ''

  const close = () => {
    setPlaceError(null)
    // Cleared on close rather than on place, so the confirmation screen still
    // has something to show while it is open.
    setPlaced(null)
    onClose()
  }

  /**
   * Writes the order, then hands the dialog over to the confirmation screen.
   *
   * The cart is emptied by the caller only after the write succeeds. Doing it
   * first would, on a refused write, leave the buyer looking at an empty cart
   * and an error with no way back to what they had chosen.
   */
  const placeOrder = async () => {
    if (!canPlace) return

    /**
     * SIGNING IN HAPPENS HERE, AT THE END, NOT AT THE DOOR.
     *
     * This used to read `if (!profile || !canPlace) return` — a silent bail.
     * A signed-out buyer filled in their name, their number, where to bring
     * it, picked their items, pressed Place order, and nothing happened at
     * all. No error, no prompt, no WhatsApp. Just a button that did nothing,
     * which is the worst failure a form can have because there is nothing to
     * act on.
     *
     * The order genuinely cannot be written anonymously — firestore.rules
     * files every order under a buyer uid, which is what lets somebody see
     * their own orders later and stops anyone reading a stranger's. So the
     * account is still needed; what changes is when it is asked for. Everything
     * is already filled in, so this is one Google tap at the moment the
     * purpose of it is obvious, rather than a wall in front of a form nobody
     * has decided to fill in yet.
     *
     * The form is not unmounted while this happens: the modal stays open, so
     * nothing typed is lost whether they complete the sign-in or cancel it.
     */
    let account = profile
    if (!account) {
      setPlacing(true)
      setPlaceError(null)
      try {
        await signInWithGoogle()
      } catch {
        setPlaceError('Could not sign you in. Try again, or use a different account.')
        setPlacing(false)
        return
      }
      // The profile arrives through onAuthStateChanged and its Firestore
      // subscription, neither of which has resolved by the time the popup
      // closes. Waiting on the ref rather than on `profile` because this
      // closure captured the old value and will never see the new one.
      account = await waitForProfile()
      if (!account) {
        setPlaceError('Signed in, but your profile is still loading. Press Place order again.')
        setPlacing(false)
        return
      }
    }

    setPlacing(true)
    setPlaceError(null)

    const lines: OrderLine[] = entries.map((entry) => ({
      itemId: entry.itemId,
      name: entry.name,
      price: entry.price,
      quantity: entry.quantity,
    }))

    let orderId: string
    try {
      orderId = await createOrder({
        venture: { id: venture.id, name: venture.name, ownerId: venture.ownerId },
        buyerUid: account.uid,
        buyerName: buyer.name,
        buyerPhone: buyer.phone.replace(/\D/g, ''),
        lines,
        contactPreference,
        payment,
        deliveryAddress: deliveryAddress.trim(),
        // Stored in the field that used to hold the seller's time window.
        // Same job — the line of context the seller reads before setting off —
        // and reusing it keeps every order ever placed readable by one
        // dashboard rather than needing two code paths forever.
        deliverySlot: BUYER_TYPE_LABELS[buyerType],
      })
    } catch (cause) {
      setPlaceError(cause instanceof Error ? cause.message : 'Could not place that order.')
      setPlacing(false)
      return
    }

    rememberBuyer({ name: buyer.name, phone: buyer.phone, address: deliveryAddress.trim() })
    setPlaced({ lines, total: orderTotal(lines) })

    /**
     * Opens WhatsApp with the order in it, without waiting to be asked.
     *
     * This is the step the whole site is for: nothing is paid here, so an
     * order that never reaches the seller's phone is not an order. Leaving it
     * behind a button on a confirmation screen meant the people who closed
     * that screen — most of them, because it says "Order placed" and looks
     * finished — had silently done nothing at all.
     *
     * Popup blockers are the reason the button stays as well. This call is
     * two awaits removed from the click that started it, and Safari in
     * particular will refuse a window opened that late. When it is refused
     * the confirmation screen still has Message seller on it, which is where
     * this started.
     */
    if (waLink && contactPreference === 'buyerContacts') {
      window.open(waLink, '_blank', 'noopener')
    }
    // Not awaited. The confirmation screen must not wait on a push that is
    // optional, may be unconfigured, and cannot fail in a way the buyer could
    // do anything about.
    void notifyOrderPlaced(orderId)
    onPlaced(orderId)
    setPlacing(false)
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title={placed ? 'Order placed' : `Order from ${venture.name}`}
      footer={
        placed ? (
          <>
            <Button variant="ghost" to="/my-orders">
              Track it
            </Button>
            {/* Only for the buyer who said they would make contact. The one
                who asked to be contacted has already done their part, and
                putting a WhatsApp button in front of them anyway would make
                the choice they just made look like it did nothing. */}
            {contactPreference === 'buyerContacts' && waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp bg-whatsapp px-5 py-2.5 text-[15px] font-bold tracking-wider text-black uppercase transition duration-150 hover:bg-whatsapp/85 active:scale-[0.97]"
              >
                <MessageCircle size={13} aria-hidden="true" />
                Message seller
              </a>
            ) : (
              <Button variant="primary" onClick={close}>
                Done
              </Button>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>
              Cancel
            </Button>
            {/* ONE BUTTON, SIGNED IN OR NOT. This used to swap to "Sign in
                to order", which threw away everything typed and sent the
                buyer to another page — and it made the sign-in-then-place
                path below unreachable, since the button that triggers it was
                only rendered for people who were already signed in. Placing
                asks for an account at the point of placing. */}
            <Button
              variant="primary"
              loading={placing}
              disabled={!canPlace}
              onClick={() => void placeOrder()}
            >
              Place order · ₹{total}
            </Button>
          </>
        )
      }
    >
      {placed ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
            <p className="text-[16px] leading-relaxed text-white/75">
              {venture.name} has your order for{' '}
              <span className="font-mono font-bold text-white">₹{placed.total}</span>. It is on
              their dashboard now, and you can follow it under Your orders.
            </p>
          </div>

          {contactPreference === 'sellerContacts' ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[15.5px] leading-relaxed text-white/60">
              They will call or message you on{' '}
              <span className="font-mono text-white/85">{buyer.phone}</span>. Sellers here are
              students with classes, so give it a few hours. Their number is{' '}
              <span className="font-mono text-white/85">{venture.phone}</span> if you would rather
              not wait.
            </p>
          ) : (
            <p className="rounded-2xl border border-whatsapp/25 bg-whatsapp/10 px-4 py-3 text-[15.5px] leading-relaxed text-white/70">
              WhatsApp should be opening now with your order in a chat to{' '}
              <span className="font-bold text-white/90">{venture.name}</span> —{' '}
              <span className="font-bold text-white/90">press send there</span> to let them know.
              If it did not open, use the button below. The order is saved either way, but a seller
              who has heard from you starts sooner.
            </p>
          )}

          {payment === 'cod' && (
            <p className="text-[15px] leading-relaxed text-white/60">
              Paying cash: expect a quick call to check the order is real before they make it.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <div key={entry.itemId} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[16px] text-white">{entry.name}</span>
                <span className="shrink-0 font-mono text-[15.5px] text-white/50">
                  ₹{entry.price * entry.quantity}
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => onSetQuantity(entry, entry.quantity - 1)}
                    aria-label={`Remove one ${entry.name}`}
                    className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94]"
                  >
                    <Minus size={12} aria-hidden="true" />
                  </button>
                  <span className="w-4 text-center font-mono text-[15px] text-white">
                    {entry.quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => onSetQuantity(entry, entry.quantity + 1)}
                    disabled={entry.stock !== undefined && entry.quantity >= entry.stock}
                    aria-label={`Add one more ${entry.name}`}
                    className="rounded-full border border-white/10 bg-white/5 p-1 text-white/60 transition duration-150 hover:bg-white/15 active:scale-[0.94] disabled:opacity-30"
                  >
                    <Plus size={12} aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between border-t border-white/8 pt-3">
            <span className="font-mono text-[13px] font-bold tracking-[0.18em] text-white/60 uppercase">
              Total
            </span>
            <span className="font-mono text-[18px] font-extrabold text-brand-400">₹{total}</span>
          </div>

          {/* THE "ORDERING NEEDS AN ACCOUNT" WARNING STOOD HERE. It belonged
              to the old flow, where the footer swapped to "Sign in to order"
              and the form was a dead end until you had one. Signing in now
              happens when you press Place order, with everything already
              typed — so warning people up front is asking them to worry about
              a step that no longer interrupts them. */}
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
              hint="A hostel room, a block and floor, a classroom."
              required
              maxLength={200}
              value={deliveryAddress}
              onChange={(event) => setDeliveryAddress(event.target.value)}
              placeholder="Hostel J, room 214"
            />

            {/* WAS "PICK A TIME", A RAW <select>. Two things were wrong with
                it. The browser draws that control itself — white popup, white
                text on some machines, unreadable — and it was the one control
                on this page not rendered by us. And the question was the wrong
                one: a delivery window is something the two of them settle in
                the conversation that starts thirty seconds later, while the
                thing the seller actually needs before they set off is who they
                are walking to. A hosteller, a day scholar waiting by the gate
                and a member of faculty are three different journeys. */}
            <Select
              label="Who are you"
              value={buyerType}
              options={BUYER_TYPES}
              onChange={setBuyerType}
            />
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
                  detail: 'The seller may call first to check the order is real.',
                },
                {
                  value: 'online',
                  label: 'Online',
                  detail: 'UPI, or whatever you both use. You settle it between yourselves.',
                },
              ]}
            />

            {/* Only when a moderator has turned it on — see `sellerContact`
                in data/settings.ts. Off, there is one way an order travels and
                no question to ask about it, so the whole group goes rather
                than sitting there with a single choice in it. */}
            {sellerContact && (
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
                    detail: 'They see it on their dashboard and call you.',
                  },
                ]}
              />
            )}
          </div>

          {/* SAID BEFORE THE BUTTON, not after it. Placing an order here
              opens WhatsApp and puts a message in the buyer's own chat with
              the seller — from their number, under their name. That is a
              surprise worth spending three lines to avoid: somebody who
              thought this site delivered the order for them, and who did not
              expect to appear in a stranger's chat under their real name, has
              a right to know before they press it rather than while WhatsApp
              is opening. It also explains the send button they are about to
              meet, which is the step people otherwise miss. */}
          {contactPreference === 'buyerContacts' && (
            <p className="flex items-start gap-2 rounded-2xl border border-whatsapp/25 bg-whatsapp/10 px-4 py-3 text-[15px] leading-relaxed text-white/70">
              <MessageCircle size={14} className="mt-0.5 shrink-0 text-whatsapp" aria-hidden="true" />
              <span>
                WhatsApp will open with your order written out, in a chat from you to{' '}
                <span className="font-bold text-white/90">{venture.name}</span>. You press send —
                nothing goes to them until you do.
              </span>
            </p>
          )}

          <p className="flex items-start gap-2 border-t border-white/8 pt-3.5 text-[15px] leading-relaxed text-white/60">
            <Phone size={13} className="mt-0.5 shrink-0 text-white/55" aria-hidden="true" />
            <span>
              Seller&rsquo;s number: <span className="font-mono text-white/70">{venture.phone}</span>
              . No money is paid through this site.
            </span>
          </p>

          {placeError && (
            <p role="alert" className="text-[15.5px] text-red-400">
              {placeError}
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}
