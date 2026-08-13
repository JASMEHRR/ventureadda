import { LayoutGrid, MessageSquare, Palette, Shield, Store } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type NavItem = {
  to: string
  label: string
  icon: LucideIcon
  /** Sentence-case line shown under the title in the sidebar. */
  description: string
  /** Hidden from the mobile bar, which only has room for four. */
  desktopOnly?: boolean
}

/**
 * One source of truth for both nav surfaces. The sidebar and the mobile bar
 * render the same items very differently, but they must never disagree about
 * what exists — that is how a route ends up reachable on a laptop and
 * invisible on a phone.
 */
export const PRIMARY_NAV: NavItem[] = [
  {
    to: '/',
    label: 'Browse',
    icon: Store,
    description: 'Every venture on campus, newest first.',
  },
  {
    to: '/categories',
    label: 'Categories',
    icon: LayoutGrid,
    description: 'Food, fashion, art, services and more.',
  },
  {
    to: '/chat',
    label: 'All Chat',
    icon: MessageSquare,
    description: 'Bugs, requests and feedback about the site.',
  },
]

/** Shown only to accounts flagged as moderators. */
export const MODERATOR_NAV: NavItem[] = [
  {
    to: '/moderator',
    label: 'Moderate',
    icon: Shield,
    description: 'Approvals, listings, chat and categories.',
  },
]

/** Kept reachable so the design system stays inspectable while building. */
export const DEV_NAV: NavItem[] = [
  {
    to: '/design',
    label: 'Design system',
    icon: Palette,
    description: 'Tokens, glass, buttons and rows.',
    desktopOnly: true,
  },
]
