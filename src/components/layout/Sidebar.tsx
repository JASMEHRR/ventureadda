import { useEffect, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { PanelLeftClose, PanelLeftOpen, Plus, Search } from 'lucide-react'
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
                className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-brand-400 ring-2 ring-[#0a0d12]"
              />
            )}
          </span>
          {!collapsed && (
            <>
              <span
                className={`min-w-0 flex-1 truncate font-mono text-[11px] tracking-wider uppercase transition-colors ${
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
                  className="shrink-0 rounded-full bg-brand-500/25 px-2 py-0.5 font-mono text-[9px] font-extrabold text-brand-300"
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

/** Where the browse controls point. '/' is the landing page. */
const BROWSE_PATH = '/browse'

/**
 * The search field, moved here from the top bar.
 *
 * WHY IT MOVED. The top bar was carrying the wordmark, an All button, a
 * category select, search, Add venture, the cart and the account tile in one
 * row, and search — the widest control of the seven — was what made the row
 * fight for space at every width. The sidebar is a column with room to spare
 * and it is where a directory's filters belong; the top bar keeps only what
 * has to be reachable in a thumb's reach of the corner.
 *
 * The URL is still the state, exactly as before: the control is in the shell,
 * the results are in the page, and a filtered directory stays a link somebody
 * can paste into the group chat.
 */
function SidebarSearch({ collapsed }: { collapsed: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const urlQuery = searchParams.get('q') ?? ''

  // Typing is local and the URL follows on a debounce. Writing every keystroke
  // straight to the URL re-runs the Firestore read per character.
  const [draft, setDraft] = useState(urlQuery)

  // Keeps the field honest when the URL changes underneath it — the back
  // button, or a category link that clears the search.
  useEffect(() => setDraft(urlQuery), [urlQuery])

  useEffect(() => {
    if (draft === urlQuery) return
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (draft.trim()) params.set('q', draft)
      else params.delete('q')
      if (pathname === BROWSE_PATH) {
        // replace, so a search does not stack one history entry per keystroke
        // for the back button to walk through.
        setSearchParams(params, { replace: true })
      } else {
        // Searching from a venture page searches the directory.
        navigate({ pathname: BROWSE_PATH, search: params.toString() })
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft, urlQuery, pathname, navigate, searchParams, setSearchParams])

  // Collapsed to a rail, the field becomes the button that expands it — a
  // 40px-wide text input is not a search box, it is a decoration.
  if (collapsed) {
    return (
      <Link
        to={BROWSE_PATH}
        aria-label="Search ventures"
        title="Search ventures"
        className="flex items-center justify-center rounded-2xl border border-transparent bg-white/[0.04] p-2.5 text-white/45 transition duration-150 hover:bg-white/[0.09] hover:text-white active:scale-[0.94]"
      >
        <Search size={16} aria-hidden="true" />
      </Link>
    )
  }

  return (
    <div className="relative mb-3">
      <Search
        size={14}
        aria-hidden="true"
        className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-white/30"
      />
      <input
        type="search"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        placeholder="Brownies, earrings…"
        aria-label="Search ventures"
        className="liquid-glass-input w-full rounded-full py-2 pr-3 pl-9 text-[13px] text-white placeholder-white/30"
      />
    </div>
  )
}

export default function Sidebar({
  isModerator = false,
  isSeller = false,
  isSignedIn = false,
  isOwner = false,
  showAdd = false,
  unseenOrders = 0,
}: {
  isModerator?: boolean
  /** May list a venture, so the Orders entry is worth showing them. */
  isSeller?: boolean
  /**
   * Whether to offer the Add button at all.
   *
   * Deliberately NOT `canPost`. A signed-out visitor has no posting rights
   * yet and must still see this — it is how a student finds out they can list
   * something, and /add explains what is needed. Only a session that is ready
   * and known not to qualify has it hidden, which is the same rule the top bar
   * has always used.
   */
  showAdd?: boolean
  /** Has an account, so they have orders of their own to track. */
  isSignedIn?: boolean
  /** The site owner, who is the only person the design reference is for. */
  isOwner?: boolean
  unseenOrders?: number
}) {
  const [collapsed, setCollapsed] = useCollapsed()

  const items = [
    ...PRIMARY_NAV,
    ...(isSignedIn ? BUYER_NAV : []),
    ...(isSeller ? SELLER_NAV : []),
    ...(isModerator ? MODERATOR_NAV : []),
    ...SETTINGS_NAV,
    ...(isOwner ? DEV_NAV : []),
  ]

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

      <SidebarSearch collapsed={collapsed} />

      <nav aria-label="Primary" className={`space-y-1.5 ${collapsed ? 'mt-1' : ''}`}>
        {items.map((item) => (
          <SidebarLink
            key={item.to}
            item={item}
            collapsed={collapsed}
            badge={item.to === '/orders' ? unseenOrders : 0}
          />
        ))}
      </nav>

      {/* The one action the whole site exists to encourage, so it is a filled
          button below the nav rather than another row inside it. Hidden from
          accounts that cannot list — a button that leads to a page turning you
          away is worse than no button. */}
      {showAdd && (
        <Link
          to="/add"
          aria-label={collapsed ? 'Add venture' : undefined}
          title={collapsed ? 'Add venture' : undefined}
          className={`mt-3 flex items-center justify-center gap-2 rounded-2xl border border-brand-500/30 bg-brand-500/15 text-brand-300 transition duration-150 hover:bg-brand-500/25 active:scale-[0.97] ${
            collapsed ? 'p-2.5' : 'px-4 py-2.5'
          }`}
        >
          <Plus size={15} aria-hidden="true" className="shrink-0" />
          {!collapsed && (
            <span className="font-mono text-[11px] font-extrabold tracking-wider uppercase">
              Add venture
            </span>
          )}
        </Link>
      )}

      {!collapsed && (
        <p className="mt-6 px-4 pb-1 font-mono text-[9px] tracking-[0.18em] text-white/20 uppercase">
          No payments on site
        </p>
      )}
    </aside>
  )
}
