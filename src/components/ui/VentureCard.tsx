import { Link } from 'react-router-dom'
import { Clock, Star } from 'lucide-react'
import type { Venture } from '../../data/ventures'

/**
 * Photography pattern from Step 0: 4:3, rounded-2xl, inset hairline border,
 * inside a glass card. Venture names sit at 17px rather than Ascend's 12–13px
 * card titles, per the mobile-first departure.
 */
export default function VentureCard({
  venture,
  categoryName,
}: {
  venture: Venture
  categoryName: string
}) {
  return (
    <Link
      to={`/venture/${venture.id}`}
      className="liquid-glass-panel group block rounded-3xl p-3 transition duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
    >
      <img
        src={venture.photos[0]}
        alt=""
        loading="lazy"
        className="aspect-4/3 w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
      />
      <div className="px-2 pt-3.5 pb-1.5">
        <div className="flex items-center justify-between gap-3">
          <span className="truncate font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase">
            {categoryName}
          </span>
          {venture.rating !== null && (
            <span className="flex shrink-0 items-center gap-1 text-white/60">
              <Star size={11} aria-hidden="true" className="text-brand-400" />
              <span className="font-mono text-[11px] font-bold">{venture.rating.toFixed(1)}</span>
              <span className="sr-only">out of 5, from {venture.reviewCount} reviews</span>
            </span>
          )}
        </div>

        <h3 className="mt-1.5 text-[17px] font-extrabold text-white">{venture.name}</h3>
        <p className="mt-1 line-clamp-2 text-[13.5px] leading-snug text-white/55">
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
