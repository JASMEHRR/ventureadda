import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import Logo, { LogoMark } from '../ui/Logo'
import type { NavItem } from '../../navigation'
import { DEV_NAV, MODERATOR_NAV, PRIMARY_NAV } from '../../navigation'

const STORAGE_KEY = 'ventureadda:sidebar-collapsed'

/**
 * Collapsed by default below `lg`, expanded above, unless the reader has said
 * otherwise — at which point their choice wins on every screen and survives
 * reloads.
 *
 * Read once, lazily, rather than in an effect: initialising to a guess and
 * correcting after mount makes the sidebar visibly snap open on every load for
 * anyone who collapsed it.
 */
function useCollapsed(): [boolean, (next: boolean) => void] {
  const [collapsed, setCollapsed] = useState(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored !== null) return stored === 'true'
    } catch {
      // Private-browsing or a blocked storage partition. Fall through to the
      // viewport default — a preference that cannot be saved is not an error
      // worth showing anyone.
    }
    return !window.matchMedia('(min-width: 1024px)').matches
  })

  const update = (next: boolean) => {
    setCollapsed(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, String(next))
    } catch {
      // Same as above: the session still works, it just will not be remembered.
    }
  }

  return [collapsed, update]
}

/**
 * Nav item states are Ascend's, verbatim from spec §5.
 *
 * Collapsed, the label leaves the page but never the accessible tree — it moves
 * into aria-label, and `title` supplies the hover tooltip. An icon rail whose
 * buttons announce as nothing is not a smaller sidebar, it is a broken one.
 *
 * DEPARTURE, deliberate: these items no longer carry a sentence of description.
 * That pairing is right for a dashboard one person opens daily and learns once;
 * it is wrong for a directory a stranger opens once from a WhatsApp link, and
 * it was most of why the panel needed 260px. Everything else — glass, radii,
 * type, the opacity ladder, the collapse behaviour itself — is spec.
 */
function SidebarLink({ item, collapsed }: { item: NavItem; collapsed: boolean }) {
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      end={item.to === '/'}
      aria-label={collapsed ? item.label : undefined}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) =>
        `group flex items-center rounded-2xl border transition duration-150 active:scale-[0.98] ${
          collapsed ? 'justify-center p-2.5' : 'gap-3 px-4 py-2.5'
        } ${
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
            className={`shrink-0 transition-colors ${
              isActive ? 'text-brand-400' : 'text-white/40 group-hover:text-white/85'
            }`}
          />
          {!collapsed && (
            <span
              className={`truncate font-mono text-[11px] tracking-wider uppercase transition-colors ${
                isActive
                  ? 'font-extrabold text-white'
                  : 'font-bold text-white/40 group-hover:text-white/85'
              }`}
            >
              {item.label}
            </span>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({ isModerator = false }: { isModerator?: boolean }) {
  const [collapsed, setCollapsed] = useCollapsed()

  const items = [...PRIMARY_NAV, ...(isModerator ? MODERATOR_NAV : []), ...DEV_NAV]

  return (
    <aside
      className={`liquid-glass-panel hidden shrink-0 flex-col self-start rounded-[2rem] transition-[width,padding] duration-200 md:sticky md:top-6 md:flex ${
        collapsed ? 'w-auto p-2' : 'w-64 p-4'
      }`}
    >
      <div
        className={`flex items-center ${collapsed ? 'flex-col gap-2' : 'justify-between gap-2 px-2 pt-1 pb-3'}`}
      >
        {collapsed ? (
          // The mark alone, above the collapse control rather than beside it:
          // at rail width there is only room for one thing per row. Into the
          // directory, not out to the marketing page — the same destination
          // the mobile top bar's mark has.
          <Link to="/browse" aria-label="VentureAdda, browse ventures" className="pt-1">
            <LogoMark size={22} className="text-brand-400" />
          </Link>
        ) : (
          <div className="min-w-0">
            <p className="font-mono text-[9px] font-extrabold tracking-[0.28em] text-white/40 uppercase">
              Thapar
            </p>
            <Link to="/browse" className="mt-1 block">
              <Logo />
            </Link>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/45 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94]"
        >
          {collapsed ? (
            <PanelLeftOpen size={15} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      <nav aria-label="Primary" className={`space-y-1.5 ${collapsed ? 'mt-1' : ''}`}>
        {items.map((item) => (
          <SidebarLink key={item.to} item={item} collapsed={collapsed} />
        ))}
      </nav>

      {!collapsed && (
        <p className="mt-6 px-4 pb-1 font-mono text-[9px] tracking-[0.18em] text-white/20 uppercase">
          No payments on site
        </p>
      )}
    </aside>
  )
}
