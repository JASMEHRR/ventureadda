import type { LucideIcon } from 'lucide-react'

/**
 * Honest "not built yet" state for routes the shell links to before their step
 * lands. It names the step so the nav is navigable without pretending a feature
 * exists — no fake data, no dead link.
 *
 * This is throwaway. Each route replaces it as its step is built.
 */
export default function Placeholder({
  step,
  icon: Icon,
  title,
  children,
}: {
  step: string
  icon: LucideIcon
  title: string
  children: string
}) {
  return (
    <div className="liquid-glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/35">
        <Icon size={22} aria-hidden="true" />
      </span>
      <p className="mt-5 font-mono text-[9px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
        {step}
      </p>
      <h2 className="mt-2 text-[19px] font-extrabold text-white">{title}</h2>
      <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/45">{children}</p>
    </div>
  )
}
