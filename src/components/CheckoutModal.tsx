import { useEffect, useState } from 'react'
import { CheckCircle2, MessageCircle, Minus, Phone, Plus } from 'lucide-react'
import Button from './ui/Button'
import ChoiceGroup from './ui/ChoiceGroup'
import Field from './ui/Field'
import Modal from './ui/Modal'
import TextField, { inputClass } from './ui/TextField'
import { useAuth } from '../auth/AuthProvider'
import { createOrder } from '../data/orders'
import { orderTotal } from '../data/orderLines'
import type { ContactPreference, OrderLine, PaymentMethod } from '../data/orders'
import type { CartEntry } from '../data/cart'
import { cartTotal } from '../data/cart'
import type { Venture } from '../data/ventures'
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
  const { profile, status: authStatus } = useAuth()
  const remembered = readBuyer()

  const [buyerName, setBuyerName] = useState(remembered.name || (profile?.username ?? ''))
  const [buyerPhone, setBuyerPhone] = useState(remembered.phone)
  const [deliveryAddress, setDeliveryAddress] = useState(remembered.address)
  const [contactPreference, setContactPreference] = useState<ContactPreference>('buyerContacts')
  const [payment, setPayment] = useState<PaymentMethod>('cod')
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

  // A fresh dialog per venture. Without this, checking out of a second venture
  // straight after the first would open on the previous one's confirmation
  // screen, because `placed` is only cleared on close.
  useEffect(() => {
    if (open) {
      setPlaced(null)
      setPlaceError(null)
      setDeliverySlot('')
    }
  }, [open, venture.id])

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

  // A slot is only required of the buyer if the seller published any. A seller
  // who has not is agreeing to sort the time out in conversation.
  const slotRequired = venture.deliverySlots.length > 0
  const canPlace =
    entries.length > 0 &&
    buyer.name !== '' &&
    buyer.phone.replace(/\D/g, '').length >= 8 &&
    deliveryAddress.trim() !== '' &&
    (!slotRequired || deliverySlot !== '')

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
    if (!profile || !canPlace) return
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

    rememberBuyer({ name: buyer.name, phone: buyer.phone, address: deliveryAddress.trim() })
    setPlaced({ lines, total: orderTotal(lines) })
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
                className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp bg-whatsapp px-5 py-2.5 text-[12px] font-bold tracking-wider text-black uppercase transition duration-150 hover:bg-whatsapp/85 active:scale-[0.97]"
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
            {profile ? (
              <Button
                variant="primary"
                loading={placing}
                disabled={!canPlace}
                onClick={() => void placeOrder()}
              >
                Place order · ₹{total}
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
            <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
            <p className="text-[14px] leading-relaxed text-white/75">
              {venture.name} has your order for{' '}
              <span className="font-mono font-bold text-white">₹{placed.total}</span>. It is on
              their dashboard now, and you can follow it under Your orders.
            </p>
          </div>

          {contactPreference === 'sellerContacts' ? (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-white/60">
              They will call or message you on{' '}
              <span className="font-mono text-white/85">{buyer.phone}</span>. Sellers here are
              students with classes, so give it a few hours. Their number is{' '}
              <span className="font-mono text-white/85">{venture.phone}</span> if you would rather
              not wait.
            </p>
          ) : (
            <p className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-[13px] leading-relaxed text-white/60">
              Send the message below to confirm it. The order is saved either way, but a seller who
              has heard from you starts sooner.
            </p>
          )}

          {payment === 'cod' && (
            <p className="text-[12.5px] leading-relaxed text-white/45">
              Paying cash: expect a quick call to check the order is real before they make it.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="space-y-2.5">
            {entries.map((entry) => (
              <div key={entry.itemId} className="flex items-center gap-3">
                <span className="min-w-0 flex-1 truncate text-[14px] text-white">{entry.name}</span>
                <span className="shrink-0 font-mono text-[13px] text-white/50">
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
                  <span className="w-4 text-center font-mono text-[12px] text-white">
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
            <span className="font-mono text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase">
              Total
            </span>
            <span className="font-mono text-[16px] font-extrabold text-brand-400">₹{total}</span>
          </div>

          {/* Signed-out buyers still get the whole form to read, with a
              sign-in button in the footer instead of a place-order one.
              Hiding it until they sign in asks for an account before saying
              what the account is for. */}
          {authStatus === 'signedOut' && (
            <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-[13px] leading-relaxed text-amber-300">
              Ordering needs an account, so the seller knows who they are making this for. Browsing
              never will.
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
              hint="A hostel room, a block and floor, a classroom."
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
                  {venture.deliverySlots.map((slot) => (
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
                  detail: 'The seller may call first to check the order is real.',
                },
                {
                  value: 'online',
                  label: 'Online',
                  detail: 'UPI, or whatever you both use. You settle it between yourselves.',
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
                  detail: 'They see it on their dashboard and call you.',
                },
              ]}
            />
          </div>

          <p className="flex items-start gap-2 border-t border-white/8 pt-3.5 text-[12.5px] leading-relaxed text-white/45">
            <Phone size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden="true" />
            <span>
              Seller&rsquo;s number: <span className="font-mono text-white/70">{venture.phone}</span>
              . No money is paid through this site.
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
  )
}
