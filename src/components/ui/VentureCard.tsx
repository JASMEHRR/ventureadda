import { Link } from 'react-router-dom'
import { Clock, ImageOff } from 'lucide-react'
import type { Venture } from '../../data/ventures'
import type { RatingSummary } from '../../data/reviews'
import { StarDisplay } from './StarRating'
import VentureLogo from './VentureLogo'
import { displayUrl } from '../../lib/cloudinary'

/**
 * Photography pattern from Step 0: 4:3, rounded-2xl, inset hairline border,
 * inside a glass card. Venture names sit at 17px rather than Ascend's 12–13px
 * card titles, per the mobile-first departure.
 */
export default function VentureCard({
  venture,
  categoryName,
  rating,
}: {
  venture: Venture
  categoryName: string
  /** Absent until anyone has reviewed. */
  rating?: RatingSummary
}) {
  return (
    <Link
      to={`/venture/${venture.id}`}
      className="liquid-glass-panel group block rounded-3xl p-3 transition duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      {venture.photos[0] ? (
        <img
          // w_800 rather than the original: a 4MB phone photo drawn 300px wide
          // is most of the page weight on campus wifi.
          src={displayUrl(venture.photos[0], 800)}
          alt=""
          loading="lazy"
          className="aspect-4/3 w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
        />
      ) : (
        <div className="flex aspect-4/3 w-full items-center justify-center rounded-2xl bg-white/[0.03] text-white/20 ring-1 ring-white/10 ring-inset">
          <ImageOff size={22} aria-hidden="true" />
        </div>
      )}
      <div className="px-2 pt-3.5 pb-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase">
              {categoryName}
            </span>
            {/* Marked on the card, not only in the admin view. These carry
                deliberately invalid phone numbers, so an unmarked one is a
                student tapping WhatsApp and landing on an error with no idea
                why. Amber rather than brand: this is a caveat, not a feature. */}
            {venture.isDemo && (
              <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-mono text-[8px] font-bold tracking-[0.18em] text-amber-400 uppercase">
                Demo
              </span>
            )}
          </span>
          {rating && rating.count > 0 && (
            <span className="flex shrink-0 items-center gap-1.5 text-white/60">
              <StarDisplay value={rating.average} size={11} />
              <span className="font-mono text-[11px] font-bold">{rating.average.toFixed(1)}</span>
              <span className="sr-only">
                out of 5, from {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2.5">
          <VentureLogo name={venture.name} logo={venture.logo} size={34} />
          <h3 className="min-w-0 truncate text-[17px] font-extrabold text-white">{venture.name}</h3>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[13.5px] leading-snug text-white/55">
          {venture.description}
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-white/40">
          <Clock size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate font-mono text-[10px] tracking-wider uppercase">
            {venture.hours}
          </span>
        </div>
      </div>
    </Link>
  )
}
