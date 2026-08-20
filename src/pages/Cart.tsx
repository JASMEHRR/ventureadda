import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, ShoppingCart, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import VentureLogo from '../components/ui/VentureLogo'
import CheckoutModal from '../components/CheckoutModal'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems } from '../data/ventures'
import type { MenuItem, Venture } from '../data/ventures'
import {
  cartTotal,
  clearVentureCart,
  groupByVenture,
  reconcileCart,
  setCartQuantity,
  useCart,
} from '../data/cart'
import type { CartEntry } from '../data/cart'
import { displayUrl } from '../lib/cloudinary'

/**
 * The cart, one section per venture.
 *
 * ONE ORDER PER VENTURE, and that is not a simplification. An order document
 * carries a single ownerId, a single delivery slot and a single seller to
 * message; a basket spanning three sellers is three orders however it is
 * presented, and pretending otherwise would only hide from the buyer that
 * three different people now have to make three different things.
 *
 * WHAT THE FETCH IS FOR. The cart in localStorage holds copied names and
 * prices so the badge in the top bar costs no reads. Those copies can be a
 * week old. Before anyone can check out, this page reads the live venture and
 * its live menu, hands them to reconcileCart, and says out loud what changed —
 * checking out against a stale price is a dispute the seller never agreed to.
 */

type LiveData = {
  ventures: Map<string, Venture | null>
  items: Map<string, MenuItem>
}

function CartLine({ entry }: { entry: CartEntry }) {
  const atCeiling = entry.stock !== undefined && entry.quantity >= entry.stock
  const venture = { id: entry.ventureId, name: entry.ventureName }
  const item = {
    id: entry.itemId,
    name: entry.name,
    price: entry.price,
    stock: entry.stock,
    photo: entry.photo,
  }

  return (
    <li className="flex items-center gap-3 py-2.5">
      {entry.photo ? (
        <img
          src={displayUrl(entry.photo, 400)}
          alt=""
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
        />
      ) : (
        <span
          aria-hidden="true"
          className="h-14 w-14 shrink-0 rounded-xl bg-white/[0.04] ring-1 ring-white/10 ring-inset"
        />
      )}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[16px] font-bold text-white">{entry.name}</span>
        <span className="block font-mono text-[14.5px] text-white/40">
          ₹{entry.price} each
          {entry.stock !== undefined && entry.stock <= 5 ? ` · ${entry.stock} left` : ''}
        </span>
      </span>

      <span className="flex shrink-0 items-center gap-1 rounded-xl bg-white/[0.06] p-1">
        <button
          type="button"
          onClick={() => setCartQuantity(item, venture, entry.quantity - 1)}
          aria-label={
            entry.quantity === 1 ? `Remove ${entry.name}` : `Remove one ${entry.name}`
          }
          className="rounded-lg p-1.5 text-white/60 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.9]"
        >
          {entry.quantity === 1 ? (
            <Trash2 size={13} aria-hidden="true" />
          ) : (
            <Minus size={13} aria-hidden="true" />
          )}
        </button>
        <span
          aria-live="polite"
          aria-atomic="true"
          className="w-6 text-center font-mono text-[15.5px] font-extrabold text-white"
        >
          <span className="sr-only">{entry.name}, </span>
          {entry.quantity}
        </span>
        <button
          type="button"
          onClick={() => setCartQuantity(item, venture, entry.quantity + 1)}
          disabled={atCeiling}
          aria-label={atCeiling ? `No more ${entry.name} in stock` : `Add one more ${entry.name}`}
          className="rounded-lg p-1.5 text-white/60 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.9] disabled:opacity-30"
        >
          <Plus size={13} aria-hidden="true" />
        </button>
      </span>

      <span className="w-16 shrink-0 text-right font-mono text-[16px] font-bold text-white/85">
        ₹{entry.price * entry.quantity}
      </span>
    </li>
  )
}

export default function Cart() {
  const cart = useCart()
  const [checkoutVenture, setCheckoutVenture] = useState<Venture | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  // Sorted and joined rather than passed as an array: useAsyncData compares
  // deps by identity, and a fresh array every render would refetch forever.
  const ventureIds = useMemo(
    () => [...new Set(cart.map((entry) => entry.ventureId))].sort().join(','),
    [cart],
  )

  const live = useAsyncData<LiveData>(async () => {
    const ids = ventureIds === '' ? [] : ventureIds.split(',')
    const [ventures, menus] = await Promise.all([
      Promise.all(ids.map((id) => getVenture(id))),
      Promise.all(ids.map((id) => listMenuItems(id))),
    ])
    const items = new Map<string, MenuItem>()
    for (const menu of menus) for (const item of menu) items.set(item.id, item)
    return {
      ventures: new Map(ids.map((id, index) => [id, ventures[index]])),
      items,
    }
  }, [ventureIds])

  /**
   * Bring the stored copies in line with what the menus actually say.
   *
   * Runs off `live.data` rather than off the cart, so editing a quantity does
   * not re-run it and stamp a notice on every tap. A venture that has been
   * removed or unpublished takes its whole section with it: ordering from a
   * listing no moderator has approved is exactly what the Firestore create
   * rule refuses anyway, and finding that out at Place order would be worse.
   */
  useEffect(() => {
    if (!live.data) return
    const gone: string[] = []
    for (const [ventureId, venture] of live.data.ventures) {
      if (venture === null || venture.status !== 'live') {
        gone.push(venture?.name ?? 'A venture')
        clearVentureCart(ventureId)
      }
    }
    const { removed, repriced } = reconcileCart(live.data.items)

    const messages: string[] = []
    if (gone.length > 0) messages.push(`${gone.join(', ')} is no longer listed.`)
    if (removed.length > 0) messages.push(`Sold out, so removed: ${removed.join(', ')}.`)
    if (repriced.length > 0) messages.push(`Price changed since you added: ${repriced.join(', ')}.`)
    setNotice(messages.length > 0 ? messages.join(' ') : null)
  }, [live.data])

  const groups = groupByVenture(cart)
  const total = cartTotal(cart)

  if (cart.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <EmptyState
          icon={ShoppingCart}
          title="Your cart is empty"
          action={
            <Button variant="secondary" to="/browse">
              Browse ventures
            </Button>
          }
        >
          Add something from a menu and it waits here until you order it.
        </EmptyState>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="liquid-glass-panel rounded-3xl px-5 py-4">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Cart
          </h2>
          <span className="font-mono text-[17px] font-extrabold text-brand-400">₹{total}</span>
        </div>
        <p className="mt-2 text-[16px] leading-relaxed text-white/50">
          {groups.length === 1
            ? 'You order and pay each seller directly. Nothing is charged here.'
            : `${groups.length} sellers, so ${groups.length} separate orders. You settle each one with them directly.`}
        </p>
      </header>

      {live.error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] text-red-400">
          Could not check these against the live menus: {live.error.message}
        </p>
      )}

      {notice && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 text-[16px] leading-relaxed text-amber-300">
          {notice}
        </p>
      )}

      {groups.map((group) => {
        const venture = live.data?.ventures.get(group.ventureId) ?? null
        const subtotal = cartTotal(group.entries)

        return (
          <section key={group.ventureId} className="liquid-glass-panel rounded-3xl p-4 sm:p-5">
            <header className="flex items-center gap-3">
              <VentureLogo name={group.ventureName} logo={venture?.logo} size={36} />
              <Link
                to={`/venture/${group.ventureId}`}
                className="min-w-0 flex-1 truncate text-[18px] font-extrabold text-white transition-colors hover:text-brand-300"
              >
                {group.ventureName}
              </Link>
            </header>

            <ul className="mt-2 divide-y divide-white/8">
              {group.entries.map((entry) => (
                <CartLine key={entry.itemId} entry={entry} />
              ))}
            </ul>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/8 pt-3">
              <span className="font-mono text-[15.5px] text-white/45">
                Subtotal{' '}
                <span className="text-[17px] font-extrabold text-white/85">₹{subtotal}</span>
              </span>
              <span className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => clearVentureCart(group.ventureId)}
                  className="rounded-full border border-white/10 bg-white/5 px-3 py-2 font-mono text-[13px] font-bold tracking-wider text-white/40 uppercase transition duration-150 hover:bg-red-500/15 hover:text-red-300 active:scale-[0.96]"
                >
                  Clear
                </button>
                <Button
                  variant="primary"
                  disabled={venture === null}
                  onClick={() => setCheckoutVenture(venture)}
                >
                  {venture === null ? 'Checking menu…' : `Order · ₹${subtotal}`}
                </Button>
              </span>
            </div>
          </section>
        )
      })}

      {live.loading && !live.data && <LoadingLine label="Checking prices…" />}

      {checkoutVenture && (
        <CheckoutModal
          open
          onClose={() => setCheckoutVenture(null)}
          venture={checkoutVenture}
          entries={cart.filter((entry) => entry.ventureId === checkoutVenture.id)}
          onSetQuantity={(entry, quantity) =>
            setCartQuantity(
              {
                id: entry.itemId,
                name: entry.name,
                price: entry.price,
                stock: entry.stock,
                photo: entry.photo,
              },
              { id: entry.ventureId, name: entry.ventureName },
              quantity,
            )
          }
          // The dialog stays open on its confirmation screen; only the lines it
          // has already frozen a copy of leave the cart.
          onPlaced={() => clearVentureCart(checkoutVenture.id)}
        />
      )}
    </div>
  )
}
