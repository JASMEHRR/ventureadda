import { NavLink } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { BUYER_NAV, MODERATOR_NAV, PRIMARY_NAV } from '../../navigation'

/**
 * Fixed bottom bar, below `md` only — the counterpart to Sidebar, switching at
 * the same breakpoint so exactly one nav pattern is ever visible (spec §4).
 * AppShell reserves `pb-24` below `md` so content clears it.
 *
 * Items are drawn from the shared navigation module, filtered to those that fit
 * a phone. "Add Venture" lives here as well as in the top bar: on a phone the
 * top-right corner is a long reach, and listing a venture is the action the
 * whole site exists to encourage.
 */
export default function MobileNav({
  isModerator = false,
  isSignedIn = false,
}: {
  isModerator?: boolean
  isSignedIn?: boolean
}) {
  // Dropping Categories freed the slot this fills: on a phone, "where is my
  // order" is asked far more often than "show me a grid of six category
  // tiles", and the tracking page had no route here at all before.
  const items = [
    ...PRIMARY_NAV,
    ...(isSignedIn ? BUYER_NAV : []),
    ...(isModerator ? MODERATOR_NAV : []),
  ].filter((item) => !item.desktopOnly)

  return (
    <nav
      aria-label="Primary"
      // inset-x-3 rather than inset-x-0: the bar floats with the backdrop
      // visible around it, like every other surface. Nothing is flush.
      className="liquid-glass-panel fixed inset-x-3 bottom-3 z-40 flex items-stretch gap-1 rounded-[1.5rem] p-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] md:hidden"
    >
      {items.map((item) => {
        const Icon = item.icon
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              `flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition duration-150 active:scale-[0.94] ${
                isActive ? 'bg-white/15 text-white' : 'text-white/40'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <Icon size={18} aria-hidden="true" className={isActive ? 'text-brand-400' : ''} />
                <span
                  className={`font-mono text-[12.5px] tracking-wider uppercase ${
                    isActive ? 'font-extrabold' : 'font-bold'
                  }`}
                >
                  {item.label}
                </span>
              </>
            )}
          </NavLink>
        )
      })}

      <NavLink
        to="/add"
        className={({ isActive }) =>
          `flex flex-1 flex-col items-center gap-1 rounded-2xl px-1 py-2 transition duration-150 active:scale-[0.94] ${
            isActive ? 'bg-brand-500/25 text-brand-300' : 'text-brand-400'
          }`
        }
      >
        <Plus size={18} aria-hidden="true" />
        <span className="font-mono text-[12.5px] font-bold tracking-wider uppercase">List</span>
      </NavLink>
    </nav>
  )
}
