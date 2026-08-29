import { createContext, useContext, useEffect, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom'

/**
 * The one search box, which searches different things depending on where you
 * are.
 *
 * On the directory it filters ventures. With a venture open it filters that
 * seller's own menu instead — the box that is already under your thumb is the
 * one you reach for when you want the beanie on a page showing forty items,
 * and sending you back out to the directory for it was the wrong answer.
 *
 * TWO SEPARATE URL PARAMETERS, and that is the important decision here.
 * Directory search is `?q=`, menu search is `?item=`. Sharing one parameter
 * meant a menu search leaked into the directory the moment you tapped back —
 * you would land on browse filtered by "beanie" having never asked for that.
 * Two names cannot collide, and each page reads only its own.
 *
 * The state stays in the URL for the same reason it always has: the control is
 * in the shell, the results are in the page, and the URL is the one thing both
 * already share. A filtered menu is also a link somebody can paste into the
 * group chat, which is where this site's traffic comes from.
 */

export type SearchScope = {
  /** The open venture, when there is one. Null on every other page. */
  ventureName: string
} | null

type ScopeValue = {
  scope: SearchScope
  setScope: (scope: SearchScope) => void
}

export const SearchScopeContext = createContext<ScopeValue>({
  scope: null,
  setScope: () => {},
})

/**
 * Called by VentureDetail to say what is open.
 *
 * A context rather than parsing the venture id out of the pathname in the
 * shell: the shell would then have to fetch the venture to know its name, which
 * is a second read of a document the page already has.
 */
export function useDeclareSearchScope(ventureName: string | null): void {
  const { setScope } = useContext(SearchScopeContext)
  useEffect(() => {
    if (!ventureName) return
    setScope({ ventureName })
    return () => setScope(null)
  }, [ventureName, setScope])
}

/** What the menu on a venture page is being filtered by. */
export function useMenuQuery(): string {
  const [searchParams] = useSearchParams()
  return searchParams.get('item') ?? ''
}

const BROWSE_PATH = '/browse'

/**
 * Pages that read `?q=` themselves.
 *
 * Typing on one of these filters where you are standing; typing anywhere else
 * takes you to the directory. Products was the case that made this a list:
 * without it, searching from the products grid threw you out to Browse and
 * showed you shops instead of the thing you had just typed.
 */
const SEARCHABLE_PATHS = [BROWSE_PATH, '/products']

/**
 * Everything the two search fields need, so they stay identical.
 *
 * They are rendered at different breakpoints — the sidebar from `md` up, the
 * top bar below it — and were separate copies of this logic, which is exactly
 * how the two of them would have drifted apart on the next change.
 */
export function useShellSearch(): {
  draft: string
  setDraft: (value: string) => void
  placeholder: string
  label: string
} {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const [searchParams, setSearchParams] = useSearchParams()
  const { scope } = useContext(SearchScopeContext)

  const inMenu = scope !== null
  const param = inMenu ? 'item' : 'q'
  const urlQuery = searchParams.get(param) ?? ''

  // Typing is local and the URL follows on a debounce. Writing every keystroke
  // straight to the URL re-runs the Firestore read per character on browse.
  const [draft, setDraft] = useState(urlQuery)

  // Keeps the field honest when the URL changes underneath it — the back
  // button, a category link that clears the search, or arriving on a venture
  // page where the box now means something else entirely.
  useEffect(() => setDraft(urlQuery), [urlQuery])

  useEffect(() => {
    if (draft === urlQuery) return
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams)
      if (draft.trim()) params.set(param, draft)
      else params.delete(param)

      // Menu search never navigates: the whole point is that you stay on the
      // venture you are reading. Directory search from a venture page does
      // navigate, but that case cannot arise while a scope is set.
      if (inMenu || SEARCHABLE_PATHS.includes(pathname)) {
        // replace, so a search does not stack one history entry per keystroke
        // for the back button to walk through.
        setSearchParams(params, { replace: true })
      } else {
        navigate({ pathname: BROWSE_PATH, search: params.toString() })
      }
    }, 250)
    return () => window.clearTimeout(timer)
  }, [draft, urlQuery, param, inMenu, pathname, navigate, searchParams, setSearchParams])

  return {
    draft,
    setDraft,
    placeholder: inMenu ? `Search ${scope.ventureName}…` : 'Brownies, earrings…',
    label: inMenu ? `Search ${scope.ventureName}'s menu` : 'Search ventures',
  }
}
