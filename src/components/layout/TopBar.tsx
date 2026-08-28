import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Moon, Plus, Search, ShoppingCart, Sun, UserRound, X } from 'lucide-react'
import Avatar from '../ui/Avatar'
import Logo from '../ui/Logo'
import Button from '../ui/Button'
import Select from '../ui/Select'
import type { SelectOption } from '../ui/Select'
import { CATEGORIES } from '../../data/types'
import { cartCount, useCart } from '../../data/cart'
import { pageTitle } from '../../navigation'
import { useShellSearch } from './useShellSearch'
import { useAuth } from '../../auth/AuthProvider'
import { resolveTheme, useAppearance } from '../../lib/appearance'

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
export default function TopBar() {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const { status, profile, user } = useAuth()

  /**
   * What the account button says, and whether there is one at all.
   *
   * Keyed on the session rather than on the profile. A signed-in account that
   * has not claimed a username has no profile document — showing it "Sign in"
   * sent it to /signin, which bounces a ready session to /browse, so there was
   * no route to the profile page and no way to sign out at all.
   *
   * The address is cut at the @ before it is shown or announced. The whole
   * thing would otherwise sit in the button's accessible name — read aloud, and
   * exposed on a shared campus machine — to label a tile showing one letter.
   */
  const account =
    profile?.username ?? (status === 'ready' ? (user?.email?.split('@')[0] ?? null) : null)

  /**
   * The cart lives in localStorage, so this is free — no read, no account
   * needed, and it survives a reload. Signed-out visitors get the button too:
   * the cart is where they find out what they picked, and the sign-in ask
   * belongs at Place order, not at Add.
   */
  const items = cartCount(useCart())
  const [searchParams] = useSearchParams()
  const category = searchParams.get('category') ?? 'all'

  // The same hook the sidebar's field uses, so the two never disagree about
  // what the box searches or where it writes.
  const { draft, setDraft, placeholder, label } = useShellSearch()

  /**
   * Day/night, one tap, in the chrome rather than only in Settings.
   *
   * Tapping always writes an explicit 'dark' or 'light' — never back to
   * 'auto' — because someone reaching for this button is overruling whatever
   * their phone decided, and a cycle that passed through 'auto' would land
   * them on the theme they just left. 'Follow my system' is still there in
   * Settings, which is the right place for a setting you choose once.
   */
  const [appearance, updateAppearance] = useAppearance()
  const dark = resolveTheme(appearance.theme) === 'dark'

  /**
   * Below `sm` the search field lives behind its own icon.
   *
   * It used to hold a whole line of the bar to itself at every width, which
   * put the phone header at 167px — a fifth of the screen, permanently, for a
   * control most visits never touch. From `sm` up there is room for it beside
   * everything else and it stays where it was.
   *
   * A live search can never be the hidden thing: `expanded` is the toggle OR a
   * non-empty box, so filtered results are never on screen with no visible
   * sign of what filtered them. That also settles what the X does — it clears
   * the search and collapses in one tap, which is the same action from the
   * reader's side ("stop searching") rather than two.
   */
  const [searchOpen, setSearchOpen] = useState(false)
  const expanded = searchOpen || draft !== ''
  const searchRef = useRef<HTMLInputElement>(null)

  // Opening a field nobody can type in is a tap that did nothing. Only on the
  // way open, so re-renders while typing do not fight the caret.
  useEffect(() => {
    if (searchOpen) searchRef.current?.focus()
  }, [searchOpen])

  const setCategory = (value: string) => {
    const params = new URLSearchParams(searchParams)
    if (value === 'all') params.delete('category')
    else params.set('category', value)
    navigate({ pathname: BROWSE_PATH, search: params.toString() })
  }

  return (
    /*
      STICKY, and opaque enough to survive it.
      The bar carries search, the category filter and the cart — the three
      controls somebody reaches for part-way down a long menu — so scrolling
      them off screen meant scrolling back up to use any of them. `top-3` and
      `md:top-6` match the shell's own padding, so it keeps floating with the
      backdrop visible around it rather than snapping flush to the edge.

      The tint under the glass is not decoration. Glass takes its contrast from
      what is behind it, and what passes behind this while scrolling is a grid
      of product photographs; with nothing at all under it the row became
      unreadable over a white-background sticker every time one slid under it.

      It used to be a near-solid #0a0d12 at 85%, which fixed that by giving up
      on being glass — the bar was a dark slab with a blur it no longer needed.
      A 40% wash of the app colour plus a heavier blur is the version that
      still reads through: the photographs move underneath as smeared colour
      rather than as detail, which is enough separation for text and keeps the
      bar part of the same material as everything below it. `bg-app` rather
      than a hex, so the tint turns over with the theme instead of staying
      midnight blue on a white page.
    */
    <header className="liquid-glass-panel sticky top-3 z-40 flex flex-wrap items-center gap-2 rounded-[1.5rem] bg-app/40 px-3 py-2.5 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.45)] backdrop-blur-2xl sm:gap-3 sm:px-4 sm:py-3 md:top-6">
      {/* Wordmark only below `md`, where the sidebar that carries it is hidden.
          On desktop it would be on screen twice. */}
      {/* The mark without the wordmark, deliberately. The note above is about a
          row that already does not fit at 390px, and the word costs ~100px that
          the search field needs more. The name stays in the accessible tree. */}
      <Link to={BROWSE_PATH} className="shrink-0 px-1 md:hidden">
        <Logo markOnly size={21} />
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

      {/* What the top bar says now that search and Add have moved into the
          sidebar: where you are. From `md` up only, because below that the
          search field needs the row and the bottom bar already shows the
          current section. */}
      <span className="hidden min-w-0 truncate font-mono text-[14px] font-extrabold tracking-[0.18em] text-white/45 uppercase md:inline">
        {pageTitle(pathname)}
      </span>

      <Select
        label="Category"
        labelHidden
        dataTour="category"
        value={category}
        options={CATEGORY_OPTIONS}
        onChange={setCategory}
        // w-24 below `sm` is not a round number picked for looks: with the
        // wordmark, the search opener, the theme toggle, the cart and the
        // account tile beside it, anything wider is the 4px that pushes the
        // account group onto a second line of a 375px header. The trigger
        // truncates, and the full name of every category is in the menu.
        className="w-24 shrink-0 sm:w-48"
        triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[14px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
      />

      {/* The opener, below `sm` only. Above that the field itself is on the
          row and a button to reveal what is already visible is noise. */}
      <button
        type="button"
        onClick={() => {
          if (expanded) setDraft('')
          setSearchOpen(!expanded)
        }}
        aria-expanded={expanded}
        aria-controls="shell-search"
        aria-label={expanded ? 'Close search' : label}
        data-tour="search"
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/55 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94] sm:hidden"
      >
        {expanded ? <X size={17} aria-hidden="true" /> : <Search size={17} aria-hidden="true" />}
      </button>

      {/* EVERY WIDTH FROM `sm`. It lived in the sidebar for a while, which put
          it out of reach on the pages where people search most and hid it
          entirely on a phone. One box, always in the same corner, is worth
          more than a tidier column — it is only folded away on the width where
          a permanent line of the header is the more expensive of the two. */}
      <div
        id="shell-search"
        data-tour="search"
        className={`relative order-last w-full min-w-40 flex-1 sm:order-none sm:block sm:w-auto ${
          expanded ? '' : 'hidden'
        }`}
      >
        <Search
          size={14}
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-white/30"
        />
        <input
          ref={searchRef}
          type="search"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={placeholder}
          aria-label={label}
          className="liquid-glass-input w-full rounded-full py-2 pr-4 pl-10 text-[15.5px] text-white placeholder-white/30"
        />
      </div>

      <div className="ml-auto flex shrink-0 items-center gap-2">
        {/* Below `md` only, same reasoning as the search field: the sidebar
            carries this action from `md` up, and two Add buttons on one screen
            is one too many. */}
        {/* No longer gated on posting rights — see the note in Sidebar. The
            responsive classes are the only thing hiding it now: from `md` up
            the sidebar carries this action, and two Add buttons on one screen
            is one too many. */}
        <Button to="/add" className="hidden sm:inline-flex md:hidden">
          <Plus size={13} aria-hidden="true" />
          Add venture
        </Button>

        <button
          type="button"
          onClick={() => updateAppearance({ theme: dark ? 'light' : 'dark' })}
          aria-label={dark ? 'Switch to day mode' : 'Switch to night mode'}
          title={dark ? 'Day mode' : 'Night mode'}
          data-tour="theme"
          className="flex h-9 w-9 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/55 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94]"
        >
          {dark ? <Sun size={15} aria-hidden="true" /> : <Moon size={15} aria-hidden="true" />}
        </button>

        {/* Immediately left of the account tile, which is the corner every
            shopping site puts it in — and the count is in the accessible name
            rather than only in the pill, so it is not a decoration a screen
            reader misses. */}
        <Link
          to="/cart"
          aria-label={items === 0 ? 'Cart, empty' : `Cart, ${items} ${items === 1 ? 'item' : 'items'}`}
          data-tour="cart"
          className={`relative flex h-9 w-9 items-center justify-center rounded-full border transition duration-150 active:scale-[0.94] ${
            items > 0
              ? 'border-brand-500/40 bg-brand-500/15 text-brand-300 hover:bg-brand-500/25'
              : 'border-white/12 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
          }`}
        >
          <ShoppingCart size={15} aria-hidden="true" />
          {items > 0 && (
            <span
              aria-hidden="true"
              className="absolute -top-1 -right-1 min-w-4 rounded-full bg-brand-400 px-1 text-center font-mono text-[12.5px] font-extrabold text-app ring-2 ring-app"
            >
              {items > 99 ? '99+' : items}
            </span>
          )}
        </Link>

        {account ? (
          <Link
            to="/profile"
            className="rounded-full transition duration-150 active:scale-[0.94]"
            aria-label={`Profile, signed in as ${account}`}
            data-tour="account"
          >
            <Avatar name={account} style={profile?.avatar ?? 'initial'} />
          </Link>
        ) : (
          <>
            {/* Icon only below `sm`. The words cost ~102px on a row that has
                to hold the wordmark, the category filter, search, the theme
                toggle and the cart on a 375px screen — and this is the one
                item on it whose meaning survives being an icon, because a
                head-and-shoulders glyph in the account corner is the most
                established icon on the web. The label stays in the
                accessible name. */}
            <Link
              to="/signin"
              aria-label="Sign in"
              data-tour="account"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-white/12 bg-white/5 text-white/55 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.94] sm:hidden"
            >
              <UserRound size={17} aria-hidden="true" />
            </Link>
            {/* The wrapper carries the tour name rather than the Button:
                `data-*` on a component whose props are typed is a type error,
                and a span in a flex row costs nothing. */}
            <span data-tour="account" className="hidden sm:inline-flex">
              <Button variant="secondary" to="/signin">
                Sign in
              </Button>
            </span>
          </>
        )}
      </div>
    </header>
  )
}
