import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Link2, Minus, PackageSearch, Plus, Store } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import BrandIcon from '../components/ui/BrandIcon'
import VentureLogo from '../components/ui/VentureLogo'
import WhatsAppIcon from '../components/ui/WhatsAppIcon'
import ProductRail from '../components/ProductRail'
import ShareDialog from '../components/ShareDialog'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems, recordInquiry, venturePath } from '../data/ventures'
import { cartQuantity, setCartQuantity, useCart } from '../data/cart'
import { displayUrl } from '../lib/cloudinary'
import { itemShareMessage, itemUrl } from '../lib/share'
import { tidyBreaks } from '../lib/richText'

/**
 * One product, on its own page.
 *
 * WHY THIS IS A PAGE AND NOT AN EXPANDING PANEL. It was a panel first: tapping
 * a product opened it in place, inside the grid. In a grid that is a disaster,
 * because a cell that grows takes its whole ROW with it — three neighbours
 * turn into tall empty voids beside the one thing somebody wanted to look at.
 * There is no arrangement of that which reads as designed.
 *
 * A page also gets three things a panel cannot. The back button works, so
 * getting out is the gesture everybody already knows. The URL is the thing
 * itself, which is what makes "Send this" send a product rather than a shop
 * with an instruction attached. And there is room: the photograph can be the
 * size of a photograph rather than the size of a grid cell.
 *
 * NESTED UNDER THE VENTURE in the URL — /venture/loopberry/item/abc — because
 * a product belongs to a shop and the link should say so before it is opened.
 */
export default function ItemPage() {
  const { ventureId = '', itemId = '' } = useParams()
  const cart = useCart()
  const [copied, setCopied] = useState(false)
  const [asked, setAsked] = useState(false)
  const [sharing, setSharing] = useState(false)

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])
  // The document id, not the slug in the URL — see the same note in
  // VentureDetail. Menu items store the id.
  const resolvedId = venture.data?.id
  const menu = useAsyncData(
    () => (resolvedId ? listMenuItems(resolvedId) : Promise.resolve([])),
    [resolvedId],
  )

  const item = menu.data?.find((entry) => entry.id === itemId)

  // Arriving from a rail halfway down another page should not start halfway
  // down this one.
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [itemId])

  if (venture.loading || (resolvedId && menu.loading && !menu.data)) {
    return <LoadingLine label="Loading…" />
  }

  const v = venture.data
  if (!v || (menu.data && !item)) {
    return (
      <EmptyState icon={PackageSearch} title="That item is not here">
        It may have been taken off the menu, or the link may be wrong.
        {v && (
          <span className="mt-3 block">
            <Button variant="secondary" to={venturePath(v)}>
              Open {v.name}
            </Button>
          </span>
        )}
      </EmptyState>
    )
  }
  if (!item) return <LoadingLine label="Loading…" />

  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const priced = typeof item.price === 'number'
  const quantity = cartQuantity(cart, item.id)
  const left = item.stock === undefined ? Infinity : item.stock - quantity
  const url = typeof window === 'undefined' ? '' : itemUrl(venturePath(v), item.id, window.location.origin)

  const ask = () => {
    if (asked) return
    setAsked(true)
    void recordInquiry(item.id)
  }

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Refused in some in-app browsers, the WhatsApp one included. The button
      // beside it carries the same link and needs no clipboard.
      setCopied(false)
    }
  }

  // The rest of the shop, which is the question somebody asks straight after
  // "what is this": what else do they make. Their own items only, and never
  // this one again.
  const alsoHere = (menu.data ?? [])
    .filter((entry) => entry.id !== item.id)
    .slice(0, 12)
    .map((entry) => ({ item: entry, venture: v }))

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link
        to={venturePath(v)}
        className="inline-flex items-center gap-1.5 font-mono text-[13px] font-bold tracking-wider text-white/55 uppercase transition hover:text-brand-300"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        {v.name}
      </Link>

      <div className="grid gap-5 md:grid-cols-[minmax(0,5fr)_minmax(0,4fr)] md:items-start">
        {/* The photograph at the size of a photograph, which is the whole
            reason this is not a grid cell. */}
        <div className="liquid-glass-panel overflow-hidden rounded-3xl">
          {item.photo ? (
            <img
              src={displayUrl(item.photo, 1200)}
              alt={item.name}
              className={`aspect-square w-full object-cover ${sellable ? '' : 'grayscale'}`}
            />
          ) : (
            <span
              aria-hidden="true"
              className="flex aspect-square w-full items-center justify-center bg-white/[0.04]"
            >
              {v.brandLogos ? (
                <BrandIcon
                  name={item.name}
                  size={120}
                  fallback={<VentureLogo name={v.name} logo={v.logo} size={120} />}
                />
              ) : (
                <VentureLogo name={v.name} logo={v.logo} size={120} />
              )}
            </span>
          )}
        </div>

        <div className="space-y-4">
          <div>
            <h1 className="text-[26px] leading-tight font-extrabold tracking-tight text-white sm:text-[30px]">
              {item.name}
            </h1>
            <Link
              to={venturePath(v)}
              className="mt-1.5 inline-flex items-center gap-1.5 font-mono text-[13px] tracking-wider text-white/55 uppercase transition hover:text-brand-300"
            >
              <Store size={12} aria-hidden="true" />
              {v.name}
            </Link>
          </div>

          <div className="flex flex-wrap items-baseline gap-3">
            <span className="font-mono text-[26px] font-extrabold text-brand-400">
              {priced ? `₹${item.price}` : 'Ask'}
            </span>
            {!sellable && (
              <span className="rounded-full border border-red-500/40 bg-red-500/15 px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-wider text-red-300 uppercase">
                Sold out
              </span>
            )}
            {typeof item.stock === 'number' && sellable && (
              <span className="font-mono text-[13px] tracking-wider text-white/55 uppercase">
                {item.stock} left
              </span>
            )}
          </div>

          {item.description && (
            <p className="text-[16.5px] leading-relaxed whitespace-pre-line text-white/70">
              {tidyBreaks(item.description)}
            </p>
          )}

          {/* The action, sized like one. An unpriced item cannot go in a cart
              — a total made partly of guesses is worse than no total — so it
              messages the seller instead. */}
          {!sellable ? (
            <p className="rounded-2xl bg-white/[0.05] px-4 py-3 text-center font-mono text-[13px] font-bold tracking-wider text-white/60 uppercase">
              Not available right now
            </p>
          ) : !priced ? (
            <a
              href={`https://wa.me/${v.phone}?text=${encodeURIComponent(
                `Hi ${v.name}, how much is "${item.name}"? (from VentureAdda)`,
              )}`}
              target="_blank"
              rel="noreferrer noopener"
              onClick={ask}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366]/15 py-3.5 text-[16px] font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/25 active:scale-[0.98]"
            >
              <WhatsAppIcon size={16} />
              Negotiate on WhatsApp
            </a>
          ) : quantity === 0 ? (
            <button
              type="button"
              onClick={() => setCartQuantity(item, v, 1)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-500/20 py-3.5 text-[16px] font-bold tracking-wide text-brand-300 uppercase transition duration-150 hover:bg-brand-500/30 active:scale-[0.98]"
            >
              <Plus size={15} aria-hidden="true" />
              Add to order
            </button>
          ) : (
            <div className="flex items-center justify-between gap-2 rounded-2xl bg-brand-500/15 p-2">
              <button
                type="button"
                onClick={() => setCartQuantity(item, v, quantity - 1)}
                aria-label={`Remove one ${item.name}`}
                className="rounded-xl p-2.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9]"
              >
                <Minus size={16} aria-hidden="true" />
              </button>
              <span
                aria-live="polite"
                aria-atomic="true"
                className="font-mono text-[18px] font-extrabold text-brand-300"
              >
                <span className="sr-only">{item.name}, </span>
                {quantity} in your order
              </span>
              <button
                type="button"
                onClick={() => setCartQuantity(item, v, quantity + 1)}
                disabled={left <= 0}
                aria-label={`Add one more ${item.name}`}
                className="rounded-xl p-2.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9] disabled:opacity-30"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-4">
            {/* Opens the dialog rather than WhatsApp: the message is the
                point, and a link sent under nothing does an advert's job with
                none of the words. See ShareDialog. */}
            <button
              type="button"
              onClick={() => setSharing(true)}
              className="flex items-center gap-1.5 rounded-xl bg-white/8 px-3.5 py-2.5 text-[14.5px] font-bold text-white/70 transition duration-150 hover:bg-white/12 hover:text-white active:scale-[0.96]"
            >
              <WhatsAppIcon size={14} />
              Send this
            </button>
            <button
              type="button"
              onClick={() => void copyLink()}
              className={`flex items-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[14.5px] font-bold transition duration-150 active:scale-[0.96] ${
                copied
                  ? 'bg-brand-500/20 text-brand-300'
                  : 'bg-white/8 text-white/70 hover:bg-white/12 hover:text-white'
              }`}
            >
              {copied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Link2 size={14} aria-hidden="true" />
              )}
              {copied ? 'Copied' : 'Copy link'}
            </button>
            <span role="status" className="sr-only">
              {copied ? 'Link copied to your clipboard.' : ''}
            </span>
          </div>
        </div>
      </div>

      {alsoHere.length > 0 && <ProductRail title={`More from ${v.name}`} items={alsoHere} />}

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        title={`Send ${item.name}`}
        build={(pitch, custom) => itemShareMessage(item, v.name, url, pitch, custom)}
      />
    </div>
  )
}
