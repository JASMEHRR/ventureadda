import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronRight, PackageSearch, SearchX } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import ProductCard from '../components/ui/ProductCard'
import ProductRail from '../components/ProductRail'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'
import type { ItemMatch } from '../data/ventures'
import { venturePath } from '../data/ventures'
import { useAsyncData } from '../hooks/useAsyncData'
import { listProducts } from '../data/ventures'
import { kindOf, productTree, sectionOf, topPicks } from '../data/products'
import { cartQuantity, useCart } from '../data/cart'
import { categoryName } from '../data/types'

/**
 * EVERYTHING ON SALE, in sections.
 *
 * The directory answers "who sells things here". This answers "what is there",
 * which is the question somebody with no particular shop in mind actually has.
 *
 * IT USED TO BE ONE WALL OF IDENTICAL CARDS — three hundred of them, sorted
 * alphabetically, every one the same size and shape whether it was a ₹30
 * sticker you could add to a basket or a subscription you have to message
 * somebody about. Uniformity made it a database listing rather than a shop,
 * and no amount of loosening the grid fixed that, because the problem was that
 * every part of the page was doing the same job.
 *
 * SO THE PAGE IS SEGMENTS NOW, and each one does something different:
 *
 *   1. A rail of what is on the site — the left column on a desktop, a
 *      scrolling row of chips on a phone.
 *
 *      TWO LEVELS, because one was unreadable: "F1, Cars & Car Logos" is a
 *      section only the seller who wrote it can place, and under a heading
 *      that says Stickers it needs no explaining at all. See productTree, and
 *      Venture.kind for where the headings come from.
 *
 *      It is narrow until you point at it, then it widens and pushes the grid
 *      across. The headings are enough to aim by, and the full section names
 *      only matter once you are already reading them — so they do not need to
 *      cost the grid a column all day.
 *   2. A quick-buy rail across the top, only on the unfiltered view: a few
 *      priced things from different shops, in the wider tiles the home page
 *      uses. It is a shop window, not a search result.
 *   3. The grid, which holds only what can actually be bought: priced, in
 *      stock, with an Add button that works.
 *   4. An "ask the seller" list underneath, in one line per item. These have no
 *      price by the seller's own choice, so they cannot go in a basket — a full
 *      card with a dead corner where the button belongs promises something the
 *      item cannot do. A line with the shop's name and a link to it is the
 *      honest shape for them, and it is what lets the grid above be all
 *      buyable.
 *
 * Filters live in the URL, same as Browse: the top bar's category picker
 * writes `?category=`, search writes `?q=`, and the controls here write
 * `?section=`, `?sort=` and `?stock=`. A filtered page is a link somebody can
 * paste into the group chat, which is where this site's traffic comes from.
 */
type SortKey = 'name' | 'cheap' | 'dear' | 'asked' | 'venture'

const SORT_OPTIONS: SelectOption<SortKey>[] = [
  { value: 'name', label: 'A to Z' },
  { value: 'cheap', label: 'Cheapest first' },
  { value: 'dear', label: 'Dearest first' },
  { value: 'asked', label: 'Most asked about' },
  { value: 'venture', label: 'Grouped by shop' },
]

const SORTS: SortKey[] = ['name', 'cheap', 'dear', 'asked', 'venture']

function priceOf(value: number | undefined): number {
  return typeof value === 'number' ? value : Infinity
}

/** One line for something that has no price. See the note at the top. */
function AskRow({ match: { item, venture } }: { match: ItemMatch }) {
  return (
    <Link
      to={venturePath(venture)}
      className="flex items-baseline justify-between gap-4 rounded-xl px-3 py-2.5 transition duration-150 hover:bg-white/[0.05]"
    >
      <span className="min-w-0 flex-1 truncate text-[16px] text-white/85">{item.name}</span>
      <span className="shrink-0 font-mono text-[12.5px] tracking-wider text-white/55 uppercase">
        {venture.name}
      </span>
    </Link>
  )
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const categoryId = searchParams.get('category')
  const section = searchParams.get('section')
  const kind = searchParams.get('kind')
  const sortParam = searchParams.get('sort')
  const sort: SortKey = SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'name'
  const hideSoldOut = searchParams.get('stock') === 'in'

  const setParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams)
    // A default is absent rather than spelled out, so the plain /products link
    // somebody shares is not secretly carrying an ordering.
    if (value === null) params.delete(key)
    else params.set(key, value)
    setSearchParams(params, { replace: true })
  }

  const products = useAsyncData(
    () => listProducts({ query, categoryId: categoryId ?? undefined }),
    [query, categoryId],
  )

  // The cart is read here rather than inside each card: one subscription for
  // the page instead of one per product, on a page that can hold hundreds.
  const cart = useCart()

  const all = products.data ?? []

  /**
   * What the rail's selection leaves on the page.
   *
   * A section narrows to that section; a kind with no section narrows to the
   * whole heading, which is what tapping "Stickers" should give you rather
   * than making you pick one of its sections first.
   */
  const inSection = useMemo(
    () =>
      all.filter(
        (match) =>
          (!section || sectionOf(match) === section) &&
          (!kind || kindOf(match) === kind) &&
          (!hideSoldOut ||
            (match.item.inStock && (match.item.stock === undefined || match.item.stock > 0))),
      ),
    [all, section, kind, hideSoldOut],
  )

  /** Buyable and ask-only, split — the two halves are drawn differently. */
  const buyable = useMemo(() => {
    const list = inSection.filter(({ item }) => typeof item.price === 'number')
    const byName = (a: ItemMatch, b: ItemMatch) => a.item.name.localeCompare(b.item.name)

    // Every branch falls back to the name when its own key ties, so the grid
    // deals its cards the same way on every visit. Sorting a copy, because
    // `.sort` mutates and this array belongs to the fetch hook.
    if (sort === 'cheap') {
      return [...list].sort((a, b) => priceOf(a.item.price) - priceOf(b.item.price) || byName(a, b))
    }
    if (sort === 'dear') {
      return [...list].sort((a, b) => priceOf(b.item.price) - priceOf(a.item.price) || byName(a, b))
    }
    if (sort === 'asked') {
      return [...list].sort((a, b) => b.item.inquiryCount - a.item.inquiryCount || byName(a, b))
    }
    if (sort === 'venture') {
      return [...list].sort((a, b) => a.venture.name.localeCompare(b.venture.name) || byName(a, b))
    }
    return [...list].sort(byName)
  }, [inSection, sort])

  const askOnly = useMemo(
    () =>
      inSection
        .filter(({ item }) => typeof item.price !== 'number')
        .sort((a, b) => a.item.name.localeCompare(b.item.name)),
    [inSection],
  )

  // The window across the top, and only when nothing is narrowed down: once
  // somebody has picked a section or typed a word, a strip of unrelated
  // suggestions above their answer is in the way.
  const showWindow = !section && !kind && query.trim() === '' && !categoryId
  const picks = useMemo(() => (showWindow ? topPicks(all, 10) : []), [all, showWindow])

  const isFiltered =
    query.trim() !== '' || categoryId !== null || section !== null || kind !== null || hideSoldOut
  const heading =
    query.trim() !== ''
      ? `Matching “${query.trim()}”`
      : (section ?? kind ?? (categoryId ? categoryName(categoryId) : 'Everything on sale'))

  /**
   * The kinds, and the sections inside them.
   *
   * Built from everything that was read rather than from what is on screen, so
   * choosing a section does not empty the rail that chose it.
   */
  const tree = useMemo(() => productTree(all), [all])

  /**
   * Which group is open, and whether the rail is being pointed at.
   *
   * The open group follows the selection when there is one — arriving on a
   * shared link to a section must not show that section under a closed
   * heading — and is otherwise whatever was last clicked.
   */
  const activeKind = useMemo(() => {
    if (kind) return kind
    if (!section) return null
    return tree.find((group) => group.sections.some((entry) => entry.name === section))?.name ?? null
  }, [kind, section, tree])

  /**
   * THREE STATES, not two, and the third is the whole fix: `undefined` means
   * nobody has touched the rail yet, so it follows whatever the URL selected;
   * `null` means a person deliberately closed the group.
   *
   * With a plain `string | null` this could not close at all. Tapping an open
   * heading set it to null, and null fell straight back to the selection —
   * which the very same tap had just set to that heading. It reopened itself
   * every time.
   */
  const [openKind, setOpenKind] = useState<string | null | undefined>(undefined)
  const [pointed, setPointed] = useState(false)
  const shownOpen = openKind === undefined ? activeKind : openKind

  const select = (nextKind: string | null, nextSection: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (nextKind) params.set('kind', nextKind)
    else params.delete('kind')
    if (nextSection) params.set('section', nextSection)
    else params.delete('section')
    setSearchParams(params, { replace: true })
  }

  const rowClass = (active: boolean) =>
    // w-auto below `md`, where these are chips in a scrolling row: full width
    // there made the first one the entire row and pushed every other heading
    // off the side of the screen.
    `flex w-auto shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-left whitespace-nowrap transition duration-150 md:w-full active:scale-[0.98] ${
      active
        ? 'bg-brand-500/20 text-brand-200'
        : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
    }`

  return (
    <div className="space-y-4">
      {products.error && (
        <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-red-400">
          Could not load the products: {products.error.message}
        </p>
      )}

      {products.loading && !products.data && <LoadingLine label="Loading products…" />}

      {products.data && (
        <div className="flex flex-col gap-4 md:flex-row md:items-start">
          {/* SEGMENT ONE: what is on the site, in two levels.

              Widening pushes the grid across rather than covering it, same as
              the sidebar — a menu that opens over the thing you are reading
              hides the answer while you look for it. */}
          {tree.length > 0 && (
            <div
              className={`shrink-0 transition-[width] duration-200 md:sticky md:top-24 md:self-start ${
                pointed ? 'md:w-64' : 'md:w-48'
              }`}
            >
              <nav
                aria-label="Sections"
                onMouseEnter={() => setPointed(true)}
                onMouseLeave={() => setPointed(false)}
                onFocusCapture={() => setPointed(true)}
                className="liquid-glass-panel sticky top-20 z-20 rounded-2xl p-2 md:static md:w-full"
              >
                <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:max-h-[70vh] md:flex-col md:overflow-x-visible md:overflow-y-auto [&::-webkit-scrollbar]:hidden">
                  <button
                    type="button"
                    onClick={() => select(null, null)}
                    className={rowClass(!kind && !section)}
                  >
                    <span className="truncate text-[15.5px] font-bold md:flex-1">Everything</span>
                    <span className="font-mono text-[12.5px] text-white/55">{all.length}</span>
                  </button>

                  {tree.map((group) => {
                    const open = shownOpen === group.name
                    return (
                      <div key={group.name} className="shrink-0 md:contents">
                        <button
                          type="button"
                          onClick={() => {
                            // Tapping the heading you are already inside is
                            // the way back out: it closes the group and drops
                            // the filter, rather than leaving the page
                            // narrowed to a heading whose list is now shut.
                            if (open && kind === group.name && !section) {
                              setOpenKind(null)
                              select(null, null)
                              return
                            }
                            setOpenKind(group.name)
                            select(group.name, null)
                          }}
                          aria-expanded={group.sections.length > 0 ? open : undefined}
                          className={rowClass(kind === group.name && !section)}
                        >
                          {group.sections.length > 0 && (
                            <ChevronRight
                              size={13}
                              aria-hidden="true"
                              className={`shrink-0 text-white/55 transition-transform duration-150 ${
                                open ? 'rotate-90' : ''
                              }`}
                            />
                          )}
                          <span className="truncate text-[15.5px] font-bold md:flex-1">
                            {group.name}
                          </span>
                          <span className="font-mono text-[12.5px] text-white/55">
                            {group.count}
                          </span>
                        </button>

                        {/* The sections inside, on a desktop only: a chip row
                            that grew new chips in its middle would reorder
                            itself under the thumb that tapped it. On a phone
                            the headings are the rail. */}
                        {open &&
                          group.sections.map((entry) => (
                            <button
                              key={entry.name}
                              type="button"
                              onClick={() => select(group.name, entry.name)}
                              className={`${rowClass(section === entry.name)} hidden md:flex md:pl-8`}
                            >
                              <span className="flex-1 truncate text-[15px]">{entry.name}</span>
                              <span className="font-mono text-[12.5px] text-white/50">
                                {entry.count}
                              </span>
                            </button>
                          ))}
                      </div>
                    )
                  })}
                </div>
              </nav>
            </div>
          )}

          <div className="min-w-0 flex-1 space-y-8">
            {/* SEGMENT TWO: the shop window. Wide tiles, a few things from
                different shops, and gone the moment anything is narrowed. */}
            {picks.length > 0 && <ProductRail title="Ready to order" items={picks} />}

            {/* SEGMENT THREE: what can actually be bought. */}
            <section className="space-y-3">
              <header className="flex flex-wrap items-end justify-between gap-3 px-1">
                <div className="min-w-0">
                  <h2 className="truncate text-[20px] font-extrabold tracking-tight text-white">
                    {heading}
                  </h2>
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-white/55">
                    {buyable.length} to buy
                    {askOnly.length > 0 && ` · ${askOnly.length} on request`}
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => setParam('stock', hideSoldOut ? null : 'in')}
                    aria-pressed={hideSoldOut}
                    className={`shrink-0 rounded-full px-4 py-2 font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.98] ${
                      hideSoldOut
                        ? 'bg-brand-500/20 text-brand-300'
                        : 'liquid-glass-input text-white/55 hover:text-white'
                    }`}
                  >
                    In stock
                  </button>

                  {buyable.length > 1 && (
                    <Select
                      label="Sort by"
                      labelHidden
                      value={sort}
                      options={SORT_OPTIONS}
                      onChange={(next) => setParam('sort', next === 'name' ? null : next)}
                      className="w-44 shrink-0"
                      triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
                    />
                  )}
                </div>
              </header>

              {buyable.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 min-[1600px]:grid-cols-3">
                  {buyable.map((match) => (
                    <ProductCard
                      key={match.item.id}
                      match={match}
                      quantity={cartQuantity(cart, match.item.id)}
                      itemQuery={query.trim() || undefined}
                    />
                  ))}
                </div>
              ) : askOnly.length === 0 ? (
                // Two different nothings: a filtered page tells you to change
                // the filter, an empty campus has no filter to change.
                <EmptyState
                  icon={isFiltered ? SearchX : PackageSearch}
                  title={isFiltered ? 'Nothing matched that' : 'Nothing on sale yet'}
                >
                  {isFiltered
                    ? 'Try another word, another section, or show sold-out items too.'
                    : 'No approved venture has listed an item yet. Once one does, it shows up here.'}
                </EmptyState>
              ) : (
                <p className="px-1 text-[16px] text-white/60">
                  Nothing here has a fixed price. Everything in this section is quoted in the
                  conversation — the list below is all of it.
                </p>
              )}
            </section>

            {/* SEGMENT FOUR: the ones with no price, one line each. */}
            {askOnly.length > 0 && (
              <section className="space-y-2">
                <header className="px-1">
                  <h2 className="text-[20px] font-extrabold tracking-tight text-white">
                    Ask the seller
                  </h2>
                  <p className="mt-0.5 text-[15.5px] text-white/60">
                    {askOnly.length} {askOnly.length === 1 ? 'item is' : 'items are'} priced in the
                    conversation. Tap one to open the shop and message them.
                  </p>
                </header>

                <div className="liquid-glass-panel divide-y divide-white/5 rounded-2xl p-1.5">
                  {askOnly.map((match) => (
                    <AskRow key={match.item.id} match={match} />
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
