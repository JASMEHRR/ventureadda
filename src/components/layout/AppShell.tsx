import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'

/**
 * Page chrome titles. Kept separate from navigation.ts because a nav label and
 * a page title are different jobs — the sidebar wants "Browse", the header
 * wants "Browse ventures".
 */
const PAGE_META: Record<string, { eyebrow: string; title: string }> = {
  '/': { eyebrow: 'Directory', title: 'Browse ventures' },
  '/categories': { eyebrow: 'Directory', title: 'Categories' },
  '/chat': { eyebrow: 'Community', title: 'All Chat' },
  '/add': { eyebrow: 'Your venture', title: 'List a venture' },
  '/moderator': { eyebrow: 'Moderator', title: 'Review queue' },
  '/design': { eyebrow: 'Reference', title: 'Design system' },
  '/signin': { eyebrow: 'Account', title: 'Sign in' },
  '/profile': { eyebrow: 'Account', title: 'Your profile' },
}

function pageMeta(pathname: string) {
  if (PAGE_META[pathname]) return PAGE_META[pathname]
  if (pathname.startsWith('/venture/')) return { eyebrow: 'Venture', title: 'Venture' }
  return { eyebrow: 'VentureAdda', title: 'Not found' }
}

/**
 * The app shell: sidebar on the left from `md` up, a top bar and the routed
 * content in the right-hand column, and a fixed bottom bar below `md`.
 *
 * Everything floats. Real gaps between every surface with the backdrop showing
 * through, no flush edges and no full-bleed regions — that separation is what
 * makes the glass read as layered panes rather than one tinted sheet.
 *
 * `pb-24` below `md` is clearance for MobileNav, dropped at `md` where the bar
 * is hidden. No ancestor here sets transform, filter or isolation, which would
 * trap AtmosphereBackdrop's negative z-index and hide the backdrop entirely.
 */
export default function AppShell({ isModerator = false }: { isModerator?: boolean }) {
  const { pathname } = useLocation()
  const meta = pageMeta(pathname)

  return (
    <>
      <div className="mx-auto flex w-full max-w-7xl gap-3 p-3 pb-28 sm:p-4 md:gap-4 md:p-6 md:pb-6">
        <Sidebar isModerator={isModerator} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <TopBar eyebrow={meta.eyebrow} title={meta.title} user={null} />
          <main className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>

      <MobileNav isModerator={isModerator} />
    </>
  )
}
