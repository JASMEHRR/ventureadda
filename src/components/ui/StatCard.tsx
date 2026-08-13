import type { LucideIcon } from 'lucide-react'

/**
 * Semantic accents as observed in Ascend: cyan is the primary/positive metric,
 * amber is caution, red is a warning or a miss, plain white is a neutral count.
 * There is no green — the only green in this app is the WhatsApp button.
 */
export type StatAccent = 'brand' | 'amber' | 'red' | 'neutral'

const accents: Record<StatAccent, string> = {
  brand: 'text-brand-400',
  amber: 'text-amber-400',
  red: 'text-red-400',
  neutral: 'text-white',
}

type StatCardProps = {
  /** Small mono uppercase eyebrow. */
  label: string
  value: string | number
  /** Small lowercase word sitting beside the number — "taps", "live", "today". */
  unit?: string
  icon: LucideIcon
  accent?: StatAccent
}

export default function StatCard({
  label,
  value,
  unit,
  icon: Icon,
  accent = 'neutral',
}: StatCardProps) {
  return (
    <div className="liquid-glass-panel rounded-2xl px-3.5 py-3 sm:px-4 sm:py-3.5">
      <div className="flex items-center gap-1.5 text-white/40">
        <Icon size={11} aria-hidden="true" className="shrink-0" />
        <span className="truncate font-mono text-[9px] font-extrabold tracking-[0.18em] uppercase">
          {label}
        </span>
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span className={`font-mono text-2xl leading-none font-extrabold ${accents[accent]}`}>
          {value}
        </span>
        {unit && <span className="text-[11px] text-white/40">{unit}</span>}
      </div>
    </div>
  )
}
