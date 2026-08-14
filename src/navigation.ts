import { LayoutGrid, MessageSquare, Palette, Shield, Store } from 'lucide-react'
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
 */
export const PRIMARY_NAV: NavItem[] = [
  // Browse still lives at '/'. The landing page moves it to '/browse', and this
  // is the one line that has to change with it.
  { to: '/', label: 'Browse', icon: Store },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/chat', label: 'All Chat', icon: MessageSquare },
]

/** Shown only to accounts flagged as moderators. */
export const MODERATOR_NAV: NavItem[] = [{ to: '/moderator', label: 'Moderate', icon: Shield }]

/** Kept reachable so the design system stays inspectable while building. */
export const DEV_NAV: NavItem[] = [
  { to: '/design', label: 'Design system', icon: Palette, desktopOnly: true },
]
