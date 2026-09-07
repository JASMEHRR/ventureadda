import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Check, Link2, Store } from 'lucide-react'
import WhatsAppIcon from './ui/WhatsAppIcon'
import { displayUrl } from '../lib/cloudinary'
import { itemShareMessage, itemUrl } from '../lib/share'
import { tidyBreaks } from '../lib/richText'
import type { MenuItem, StoredImage } from '../data/types'

export type ItemVenture = {
  id: string
  name: string
  slug?: string
  phone: string
  logo?: StoredImage
}

function venturePathOf(venture: ItemVenture): string {
  return `/venture/${venture.slug || venture.id}`
}

/**
 * Everything about one item that a row or a tile has no room for.
 *
 * ONE DEFINITION, FOUR PLACES. The venture page's rows and tiles, the products
 * grid, the rails and the ask-list all open the same panel — because they are
 * all showing the same thing, and a description that reads one way on a shop
 * page and another on the products page is two answers to one question.
 *
 * IT IS WHY THESE STOPPED BEING LINKS. Every product on the site used to
 * navigate to the shop it came from, which answers "whose is this" and throws
 * away the question actually being asked, which is "what is this". Somebody
 * looking at eight hundred products across forty shops does not want forty
 * page loads; they want the one they tapped to open where it is. The shop is
 * still one tap away, at the bottom, for when that IS the question.
 */
export default function ItemDetails({
  item,
  venture,
  onAsk,
}: {
  item: MenuItem
  venture: ItemVenture
  /** Counted when somebody taps through to ask — see countInterest. */
  onAsk?: () => void
}) {
  const [copied, setCopied] = useState(false)
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const path = venturePathOf(venture)
  const url = typeof window === 'undefined' ? '' : itemUrl(path, item.id, window.location.origin)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Refused outright in some in-app browsers, the WhatsApp one included,
      // which is where a lot of this traffic comes from. The button beside it
      // carries the same link and needs no clipboard.
      setCopied(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-white/8 px-3 pt-3 pb-3">
      {item.photo && (
        <img
          src={displayUrl(item.photo, 800)}
          alt={item.name}
          loading="lazy"
          className="max-h-64 w-full rounded-xl object-cover"
        />
      )}

      {item.description ? (
        <p className="text-[15.5px] leading-relaxed whitespace-pre-line text-white/70">
          {tidyBreaks(item.description)}
        </p>
      ) : (
        <p className="text-[15.5px] text-white/45">No description for this one.</p>
      )}

      {typeof item.stock === 'number' && sellable && (
        <p className="font-mono text-[13px] tracking-wider text-white/55 uppercase">
          {item.stock} left
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            itemShareMessage(item, venture.name, url),
          )}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-2 text-[14px] font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/25 active:scale-[0.96]"
        >
          <WhatsAppIcon size={13} />
          Send this
        </a>

        <button
          type="button"
          onClick={() => void copyLink()}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-bold transition duration-150 active:scale-[0.96] ${
            copied
              ? 'bg-brand-500/20 text-brand-300'
              : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80'
          }`}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>

        {typeof item.price !== 'number' && sellable && venture.phone && (
          <a
            href={`https://wa.me/${venture.phone}?text=${encodeURIComponent(
              `Hi ${venture.name}, how much is "${item.name}"? (from VentureAdda)`,
            )}`}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onAsk?.()}
            className="flex items-center gap-1.5 rounded-xl bg-white/8 px-3 py-2 text-[14px] font-bold text-white/60 transition duration-150 hover:bg-white/12 hover:text-white/80 active:scale-[0.96]"
          >
            <WhatsAppIcon size={13} />
            Negotiate
          </a>
        )}

        {/* The shop, for when whose-is-this IS the question. Last and quiet:
            it is the thing this panel exists to stop being the only option. */}
        <Link
          to={path}
          className="ml-auto flex items-center gap-1.5 font-mono text-[13px] font-bold tracking-wider text-white/45 uppercase transition hover:text-brand-300"
        >
          <Store size={12} aria-hidden="true" />
          {venture.name}
        </Link>
      </div>

      <span role="status" className="sr-only">
        {copied ? 'Link copied to your clipboard.' : ''}
      </span>
    </div>
  )
}
