import { useEffect, useState } from 'react'
import BillboardSlot from './BillboardSlot'
import { useAsyncData } from '../hooks/useAsyncData'
import { listLiveBillboards } from '../data/billboard'
import { getSiteSettings } from '../data/settings'
import { billboardOrder, billboardSeconds } from '../data/billboardPick'

/**
 * The billboard as it appears on a page: one advert at a time, changing itself.
 *
 * WHY A SLIDER RATHER THAN A FIXED SLOT. The board used to pick one advert per
 * twenty-minute bucket, which was fair over a week and useless to the seller
 * whose turn fell at four in the morning. Cycling in the reader's own browser
 * means every visitor sees every advert, so "fair" stops depending on when
 * somebody happened to open the page. billboardOrder still interleaves by
 * venture, so a shop with six adverts is spread across the rotation rather
 * than holding six slides in a row.
 *
 * ONE READ, SHARED BY THE PAGES THAT SHOW IT. Products and Browse both mount
 * this, and each mount is one small query returning only approved rows.
 *
 * IT PAUSES ON FOCUS, AND DELIBERATELY NOT ON HOVER. Hover-pause is the
 * conventional choice and it was wrong here: this is a full-width banner
 * across the top of the page, so on a desktop the pointer rests over it most
 * of the time and the board simply stopped — reported as "does not auto
 * change", and reproduced by dispatching one mouseenter and watching it sit
 * there. On a touch screen it was worse: a tap can fire mouseenter with no
 * mouseleave ever following, which froze it for the rest of the visit.
 *
 * Focus is a different matter and stays: somebody tabbing towards the link has
 * asked for it, and moving it under them would be the site taking something
 * away as it is being reached for. Keyboard focus cannot be entered by
 * accident the way a pointer crosses a banner.
 */
export default function BillboardBoard({
  /** A heading above it, on pages where it needs introducing. */
  title,
}: {
  title?: string
}) {
  const ads = useAsyncData(() => listLiveBillboards(), [])
  // The moderator's dial. One tiny read of a document the shell already
  // fetches elsewhere, and an unset or malformed value falls back to the
  // shipped default rather than to a board that never moves.
  const settings = useAsyncData(() => getSiteSettings(), [])
  const seconds = billboardSeconds(settings.data?.billboardSeconds)
  const order = billboardOrder(ads.data ?? [])
  const [index, setIndex] = useState(0)
  const [held, setHeld] = useState(false)

  // A shrinking board must not leave the index past the end — an advert
  // deleted or paused while somebody has the page open would otherwise blank
  // the slot until they navigated.
  const safeIndex = order.length === 0 ? 0 : index % order.length

  useEffect(() => {
    if (order.length < 2 || held) return
    const timer = window.setInterval(() => setIndex((at) => at + 1), seconds * 1000)
    return () => window.clearInterval(timer)
  }, [order.length, held, seconds])

  if (order.length === 0) return null
  const ad = order[safeIndex]

  return (
    <section
      aria-label="Promoted on VentureAdda"
      className="space-y-2.5"
      onFocusCapture={() => setHeld(true)}
      onBlurCapture={() => setHeld(false)}
    >
      {title && (
        <h2 className="px-1 font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          {title}
        </h2>
      )}

      <BillboardSlot ad={ad} />

      {/* Only worth drawing when there is somewhere to go. Dots rather than
          arrows: the board moves on its own, so these are for jumping to the
          one you glimpsed, not for driving it. */}
      {order.length > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-0.5">
          {order.map((entry, at) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setIndex(at)}
              aria-label={`Advert ${at + 1} of ${order.length}`}
              aria-current={at === safeIndex}
              className={`h-1.5 rounded-full transition-all duration-200 ${
                at === safeIndex ? 'w-5 bg-brand-400' : 'w-1.5 bg-white/25 hover:bg-white/50'
              }`}
            />
          ))}
        </div>
      )}
    </section>
  )
}
