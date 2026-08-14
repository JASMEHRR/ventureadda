import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Search } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Button from '../ui/Button'
import Select from '../ui/Select'
import type { SelectOption } from '../ui/Select'
import { CATEGORIES } from '../../data/types'
import { useAuth } from '../../auth/AuthProvider'

/** Where the browse controls point. '/' is the landing page. */
const BROWSE_PATH = '/browse'

const CATEGORY_OPTIONS: SelectOption<string>[] = [
  { value: 'all', label: 'All categories' },
  ...CATEGORIES.map((category) => ({ value: category.id, label: category.name })),
]

/**
 * The browse controls, lifted out of the page and into the chrome.
 *
 * The split with Sidebar is the whole point: the sidebar is where you can go,
 * this is what you are looking at. Neither repeats the other, so there is only
 * ever one control for any given job.
 *
 * Search and category both live in the URL rather than in local state. They
 * have to: the controls are in the shell and the results are in the page, and
 * the URL is the one piece of state both already share. It also makes a
 * filtered directory a link someone can paste into the group chat, which is
 * where every visitor to this site is coming from anyway.
 */
export default function TopBar({
  user,
}: {
  /** Null while signed out, or before the profile has loaded. */
  user: { username: string } | null
}) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  // Signed in on a non-Thapar address: listing is not available to them, so
  // the button goes rather than leading to a page that turns them away.
  const { status, canPost } = useAuth()
  const showAddVenture = status !== 'ready' || canPost
  const [searchParams, setSearchParams] = useSearchParams()

  const category = searchParams.get('category') ?? 'all'
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
      // Searching from a venture page searches the directory. Doing this on
      // typing rather than on focus matters: navigating the moment the field is
      // focused would throw away the page someone had merely clicked into.
      if (pathname === BROWSE_PATH) {
        // replace, so a search does not stack one history entry per keystroke
        // for the back button to walk through.
        setSearchParams(params, { replace: true })
      } else {
        navigate({ pathname: BROWSE_PATH, search: params.toString() })
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft, urlQuery, pathname, navigate, searchParams, setSearchParams])

  const setCategory = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === 'all') params.delete('category')
    else params.set('category', value)
    navigate({ pathname: BROWSE_PATH, search: params.toString() })
  }

  return (
    <header className="liquid-glass-panel flex flex-wrap items-center gap-2 rounded-[1.5rem] px-3 py-2.5 sm:gap-3 sm:px-4 sm:py-3">
      {/* Wordmark only below `md`, where the sidebar that carries it is hidden.
          On desktop it would be on screen twice. */}
      <Link
        to={BROWSE_PATH}
        className="shrink-0 px-1 text-[17px] font-extrabold tracking-tight text-white md:hidden"
      >
        VentureAdda
      </Link>

      {/* Hidden below `sm`. At 390px the wordmark, All, the category select and
          the account button do not fit on one line, and this is the one of the
          four that is already reachable another way — the bottom bar's Browse
          goes to the same unfiltered route. */}
      <Button
        variant="secondary"
        to={BROWSE_PATH}
        className="hidden shrink-0 font-mono sm:inline-flex"
        title="Clear filters and show everything"
      >
        All
      </Button>

      <Select
        label="Category"
        labelHidden
        value={category}
        options={CATEGORY_OPTIONS}
        onChange={setCategory}
        className="w-40 shrink-0 sm:w-48"
        triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[11px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
      />

      {/* The primary action on a directory, so it gets the room that is left. */}
      <div className="relative order-last w-full min-w-40 flex-1 sm:order-none sm:w-auto">
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-white/30"
        />
        <input
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Brownies, earrings, embroidery…"
          aria-label="Search ventures"
          className="liquid-glass-input w-full rounded-full py-2 pr-4 pl-10 text-[13px] text-white placeholder-white/30"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {showAddVenture && (
          <Button to="/add" className="hidden sm:inline-flex">
            <Plus size={13} aria-hidden="true" />
            Add venture
          </Button>
        )}

        {user ? (
          <Link
            to="/profile"
            className="rounded-full transition duration-150 active:scale-[0.94]"
            aria-label={`Profile, signed in as ${user.username}`}
          >
            <Avatar name={user.username} />
          </Link>
        ) : (
          <Button variant="secondary" to="/signin">
            Sign in
          </Button>
        )}
      </div>
    </header>
  )
}
