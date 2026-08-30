import { useSyncExternalStore } from 'react'
import { Link } from 'react-router-dom'
import { Clock } from 'lucide-react'
import { displayUrl } from '../../lib/cloudinary'
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
 *
 * TWO SHAPES, AND THE PHONE GETS THE OTHER ONE. This card is roughly a screen
 * tall at 375px — photo, category, name, two lines of description, hours — so
 * a directory of four ventures was four full screens of scrolling. Seeing the
 * whole campus at once is the one thing the directory is for. Below `sm` it
 * becomes a row: one thumbnail, the name, and the line under it.
 *
 * Chosen in JavaScript rather than with `hidden sm:block`, because the CSS
 * version renders both: the phone would mount a carousel it cannot see and
 * fetch every photograph in it, which is exactly the weight the row exists to
 * avoid.
 */

/**
 * Whether this screen is at least `sm`, kept in sync with the media query.
 *
 * useSyncExternalStore rather than an effect, so the first paint is already
 * the right shape — an effect would render the desktop card on a phone for a
 * frame and fetch its photographs before correcting itself.
 */
const WIDE = '(min-width: 640px)'

function subscribeWide(callback: () => void): () => void {
  const query = window.matchMedia(WIDE)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia(WIDE).matches,
    // Server default. There is no server rendering here, but the third
    // argument is required and `true` is the safer guess for a crawler.
    () => true,
  )
}
export default function VentureCard({
  venture,
  categoryName,
  rating,
  /** Position in the grid, used only to stagger the auto-advance. */
  index = 0,
  dataTour,
}: {
  venture: Venture
  categoryName: string
  /** Absent until anyone has reviewed. */
  rating?: RatingSummary
  index?: number
  /** Names this card for the walkthrough — see components/Walkthrough. */
  dataTour?: string
}) {
  const wide = useWide()

  if (!wide) {
    const cover = venture.photos[0]
    return (
      <article
        data-tour={dataTour}
        className="liquid-glass-panel deferred-surface rounded-2xl p-2.5 transition duration-150 active:scale-[0.99]"
        style={{ '--surface-height': '104px' } as React.CSSProperties}
      >
        <Link to={venturePath(venture)} className="flex items-center gap-3">
          {cover ? (
            <img
              src={displayUrl(cover, 400)}
              alt=""
              loading="lazy"
              className="h-20 w-20 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
            />
          ) : (
            <VentureLogo name={venture.name} logo={venture.logo} size={80} />
          )}

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="truncate font-mono text-[12.5px] tracking-[0.18em] text-white/55 uppercase">
                {categoryName}
              </span>
              {venture.isDemo && (
                <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/15 px-1.5 py-0.5 font-mono text-[11px] font-bold tracking-wider text-amber-400 uppercase">
                  Demo
                </span>
              )}
            </span>

            <span className="mt-0.5 flex items-center gap-2">
              <span className="min-w-0 truncate text-[18px] font-extrabold text-white">
                {venture.name}
              </span>
              {rating && rating.count > 0 && (
                <span className="flex shrink-0 items-center gap-1 text-white/60">
                  <StarDisplay value={rating.average} size={10} />
                  <span className="font-mono text-[13px] font-bold">
                    {rating.average.toFixed(1)}
                  </span>
                  <span className="sr-only">
                    out of 5, from {rating.count} {rating.count === 1 ? 'review' : 'reviews'}
                  </span>
                </span>
              )}
            </span>

            <span className="mt-1 flex items-center gap-1.5 text-white/60">
              <Clock size={10} aria-hidden="true" className="shrink-0" />
              <span className="truncate font-mono text-[12.5px] tracking-wider uppercase">
                {venture.hours}
              </span>
            </span>
          </span>
        </Link>
      </article>
    )
  }

  return (
    <article
      data-tour={dataTour}
      className="liquid-glass-panel deferred-surface group rounded-3xl p-3 transition duration-150 hover:bg-white/[0.06]"
      style={{ '--surface-height': '420px' } as React.CSSProperties}
    >
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
            <span className="truncate font-mono text-[12.5px] tracking-[0.22em] text-white/55 uppercase">
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

        <div className="mt-3 flex items-center gap-1.5 text-white/60">
          <Clock size={11} aria-hidden="true" className="shrink-0" />
          <span className="truncate font-mono text-[13px] tracking-wider uppercase">
            {venture.hours}
          </span>
        </div>
      </Link>
    </article>
  )
}
