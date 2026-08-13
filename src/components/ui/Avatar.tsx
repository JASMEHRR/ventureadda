/**
 * Initials only — Ascend's pattern, and deliberately kept. Student ventures
 * do not need photo avatars, and initials never fail to load or need moderating.
 */
export default function Avatar({ name, className = '' }: { name: string; className?: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-500/20 text-[13px] font-bold text-brand-300 ${className}`}
    >
      {initial}
    </span>
  )
}
