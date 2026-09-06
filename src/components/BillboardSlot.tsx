import { Link } from 'react-router-dom'
import { ArrowRight, Megaphone } from 'lucide-react'
import VentureLogo from './ui/VentureLogo'
import { displayUrl } from '../lib/cloudinary'
import type { Billboard } from '../data/billboardPick'

/**
 * The one advert slot on the main screen.
 *
 * ONE POST, WIDE, ABOVE EVERYTHING. Not a rail of adverts — a rail is
 * something the eye learns to skip, and an advert nobody looks at is worth
 * nothing to the seller who asked for it. One at a time, taking the full width
 * once, is the whole design.
 *
 * LABELLED AS AN ADVERT, in words, on the tile. This is not a recommendation
 * the site is making and it must not be able to be read as one: the seller
 * asked to be here and wrote the line themselves. A moderator approved it,
 * which is a check on what it says rather than an endorsement of the shop. The
 * tag is not decoration and should not be made subtler.
 *
 * Whose turn it is comes from pickBillboard — see billboardPick.ts for how the
 * slot is shared out.
 */
export default function BillboardSlot({ ad }: { ad: Billboard }) {
  const to = `/venture/${ad.ventureSlug || ad.ventureId}`

  return (
    <Link
      to={to}
      className="liquid-glass-panel group relative flex items-stretch gap-4 overflow-hidden rounded-3xl p-3 transition duration-200 hover:ring-1 hover:ring-brand-400/40 sm:gap-5 sm:p-4"
    >
      {/* The item, when there is a photograph of it. The seller's own mark
          otherwise, which is still a picture of who is talking. */}
      <span className="flex aspect-square w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-white/[0.04] sm:w-32">
        {ad.photo ? (
          <img
            src={displayUrl(ad.photo, 400)}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover"
          />
        ) : (
          <VentureLogo name={ad.ventureName} size={72} />
        )}
      </span>

      <span className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="flex items-center gap-1.5 rounded-lg bg-amber-500/20 px-2 py-1 font-mono text-[11px] font-extrabold tracking-[0.18em] text-amber-300 uppercase">
            <Megaphone size={11} aria-hidden="true" />
            Promoted
          </span>
          {ad.offer && (
            <span className="rounded-lg bg-brand-500/20 px-2 py-1 font-mono text-[11px] font-extrabold tracking-[0.18em] text-brand-300 uppercase">
              {ad.offer}
            </span>
          )}
        </span>

        <span className="line-clamp-2 text-[18px] leading-snug font-extrabold tracking-tight text-white sm:text-[21px]">
          {ad.pitch}
        </span>

        <span className="flex items-center gap-1.5 font-mono text-[12.5px] tracking-wider text-white/55 uppercase">
          <span className="truncate">
            {ad.itemName} &middot; {ad.ventureName}
          </span>
          <ArrowRight
            size={12}
            aria-hidden="true"
            className="shrink-0 transition-transform duration-200 group-hover:translate-x-0.5"
          />
        </span>
      </span>
    </Link>
  )
}
