import {
  ClipboardList,
  MessageSquare,
  Package,
  Palette,
  Shield,
  SlidersHorizontal,
  Store,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Hidden from the mobile bar, which only has room for four. */
  desktopOnly?: boolean
}

/**
 * One source of truth for every nav surface. The top bar, the mobile menu and
 * the bottom bar render these very differently, but they must never disagree
 * about what exists — that is how a route ends up reachable on a laptop and
 * invisible on a phone.
 *
 * Labels are single words on purpose. These used to carry a sentence of
 * description each ("Bugs, requests and feedback about the site"), which is
 * right for a dashboard someone opens every day and learns, and wrong for a
 * directory a stranger opens once from a WhatsApp link. A visitor scanning a
 * nav bar is not reading; they are looking for the word they already want.
 *
 * NO CATEGORIES ENTRY. There was one, pointing at a page of six tiles that
 * linked back into a filtered Browse. Browse already groups every venture
 * under its category heading and the top bar already has a category picker, so
 * the tab was a third route to a filter that was never more than one tap away
 * — and it cost a permanent slot in a phone bar that holds four things.
 */
export const PRIMARY_NAV: NavItem[] = [
  { to: '/browse', label: 'Browse', icon: Store },
  { to: '/chat', label: 'All Chat', icon: MessageSquare },
]

/**
 * The buyer's own orders. Shown to anyone signed in, seller or not — buying is
 * the one thing every account here can do.
 */
export const BUYER_NAV: NavItem[] = [{ to: '/my-orders', label: 'Your orders', icon: Package }]

/**
 * Shown only to accounts that may list a venture, and only on desktop.
 *
 * `desktopOnly` is doing real work here rather than expressing a preference:
 * the phone bar already holds the primary items plus the List button at 390px,
 * and more would shrink all of them. Sellers reach this from their profile on
 * a phone, which is also where the unread count is repeated.
 */
export const SELLER_NAV: NavItem[] = [
  { to: '/orders', label: 'Orders', icon: ClipboardList, desktopOnly: true },
  { to: '/my-ventures', label: 'Your ventures', icon: Store, desktopOnly: true },
]

/** Per-device preferences. Reachable from the profile page on a phone. */
export const SETTINGS_NAV: NavItem[] = [
  { to: '/settings', label: 'Settings', icon: SlidersHorizontal, desktopOnly: true },
]

/** Shown only to accounts flagged as moderators. */
export const MODERATOR_NAV: NavItem[] = [{ to: '/moderator', label: 'Moderate', icon: Shield }]

/**
 * The design-system reference. Owner only — it is a build-time tool, and every
 * other account seeing a "Design system" tab is being shown a room they have
 * no reason to enter. The route stays reachable by URL for whoever is working
 * on the app; it renders component samples and no data.
 */
export const DEV_NAV: NavItem[] = [
  { to: '/design', label: 'Design system', icon: Palette, desktopOnly: true },
]

/**
 * What each route is called, in one place.
 *
 * Used twice: as the visually-hidden <h1> in AppShell, which is what a screen
 * reader orients by, and as the visible label in the top bar. They were about
 * to drift apart the moment a route was added, which is the whole argument for
 * a shared map.
 */
const PAGE_TITLES: Record<string, string> = {
  '/browse': 'Browse ventures',
  '/chat': 'All Chat',
  '/add': 'List a venture',
  '/moderator': 'Review queue',
  '/design': 'Design system',
  '/signin': 'Sign in',
  '/profile': 'Your profile',
  '/settings': 'Settings',
  '/my-ventures': 'Your ventures',
  '/orders': 'Orders you have received',
  '/my-orders': 'Orders you have placed',
  '/cart': 'Your cart',
}

export function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/venture/')) return 'Venture'
  return 'Not found'
}
