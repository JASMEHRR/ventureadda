import { displayUrl } from '../../lib/cloudinary'
import type { StoredImage } from '../../data/types'

/**
 * A venture's own mark, wherever its name appears.
 *
 * Same idea as Avatar — an initial on a tinted tile when there is no image —
 * but square rather than round, which is what keeps a business apart from a
 * person at a glance. Most ventures will never upload one, so the fallback is
 * the common path and has to look deliberate rather than broken.
 */
export default function VentureLogo({
  name,
  logo,
  size = 40,
  className = '',
}: {
  name: string
  logo?: StoredImage
  /** Rendered pixel size. The image itself is always fetched at the 400px rung,
   *  which is the smallest the transformation ladder offers and comfortably
   *  above any size a logo is drawn at here, retina included. */
  size?: number
  className?: string
}) {
  const shared = `shrink-0 rounded-xl ring-1 ring-white/10 ring-inset ${className}`

  if (logo) {
    return (
      <img
        src={displayUrl(logo, 400)}
        alt=""
        loading="lazy"
        style={{ width: size, height: size }}
        className={`object-cover ${shared}`}
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={`flex items-center justify-center bg-brand-500/20 font-extrabold text-brand-300 ${shared}`}
    >
      {name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}
