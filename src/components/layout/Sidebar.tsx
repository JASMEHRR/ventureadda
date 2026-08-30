import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Plus } from 'lucide-react'
import { LogoMark } from '../ui/Logo'
import { useHoverIntent } from '../../hooks/useHoverIntent'
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
 * ONE LAYOUT AT BOTH WIDTHS, which is what stopped the panel twitching. The
 * row used to be centred with its own padding when collapsed and left-aligned
 * with different padding when open, so every icon jumped sideways at the
 * moment the panel changed size — eight small movements fighting the one big
 * one. Now the padding never changes and the icon never moves: the label sits
 * beside it always and is simply clipped by the panel's edge, so opening the
 * sidebar reveals text rather than rearranging the furniture.
 *
 * The label stays in the accessible tree at both widths, which also retires
 * the aria-label swap this used to need.
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
      aria-label={badge > 0 ? name : undefined}
      title={collapsed ? name : undefined}
      className={({ isActive }) =>
        `group flex items-center gap-2.5 rounded-2xl border px-2.5 py-2.5 transition duration-150 active:scale-[0.98] ${
          isActive
            ? 'border-white/20 bg-white/15 shadow-sm backdrop-blur-md'
            : 'border-transparent bg-white/[0.01] hover:border-white/10 hover:bg-white/[0.07]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          {/* A fixed 24px column, shared by every glyph in the panel — the
              nav icons, the mark above them and the plus below. They are
              different widths, so without one column they each centred on
              their own box and the rail read as a wobbling line rather than a
              column. See the header. */}
          <span className="relative flex w-6 shrink-0 justify-center">
            <Icon
              size={16}
              aria-hidden="true"
              className={`transition-colors ${
                isActive ? 'text-brand-400' : 'text-white/60 group-hover:text-white/85'
              }`}
            />
            {/* Collapsed, the rail has no room for the pill, so the count
                becomes a dot on the icon. The number is still in the
                accessible name either way. */}
            {badge > 0 && collapsed && (
              <span
                aria-hidden="true"
                className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-400 ring-2 ring-app"
              />
            )}
          </span>
          {/* Always rendered, never remounted: the panel's own edge hides it.
              Fading it as well as clipping it keeps the last letters from
              looking chopped off mid-slide. */}
          <span
            // Delayed on the way in so the text arrives in a panel that is
            // already most of the way open, rather than sliding along with it.
            className={`flex min-w-0 flex-1 items-center gap-2 transition-opacity duration-200 ${
              collapsed ? 'opacity-0' : 'opacity-100 delay-100'
            }`}
          >
            <span
              className={`min-w-0 flex-1 truncate font-mono text-[14px] tracking-wider whitespace-nowrap uppercase transition-colors ${
                isActive
                  ? 'font-extrabold text-white'
                  : 'font-bold text-white/60 group-hover:text-white/85'
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
          </span>
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
  const { active: pointed, handlers } = useHoverIntent()
  const expanded = !collapsed || pointed

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
      IT PUSHES THE PAGE ACROSS rather than opening over it, which is the
      behaviour that was asked for and is the honest one: nothing is ever
      hidden behind the menu, so there is no moment where a card you were
      reading is underneath something. The width lives on this box, in normal
      flow, and everything to the right of it moves.

      Only from `md`, where the sidebar exists at all — below that the bottom
      bar is the navigation and this renders nothing.
    */
    <div
      className={`hidden shrink-0 self-start transition-[width] duration-300 ease-out md:sticky md:top-6 md:block ${
        // 4.25rem is not a round number picked by eye: it is the panel's own
        // padding twice (2 x 0.75rem), the row's twice (2 x 0.625rem) and the
        // 1.5rem glyph column between them. Any other width puts every icon
        // off the panel's centre line.
        expanded ? 'md:w-64' : 'md:w-[4.25rem]'
      }`}
    >
      {/* p-3 at both widths, and overflow-hidden so the panel edge is what
          hides the labels. Padding that changed with the width moved every
          icon by 8px on the way past. */}
      <aside
        {...handlers}
        className="liquid-glass-panel flex w-full flex-col overflow-hidden rounded-[2rem] p-3"
      >
      {/* The mark holds the same spot at both widths and the wordmark grows
          out of it, rather than the header changing shape entirely — that
          swap was the largest single jump in the old panel. */}
      <div className="mb-3 flex items-center gap-2.5 px-2.5 pt-1">
        <Link
          to="/browse"
          aria-label="VentureAdda, browse ventures"
          className="flex w-6 shrink-0 justify-center"
          title={collapsed ? 'VentureAdda' : undefined}
        >
          <LogoMark size={22} className="text-brand-400" />
        </Link>

        {/* `expanded`, not `collapsed`. These read the pinned preference,
            which stays "collapsed" all the way through a hover — so opening
            the sidebar by pointing at it revealed the nav labels and left the
            wordmark and the Add venture button blank. */}
        <span
          className={`min-w-0 flex-1 transition-opacity duration-200 ${
            expanded ? 'opacity-100 delay-100' : 'opacity-0'
          }`}
        >
          <span className="block font-mono text-[12px] font-extrabold tracking-[0.28em] whitespace-nowrap text-white/60 uppercase">
            Thapar
          </span>
          {/* The wordmark only. Logo draws the mark as well, and the mark is
              already sitting in the column to the left of this — expanding the
              sidebar showed the V twice. */}
          <Link
            to="/browse"
            className="mt-0.5 block text-[21px] font-extrabold tracking-tight whitespace-nowrap text-white"
          >
            VentureAdda
          </Link>
        </span>

        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          aria-expanded={!collapsed}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/60 transition duration-200 hover:bg-white/10 hover:text-white active:scale-[0.94] ${
            expanded ? 'opacity-100 delay-100' : 'opacity-0'
          }`}
        >
          {collapsed ? (
            <PanelLeftOpen size={15} aria-hidden="true" />
          ) : (
            <PanelLeftClose size={15} aria-hidden="true" />
          )}
        </button>
      </div>

      <nav aria-label="Primary" className="space-y-1.5">
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
        className="mt-3 flex items-center gap-2.5 rounded-2xl border border-brand-500/30 bg-brand-500/15 px-2.5 py-2.5 text-brand-300 transition duration-150 hover:bg-brand-500/25 active:scale-[0.97]"
      >
        <span className="flex w-6 shrink-0 justify-center">
          <Plus size={15} aria-hidden="true" />
        </span>
        <span
          className={`font-mono text-[14px] font-extrabold tracking-wider whitespace-nowrap uppercase transition-opacity duration-200 ${
            expanded ? 'opacity-100 delay-100' : 'opacity-0'
          }`}
        >
          Add venture
        </span>
      </Link>

      <p
        className={`mt-6 px-2 pb-1 font-mono text-[12.5px] tracking-[0.18em] whitespace-nowrap text-white/50 uppercase transition-opacity duration-200 ${
          expanded ? 'opacity-100 delay-100' : 'opacity-0'
        }`}
      >
        No payments on site
      </p>
      </aside>
    </div>
  )
}
