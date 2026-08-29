import { Link } from 'react-router-dom'
import { Minus, Plus } from 'lucide-react'
import BrandIcon from './BrandIcon'
import VentureLogo from './VentureLogo'
import { displayUrl } from '../../lib/cloudinary'
import { setCartQuantity } from '../../data/cart'
import { venturePath } from '../../data/ventures'
import type { ItemMatch } from '../../data/ventures'

/**
 * One product, with the shop it belongs to attached.
 *
 * SHARED BY TWO PAGES on purpose. The search results on Browse and the whole
 * of the products grid are the same thing shown for different reasons, and
 * they were about to be two copies of the same forty lines of markup — which
 * is how the stepper ends up on one of them and not the other.
 *
 * The card is a link to the seller's page. The stepper on it is not: adding to
 * a cart from here saves a visitor the trip through a menu of forty items to
 * find the one already on screen, and the cart has grouped by seller since it
 * was built, so a basket assembled across three shops is three orders and
 * always was.
 */
export default function ProductCard({
  match: { item, venture },
  quantity,
  /** Appended to the venture link, so a search result can land with the menu
   *  already filtered to what was typed. */
  itemQuery,
}: {
  match: ItemMatch
  /** How many of this item are already in the cart. */
  quantity: number
  itemQuery?: string
}) {
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const priced = typeof item.price === 'number'
  const left = item.stock === undefined ? Infinity : item.stock - quantity
  const to = itemQuery
    ? `${venturePath(venture)}?item=${encodeURIComponent(itemQuery)}`
    : venturePath(venture)

  return (
    <div className="liquid-glass-panel flex items-center gap-3 rounded-2xl p-3 transition duration-150 hover:bg-white/[0.06]">
      <Link to={to} className="flex min-w-0 flex-1 items-center gap-3">
        {item.photo ? (
          <img
            src={displayUrl(item.photo, 400)}
            alt=""
            loading="lazy"
            className={`h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset ${
              sellable ? '' : 'grayscale'
            }`}
          />
        ) : (
          // The brand's own logo when the item is one, the seller's mark
          // otherwise — the same fallback ladder the venture page uses, so an
          // item looks like itself wherever it is shown.
          <BrandIcon
            name={item.name}
            size={64}
            fallback={<VentureLogo name={venture.name} logo={venture.logo} size={64} />}
          />
        )}

        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16.5px] font-bold text-white">{item.name}</span>
          <span className="block truncate font-mono text-[13px] tracking-wider text-white/35 uppercase">
            {venture.name}
          </span>
          <span className="mt-1 flex items-baseline gap-2">
            <span className="font-mono text-[15.5px] font-bold text-brand-400">
              {priced ? `₹${item.price}` : 'Ask'}
            </span>
            {!sellable && (
              <span className="font-mono text-[12.5px] font-bold tracking-wider text-red-300 uppercase">
                Sold out
              </span>
            )}
          </span>
        </span>
      </Link>

      {/* No price means no cart — see setCartQuantity. The card still opens the
          shop, which is where that conversation happens. */}
      {priced && sellable && (
        <span className="shrink-0">
          {quantity === 0 ? (
            <button
              type="button"
              onClick={() => setCartQuantity(item, venture, 1)}
              className="rounded-xl bg-white/10 px-3.5 py-2 text-[14px] font-bold tracking-wide text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.96]"
            >
              Add
              <span className="sr-only"> {item.name} to your order</span>
            </button>
          ) : (
            <span className="flex items-center gap-1 rounded-xl bg-brand-500/15 p-1">
              <button
                type="button"
                onClick={() => setCartQuantity(item, venture, quantity - 1)}
                aria-label={`Remove one ${item.name}`}
                className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9]"
              >
                <Minus size={13} aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="min-w-6 text-center font-mono text-[15.5px] font-extrabold text-brand-300"
              >
                <span className="sr-only">{item.name}, </span>
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setCartQuantity(item, venture, quantity + 1)}
                disabled={left <= 0}
                aria-label={`Add one more ${item.name}`}
                className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9] disabled:opacity-30"
              >
                <Plus size={13} aria-hidden="true" />
              </button>
            </span>
          )}
        </span>
      )}
    </div>
  )
}
