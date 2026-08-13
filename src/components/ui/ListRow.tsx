import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

type ListRowProps = {
  title: string
  description?: string
  /** Price, count or similar. Rendered in mono — it is data, not prose. */
  meta?: ReactNode
  /** Square thumbnail. Takes the leading slot when present. */
  thumbnail?: string
  thumbnailAlt?: string
  /** Fallback leading slot: a circular glyph control, used when there is no photo. */
  icon?: LucideIcon
  /** Low-opacity affordance on the far right, brightening on hover. */
  actionIcon?: LucideIcon
  /**
   * Accessible name for the whole row. The row is a single button, so this
   * should describe what tapping does, not just repeat the title —
   * e.g. "Message Hostel Bakes on WhatsApp about Chocolate Cake".
   */
  actionLabel?: string
  onClick?: () => void
}

/**
 * The dominant content pattern: a full-width glass row with a leading control,
 * a bold title, mono data on the right, and a quiet action affordance that
 * brightens on hover. Venture menu items are built from this.
 *
 * The leading slot takes either a square thumbnail (the photography pattern —
 * menu thumbs are rounded-xl and square) or a circular glyph (Ascend's pattern,
 * for items with no photo). Both cases are real, so both are supported.
 */
export default function ListRow({
  title,
  description,
  meta,
  thumbnail,
  thumbnailAlt = '',
  icon: Icon,
  actionIcon: ActionIcon,
  actionLabel,
  onClick,
}: ListRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={actionLabel}
      className="group liquid-glass-panel flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-left transition duration-150 hover:bg-white/[0.06] active:scale-[0.98] sm:gap-4 sm:px-5 sm:py-4"
    >
      {thumbnail ? (
        <img
          src={thumbnail}
          alt={thumbnailAlt}
          loading="lazy"
          className="h-14 w-14 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
        />
      ) : Icon ? (
        <span
          aria-hidden="true"
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/45"
        >
          <Icon size={18} />
        </span>
      ) : null}

      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold text-white">{title}</span>
        {description && (
          <span className="mt-0.5 block truncate text-[12.5px] text-white/45">{description}</span>
        )}
      </span>

      {meta && (
        <span className="shrink-0 font-mono text-[13px] font-bold text-white/90">{meta}</span>
      )}

      {ActionIcon && (
        <ActionIcon
          size={18}
          aria-hidden="true"
          className="shrink-0 text-white/30 transition-colors group-hover:text-white"
        />
      )}
    </button>
  )
}
