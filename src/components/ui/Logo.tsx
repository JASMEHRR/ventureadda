/**
 * The VentureAdda mark. Drawn here rather than loaded as an image so it inherits
 * colour from its context, stays sharp at every density, and costs no request.
 *
 * Two elements only, because the smallest place it appears is a 16px browser
 * tab: a glass tile — the same rounded square every panel in this design system
 * is — and a V struck through it. Anything finer than this disappears at that
 * size, which is why there is no serif, no gradient and no third shape.
 *
 * `currentColor` throughout. Cyan is the accent everywhere it is used, but the
 * mark does not hard-code it, so a future light theme or a mono context can set
 * the colour at the call site.
 */
export function LogoMark({ size = 22, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={`shrink-0 ${className}`}
    >
      <rect
        x="0.9"
        y="0.9"
        width="22.2"
        height="22.2"
        rx="6.6"
        stroke="currentColor"
        strokeWidth="1.6"
        opacity="0.3"
      />
      <path
        d="M6.4 7.1 L12 17 L17.6 7.1"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/**
 * Mark plus wordmark. `markOnly` is for the collapsed sidebar, where the tile
 * has to stand in for the name — it keeps the name in the accessible tree
 * regardless, because a link whose only content is a decorative SVG announces
 * as nothing at all.
 */
export default function Logo({
  markOnly = false,
  size = 22,
  className = '',
}: {
  markOnly?: boolean
  size?: number
  className?: string
}) {
  return (
    <span className={`flex items-center gap-2 ${className}`}>
      <LogoMark size={size} className="text-brand-400" />
      <span
        className={
          markOnly
            ? 'sr-only'
            : 'text-[20px] font-extrabold tracking-tight text-white whitespace-nowrap'
        }
      >
        VentureAdda
      </span>
    </span>
  )
}
