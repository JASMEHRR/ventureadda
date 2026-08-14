import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import MobileNav from './MobileNav'
import ChooseUsername from '../../pages/ChooseUsername'
import { useAuth } from '../../auth/AuthProvider'

/**
 * The page heading, now visually-hidden.
 *
 * The old top bar rendered this as a large title; the new one carries browse
 * controls instead, and a directory does not need "Browse ventures" written
 * above a grid of ventures. The heading still has to exist — a document with no
 * h1 gives a screen reader nothing to orient by — so it stays in the accessible
 * tree and leaves the screen.
 */
const PAGE_TITLES: Record<string, string> = {
  '/browse': 'Browse ventures',
  '/categories': 'Categories',
  '/chat': 'All Chat',
  '/add': 'List a venture',
  '/moderator': 'Review queue',
  '/design': 'Design system',
  '/signin': 'Sign in',
  '/profile': 'Your profile',
}

function pageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname]
  if (pathname.startsWith('/venture/')) return 'Venture'
  return 'Not found'
}

/**
 * The app shell: a collapsible sidebar on the left from `md` up, a top bar and
 * the routed content in the right-hand column, and a fixed bottom bar below
 * `md`.
 *
 * Everything floats. Real gaps between every surface with the backdrop showing
 * through, no flush edges and no full-bleed regions — that separation is what
 * makes the glass read as layered panes rather than one tinted sheet.
 *
 * No max-width. This used to cap at `max-w-7xl` (80rem), which on a 1568px
 * screen left ~160px of dead margin either side of a directory whose entire
 * job is showing photographs of things for sale. Width is now bounded by the
 * viewport and the page padding, and the venture grid spends it on more
 * columns. Long-form prose keeps its own cap, per page — a wide grid reads
 * fine, a 1400px paragraph does not.
 *
 * `pb-28` below `md` is clearance for MobileNav, dropped at `md` where the bar
 * is hidden. No ancestor here sets transform, filter or isolation, which would
 * trap AtmosphereBackdrop's negative z-index and hide the backdrop entirely.
 */
export default function AppShell() {
  const { pathname } = useLocation()
  const { profile, status } = useAuth()
  const isModerator = profile?.isModerator ?? false

  return (
    <>
      <div className="flex w-full gap-3 p-3 pb-28 sm:p-4 md:gap-4 md:p-6 md:pb-6">
        <Sidebar isModerator={isModerator} />

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <TopBar user={profile} />
          <main className="min-w-0 flex-1">
            <h1 className="sr-only">
              {status === 'needsUsername' ? 'Pick a username' : pageTitle(pathname)}
            </h1>
            {/* A signed-in account with no profile yet gets the username gate
                wherever it lands, including on a deep link. */}
            {status === 'needsUsername' ? <ChooseUsername /> : <Outlet />}
          </main>
        </div>
      </div>

      <MobileNav isModerator={isModerator} />
    </>
  )
}
