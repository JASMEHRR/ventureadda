import { NavLink } from 'react-router-dom'
import type { NavItem } from '../../navigation'
import { DEV_NAV, MODERATOR_NAV, PRIMARY_NAV } from '../../navigation'

/**
 * Desktop sidebar. Hidden below `md`, where MobileNav takes over — the two
 * switch at the same breakpoint so exactly one nav pattern is ever on screen,
 * never both and never neither (spec §4).
 *
 * Nav item states are Ascend's, verbatim from spec §5.
 */
function SidebarLink({ item, badge }: { item: NavItem; badge?: number }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      className={({ isActive }) =>
        `group flex items-start gap-3 rounded-2xl border px-4 py-3 transition duration-150 active:scale-[0.98] ${
          isActive
            ? 'border-white/20 bg-white/15 shadow-sm backdrop-blur-md'
            : 'border-transparent bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.07]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            size={16}
            aria-hidden="true"
            className={`mt-0.5 shrink-0 transition-colors ${
              isActive ? 'text-brand-400' : 'text-white/40 group-hover:text-white/85'
            }`}
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span
                className={`font-mono text-[11px] tracking-wider uppercase transition-colors ${
                  isActive ? 'font-extrabold text-white' : 'font-bold text-white/40 group-hover:text-white/85'
                }`}
              >
                {item.label}
              </span>
              {badge !== undefined && badge > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-500/20 px-1.5 font-mono text-[9px] font-bold text-brand-400 ring-1 ring-brand-500/50">
                  {badge}
                </span>
              )}
            </span>
            <span className="mt-1 block text-[12px] leading-snug text-white/35">
              {item.description}
            </span>
          </span>
        </>
      )}
    </NavLink>
  )
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="px-4 pt-5 pb-2 font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
      {children}
    </p>
  )
}

export default function Sidebar({ isModerator = false }: { isModerator?: boolean }) {
  return (
    <aside className="liquid-glass-panel hidden w-64 shrink-0 flex-col self-start rounded-[2rem] p-4 md:sticky md:top-6 md:flex">
      <div className="px-4 pt-2 pb-1">
        <p className="font-mono text-[9px] font-extrabold tracking-[0.28em] text-white/40 uppercase">
          Thapar
        </p>
        <p className="mt-1 text-[19px] font-extrabold tracking-tight text-white">VentureAdda</p>
      </div>

      <nav aria-label="Primary">
        <SectionLabel>Browse</SectionLabel>
        <div className="space-y-1.5">
          {PRIMARY_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>

        {isModerator && (
          <>
            <SectionLabel>Moderator</SectionLabel>
            <div className="space-y-1.5">
              {MODERATOR_NAV.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          </>
        )}

        <SectionLabel>Reference</SectionLabel>
        <div className="space-y-1.5">
          {DEV_NAV.map((item) => (
            <SidebarLink key={item.to} item={item} />
          ))}
        </div>
      </nav>

      <p className="mt-6 px-4 pb-1 font-mono text-[9px] tracking-[0.18em] text-white/20 uppercase">
        No payments on site
      </p>
    </aside>
  )
}
