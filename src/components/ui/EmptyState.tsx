import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

/**
 * Centred glass panel with a circular glyph, used wherever there is nothing to
 * show: an empty directory, no search results, a venture that does not exist, a
 * sign-in wall, a 404.
 *
 * Five places had built this by hand and drifted — some centred the panel, some
 * did not; the copy width was max-w-sm in three of them and unbounded in the
 * fourth. The action slot is what most of the hand-rolled ones were reaching
 * for, and why they each re-created Button's pill classes on a Link.
 */
const glyphTones = {
  /** Nothing here, and that is not an achievement. */
  neutral: 'border-white/10 bg-white/[0.06] text-white/35',
  /** Something went right — a submission accepted, a form completed. */
  brand: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
}

export default function EmptyState({
  icon: Icon,
  eyebrow,
  title,
  children,
  action,
  extra,
  tone = 'neutral',
  className = '',
}: {
  icon: LucideIcon
  /** Mono uppercase kicker above the title, e.g. a step name or "404". */
  eyebrow?: string
  tone?: keyof typeof glyphTones
  title: string
  /** The explanation. Kept to max-w-sm — centred prose stops being readable wide. */
  children: ReactNode
  /** Usually one Button. Omitted when there is genuinely nothing to do. */
  action?: ReactNode
  /**
   * Block content between the description and the action — a panel, a list.
   * Separate from `children` because that renders inside a paragraph, and a
   * div inside a p is invalid markup the browser silently reparents.
   */
  extra?: ReactNode
  className?: string
}) {
  return (
    <div
      className={`liquid-glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center ${className}`}
    >
      <span
        className={`flex h-14 w-14 items-center justify-center rounded-full border ${glyphTones[tone]}`}
      >
        <Icon size={22} aria-hidden="true" />
      </span>
      {eyebrow && (
        <p className="mt-5 font-mono text-[9px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          {eyebrow}
        </p>
      )}
      <p className={`${eyebrow ? 'mt-2' : 'mt-5'} text-[19px] font-extrabold text-white`}>{title}</p>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/45">{children}</p>
      {extra && <div className="flex w-full justify-center">{extra}</div>}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  )
}
