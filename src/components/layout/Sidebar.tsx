import { useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import Logo, { LogoMark } from '../ui/Logo'
import type { NavItem } from '../../navigation'
import {
  BUYER_NAV,
  DEV_NAV,
  MODERATOR_NAV,
  PRIMARY_NAV,
  SELLER_NAV,
  SETTINGS_NAV,
} from '../../navigation'

const STORAGE_KEY = 'ventureadda:sidebar-collapsed'

/**
 * COLLAPSED BY DEFAULT, at every width, and it opens when you point at it.
 *
 * It used to open itself on anything wider than a laptop, which spent 16rem of
 * every screen on a list of eight words that never change. The rail is enough
 * to navigate by — the icons are the same eight, in the same order, every time
 * — and the words come back the moment the pointer arrives, so nothing is
 * actually hidden from anyone using a mouse.
 *
 * The button still pins it open, and that choice wins on every screen and
 * survives reloads: somebody who wants the labels permanently should not have
 * to keep hovering to read them.
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
    return true
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
function SidebarLink({
  item,
  collapsed,
  badge = 0,
}: {
  item: NavItem
  collapsed: boolean
  /** Unread count. Zero renders nothing at all, not an empty pill. */
  badge?: number
}) {
  const Icon = item.icon
  // Folded into the accessible name rather than left as a decorative dot: an
  // indicator a screen reader cannot perceive is not an indicator.
  const name = badge > 0 ? `${item.label}, ${badge} new` : item.label
  return (
    <NavLink
      to={item.to}
      // Every nav row is nameable by the walkthrough — see Walkthrough.tsx.
      // Derived from the path rather than listed separately so a new
      // destination cannot be added without one.
      data-tour={item.to.replace(/^\//, '') || 'browse'}
      end={item.to === '/'}
      aria-label={collapsed || badge > 0 ? name : undefined}
      title={collapsed ? name : undefined}
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
          <span className="relative shrink-0">
            <Icon
              size={16}
              aria-hidden="true"
              className={`transition-colors ${
                isActive ? 'text-brand-400' : 'text-white/40 group-hover:text-white/85'
              }`}
            />
            {/* Collapsed, the rail has no room for the count, so it becomes a
                dot on the icon. The number is still in the accessible name. */}
            {badge > 0 && collapsed && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-400 ring-2 ring-app"
              />
            )}
          </span>
          {!collapsed && (
            <>
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[14px] tracking-wider uppercase transition-colors ${
                  isActive
                    ? 'font-extrabold text-white'
                    : 'font-bold text-white/40 group-hover:text-white/85'
                }`}
              >
                {item.label}
              </span>
              {badge > 0 && (
                <span
                  aria-hidden="true"
                  className="shrink-0 rounded-full bg-brand-500/25 px-2 py-0.5 font-mono text-[12.5px] font-extrabold text-brand-300"
                >
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </>
          )}
        </>
      )}
    </NavLink>
  )
}

export default function Sidebar({
  isModerator = false,
  isSeller = false,
  isSignedIn = false,
  isOwner = false,
  unseenOrders = 0,
}: {
  isModerator?: boolean
  /** May list a venture, so the Orders entry is worth showing them. */
  isSeller?: boolean
  /** Has an account, so they have orders of their own to track. */
  isSignedIn?: boolean
  /** The site owner, who is the only person the design reference is for. */
  isOwner?: boolean
  unseenOrders?: number
}) {
  const [collapsed, setCollapsed] = useCollapsed()

  /**
   * Pointing at the rail, or having tabbed into it.
   *
   * State rather than a `group-hover:` variant on a dozen classes, because
   * expanding is not only a width: the labels come back, the header changes
   * shape, and the buttons stop announcing themselves through `aria-label`
   * because the text is on screen again. One boolean drives all of that
   * through the same code path the pinned-open sidebar already uses.
   *
   * Focus counts as hover so the keyboard is not left with a rail it can tab
   * through but not read.
   */
  const [pointed, setPointed] = useState(false)
  const expanded = !collapsed || pointed

  /**
   * Focus leaving the sidebar entirely, not merely moving between its rows.
   *
   * A blur fires on every arrow-key move down the list, and collapsing on each
   * of those would close the sidebar under the reader's own cursor.
   */
  const asideRef = useRef<HTMLElement>(null)
  const handleBlur = (event: React.FocusEvent) => {
    if (!asideRef.current?.contains(event.relatedTarget as Node | null)) setPointed(false)
  }

  const items = [
    ...PRIMARY_NAV,
    ...(isSignedIn ? BUYER_NAV : []),
    ...(isSeller ? SELLER_NAV : []),
    ...(isModerator ? MODERATOR_NAV : []),
    ...SETTINGS_NAV,
    ...(isOwner ? DEV_NAV : []),
  ]

  return (
    /*
      TWO BOXES, and the outer one is the reason this feels right rather than
      jumpy: it holds the collapsed width in the layout and never changes, so
      opening the sidebar draws over the page instead of shoving every card on
      it four inches sideways. The panel itself is the one that grows.

      Only from `md`, where the sidebar exists at all — below that the bottom
      bar is the navigation and this renders nothing.
    */
    <div
      className={`hidden shrink-0 self-start md:sticky md:top-6 md:block ${
        collapsed ? 'md:w-[4.25rem]' : 'md:w-64'
      }`}
    >
      <aside
        ref={asideRef}
        onMouseEnter={() => setPointed(true)}
        onMouseLeave={() => setPointed(false)}
        onFocusCapture={() => setPointed(true)}
        onBlurCapture={handleBlur}
        className={`liquid-glass-panel absolute top-0 left-0 z-30 flex flex-col rounded-[2rem] transition-[width,padding] duration-200 ${
          expanded ? 'w-64 p-4' : 'w-[4.25rem] p-2'
        } ${
          // Opaque only while it is drawn over the page: glass over a grid of
          // product photographs is not readable, and the rail at rest has
          // nothing behind it to fight with.
          collapsed && pointed
            ? 'bg-app/95 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.6)] backdrop-blur-2xl'
            : ''
        }`}
      >
      <div
        className={`flex items-center ${!expanded ? 'flex-col gap-2' : 'justify-between gap-2 px-2 pt-1 pb-3'}`}
      >
        {!expanded ? (
          // The mark alone, above the collapse control rather than beside it:
          // at rail width there is only room for one thing per row. Into the
          // directory, not out to the marketing page — the same destination
          // the mobile top bar's mark has.
          <Link to="/browse" aria-label="VentureAdda, browse ventures" className="pt-1">
            <LogoMark size={22} className="text-brand-400" />
          </Link>
        ) : (
          <div className="min-w-0">
            <p className="font-mono text-[12.5px] font-extrabold tracking-[0.28em] text-white/40 uppercase">
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

      <nav aria-label="Primary" className={`space-y-1.5 ${!expanded ? 'mt-1' : ''}`}>
        {items.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            collapsed={!expanded}
            badge={item.to === '/orders' ? unseenOrders : 0}
          />
        ))}
      </nav>

      {/* The one action the whole site exists to encourage, so it is a filled
          button below the nav rather than another row inside it.

          SHOWN TO EVERYONE, which it was not before. It used to be hidden from
          any signed-in account that could not list, on the reasoning that a
          button leading to a page which turns you away is worse than no
          button. That reasoning held only while /add was a dead end. It now
          offers the way through — add your Thapar address to the account you
          are already signed in with — and the person who needs that offer most
          is exactly the one the old rule hid it from. They had no route to it
          at all: no button here, none in the top bar, and no reason to guess
          the URL. */}
      <Link
        to="/add"
        data-tour="add-venture"
        aria-label={!expanded ? 'Add venture' : undefined}
        title={!expanded ? 'Add venture' : undefined}
        className={`mt-3 flex items-center justify-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-500/15 text-brand-300 transition duration-150 hover:bg-brand-500/25 active:scale-[0.97] ${
          collapsed ? 'p-2.5' : 'px-4 py-2.5'
        }`}
      >
        <Plus size={15} aria-hidden="true" className="shrink-0" />
        {expanded && (
          <span className="font-mono text-[14px] font-extrabold tracking-wider uppercase">
            Add venture
          </span>
        )}
      </Link>

      {expanded && (
        <p className="mt-6 px-4 pb-1 font-mono text-[12.5px] tracking-[0.18em] text-white/20 uppercase">
          No payments on site
        </p>
      )}
      </aside>
    </div>
  )
}
