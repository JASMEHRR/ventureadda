import { Link } from 'react-router-dom'
import { itemPath } from '../../data/ventures'
import { Minus, Plus } from 'lucide-react'
import BrandIcon from './BrandIcon'
import VentureLogo from './VentureLogo'
import { displayUrl } from '../../lib/cloudinary'
import { setCartQuantity } from '../../data/cart'
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
 *
 * IT USED TO BE HALF THIS SIZE, five to a row, and the row was the problem.
 * At that width every name was cut mid-word — "Adobe Creative Clo…", "After
 * Sex C…" — so the one thing a card exists to say was the thing it could not
 * say. It is wider now, the name gets two lines before it gives up, and the
 * grid stops at three columns. Fewer things on screen, each of them readable,
 * is more product than five columns of ellipses.
 */
export default function ProductCard({
  match: { item, venture },
  quantity,
  /** Appended to the venture link, so a search result can land with the menu
   *  already filtered to what was typed. */
}: {
  match: ItemMatch
  /** How many of this item are already in the cart. */
  quantity: number
}) {
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const priced = typeof item.price === 'number'
  // The seller's own setting, off unless they turned it on. See Venture.brandLogos.
  const brandIcon = venture.brandLogos
  const left = item.stock === undefined ? Infinity : item.stock - quantity

  return (
    <div
      className="liquid-glass-panel deferred-surface flex items-center gap-4 rounded-2xl p-4 transition duration-150 hover:bg-white/[0.06]"
      style={{ '--surface-height': '112px' } as React.CSSProperties}
    >
      {/* TO THE ITEM'S OWN PAGE, not to the shop it came from. Somebody
          looking through eight hundred products is asking what something is,
          not whose it is. See pages/ItemPage for why this is a page rather
          than something that expands here. */}
      <Link to={itemPath(venture, item.id)} className="flex min-w-0 flex-1 items-center gap-4">
        {item.photo ? (
          <img
            src={displayUrl(item.photo, 400)}
            alt=""
            loading="lazy"
            className={`h-20 w-20 shrink-0 rounded-2xl object-cover ring-1 ring-white/10 ring-inset ${
              sellable ? '' : 'grayscale'
            }`}
          />
        ) : brandIcon ? (
          // The brand's own logo when the item is one, the seller's mark
          // otherwise — the same fallback ladder the venture page uses, so an
          // item looks like itself wherever it is shown.
          <BrandIcon
            name={item.name}
            size={80}
            fallback={<VentureLogo name={venture.name} logo={venture.logo} size={80} />}
          />
        ) : (
          <VentureLogo name={venture.name} logo={venture.logo} size={80} />
        )}

        <span className="min-w-0 flex-1">
          {/* Two lines, then an ellipsis. One line cut every second name in
              half; unlimited lines makes a grid of cards of different heights. */}
          <span className="line-clamp-2 text-[17px] leading-snug font-bold text-white">
            {item.name}
          </span>
          <span className="mt-0.5 block truncate font-mono text-[13px] tracking-wider text-white/55 uppercase">
            {venture.name}
          </span>
          <span className="mt-1.5 flex items-baseline gap-2">
            <span className="font-mono text-[17px] font-bold text-brand-400">
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
              className="rounded-xl bg-white/10 px-5 py-2.5 text-[15px] font-bold tracking-wide text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.96]"
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
