import { Link } from 'react-router-dom'
import { ArrowRight, Plus } from 'lucide-react'
import BrandIcon from './ui/BrandIcon'
import VentureLogo from './ui/VentureLogo'
import { displayUrl } from '../lib/cloudinary'
import { cartQuantity, setCartQuantity, useCart } from '../data/cart'
import { venturePath } from '../data/ventures'
import type { ItemMatch } from '../data/ventures'

/**
 * A row of products that scrolls sideways.
 *
 * THE SHAPE EVERY DELIVERY APP USES, and for a reason that applies here: a
 * campus shop front has a dozen sections and no visitor scrolls a full grid of
 * each one. A rail shows the first four, says there are more by half-cutting
 * the fifth, and costs one screen of height per section instead of six.
 *
 * Native overflow scrolling with CSS snap points — no carousel library, no
 * arrows to maintain, and a thumb, a trackpad and Tab all move it already.
 * Desktop gets a hint that it is draggable from the same half-cut card a phone
 * uses.
 *
 * THE TILES WERE TOO SMALL, and small tiles are what made the page feel busy
 * rather than full: at 160px every name was cut mid-word, so each row was
 * seven ellipses and no information, and seven of those rows stacked read as
 * noise. Wider tiles, two lines for a name, and real space between the rows.
 * A shop front is meant to look like a few things you can see clearly.
 */
function Tile({ match, quantity }: { match: ItemMatch; quantity: number }) {
  const { item, venture } = match
  // The seller's own setting, off unless they turned it on. See Venture.brandLogos.
  const brandIcon = venture.brandLogos
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const priced = typeof item.price === 'number'

  // Narrower on a phone than on a desktop: at 208px a single tile was
  // two-thirds of a 375px screen, so the row read as one enormous card rather
  // than as a row you can push. 176px shows two and a half.
  return (
    <div className="liquid-glass-panel flex w-44 shrink-0 snap-start flex-col rounded-2xl p-3 sm:w-56">
      <Link to={venturePath(venture)} className="block">
        <span className="mb-3 flex aspect-square items-center justify-center overflow-hidden rounded-xl bg-white/[0.04]">
          {item.photo ? (
            <img
              src={displayUrl(item.photo, 400)}
              alt=""
              loading="lazy"
              className={`h-full w-full object-cover ${sellable ? '' : 'grayscale'}`}
            />
          ) : brandIcon ? (
            // The brand's own logo when the item is one, the seller's mark
            // otherwise — the same ladder the venture page and /products use.
            <BrandIcon
              name={item.name}
              size={88}
              fallback={<VentureLogo name={venture.name} logo={venture.logo} size={88} />}
            />
          ) : (
            <VentureLogo name={venture.name} logo={venture.logo} size={88} />
          )}
        </span>

        {/* Two lines, then an ellipsis, and a fixed height for them — a row of
            cards whose tops line up and whose prices do not is worse than a
            clipped name. */}
        <span className="line-clamp-2 min-h-[2.6em] text-[16.5px] leading-snug font-bold text-white">
          {item.name}
        </span>
        <span className="mt-0.5 block truncate font-mono text-[12.5px] tracking-wider text-white/35 uppercase">
          {venture.name}
        </span>
      </Link>

      <div className="mt-2.5 flex items-center justify-between gap-2">
        <span className="font-mono text-[16.5px] font-bold text-brand-400">
          {priced ? `₹${item.price}` : 'Ask'}
        </span>

        {/* Sold out and "ask the seller" both say so in place of the button
            rather than showing one that refuses — see setCartQuantity. */}
        {!sellable ? (
          <span className="font-mono text-[12px] font-bold tracking-wider text-red-300 uppercase">
            Sold out
          </span>
        ) : !priced ? (
          <span className="font-mono text-[12px] tracking-wider text-white/30 uppercase">Ask</span>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => setCartQuantity(item, venture, 1)}
            className="rounded-lg bg-white/10 px-4 py-2 font-mono text-[13px] font-extrabold tracking-wider text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.94]"
          >
            <Plus size={11} aria-hidden="true" className="mr-1 inline" />
            Add
            <span className="sr-only"> {item.name} to your order</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setCartQuantity(item, venture, quantity + 1)}
            aria-label={`Add one more ${item.name}`}
            className="rounded-lg bg-brand-500/20 px-4 py-2 font-mono text-[13px] font-extrabold tracking-wider text-brand-300 uppercase transition duration-150 hover:bg-brand-500/30 active:scale-[0.94]"
          >
            {quantity} in cart
          </button>
        )}
      </div>
    </div>
  )
}

export default function ProductRail({
  title,
  items,
  seeAllTo,
}: {
  title: string
  items: ItemMatch[]
  /** Where the row's own "see all" goes. Absent hides the link. */
  seeAllTo?: string
}) {
  // One subscription per rail rather than one per tile.
  const cart = useCart()
  if (items.length === 0) return null

  return (
    <section className="space-y-3.5">
      <header className="flex items-baseline justify-between gap-3 px-1">
        <h3 className="truncate text-[19px] font-extrabold tracking-tight text-white">
          {title}
        </h3>
        {seeAllTo && (
          <Link
            to={seeAllTo}
            className="flex shrink-0 items-center gap-1 font-mono text-[12.5px] font-bold tracking-wider text-brand-400 uppercase transition hover:text-brand-300"
          >
            See all
            <ArrowRight size={11} aria-hidden="true" />
          </Link>
        )}
      </header>

      {/* -mx-1 px-1 so the first and last cards are not clipped by the scroll
          container's own edge, and [scrollbar-width:none] because a permanent
          scrollbar under every row is six scrollbars on one page. */}
      <div className="-mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map((match) => (
          <Tile key={match.item.id} match={match} quantity={cartQuantity(cart, match.item.id)} />
        ))}
      </div>
    </section>
  )
}
