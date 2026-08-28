import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { venturePath } from '../../data/ventures'
import type { Venture } from '../../data/ventures'
import type { RatingSummary } from '../../data/reviews'
import { StarDisplay } from './StarRating'
import VentureLogo from './VentureLogo'
import PhotoCarousel from './PhotoCarousel'

/**
 * Photography pattern from Step 0: 4:3, rounded-2xl, inset hairline border,
 * inside a glass card. Venture names sit at 17px rather than Ascend's 12–13px
 * card titles, per the mobile-first departure.
 *
 * NOT ONE BIG <Link> ANY MORE. The photo is a carousel now, and a carousel has
 * arrows and dots — buttons, which cannot legally live inside an anchor; a
 * browser resolves that markup by throwing the inner controls away. So the
 * card is an <article>, each slide is its own link to the venture, and the
 * text block below is another. Every part of the card that used to navigate
 * still navigates.
 *
 * Cards stagger their auto-advance by position, so a grid of them does not
 * flip over in unison like a departures board.
 */
export default function VentureCard({
  venture,
  categoryName,
  rating,
  /** Position in the grid, used only to stagger the auto-advance. */
  index = 0,
}: {
  venture: Venture
  categoryName: string
  /** Absent until anyone has reviewed. */
  rating?: RatingSummary
  index?: number
}) {
  return (
    <article className="liquid-glass-panel group rounded-3xl p-3 transition duration-150 hover:bg-white/[0.06]">
      <PhotoCarousel
        photos={venture.photos}
        alt={venture.name}
        // w_800 rather than the original: a 4MB phone photo drawn 300px wide
        // is most of the page weight on campus wifi.
        width={800}
        to={venturePath(venture)}
        autoAdvanceMs={4500 + (index % 5) * 700}
      />
      <Link to={venturePath(venture)} className="block px-2 pt-3.5 pb-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate font-mono text-[12.5px] tracking-[0.22em] text-white/30 uppercase">
              {categoryName}
            </span>
            {/* Marked on the card, not only in the admin view. These carry
                deliberately invalid phone numbers, so an unmarked one is a
                student tapping WhatsApp and landing on an error with no idea
                why. Amber rather than brand: this is a caveat, not a feature. */}
            {venture.isDemo && (
              <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-2 py-0.5 font-mono text-[12.5px] font-bold tracking-[0.18em] text-amber-400 uppercase">
                Demo
              </span>
            )}
          </span>
          {rating && rating.count > 0 && (
            <span className="flex shrink-0 items-center gap-1.5 text-white/60">
              <StarDisplay value={rating.average} size={11} />
              <span className="font-mono text-[14px] font-bold">{rating.average.toFixed(1)}</span>
              <span className="sr-only">
                out of 5, from {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
              </span>
            </span>
          )}
        </div>

        <div className="mt-1.5 flex items-center gap-2.5">
          <VentureLogo name={venture.name} logo={venture.logo} size={34} />
          <h3 className="min-w-0 truncate text-[19px] font-extrabold text-white">{venture.name}</h3>
        </div>
        <p className="mt-1.5 line-clamp-2 text-[16px] leading-snug text-white/55">
          {venture.description}
        </p>

        <div className="mt-3 flex items-center gap-1.5 text-white/40">
          <Clock size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate font-mono text-[13px] tracking-wider uppercase">
            {venture.hours}
          </span>
        </div>
      </Link>
    </article>
  )
}
