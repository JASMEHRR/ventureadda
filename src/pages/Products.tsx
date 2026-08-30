import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PackageSearch, SearchX } from 'lucide-react'
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
import { sectionOf, topPicks } from '../data/products'
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
 *   1. A section rail — the left column on a desktop, a scrolling row of chips
 *      on a phone. Three hundred items belong to a dozen sections, and picking
 *      the section you want beats scrolling past the eleven you do not.
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

/** The rail's first row: everything, with no section chosen. */
const ALL = '__all__'

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
      <span className="shrink-0 font-mono text-[12.5px] tracking-wider text-white/30 uppercase">
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
   * The rail's contents: every section in what was read, biggest first.
   *
   * Counted before the section filter is applied, or choosing a section would
   * empty the rail that chose it.
   */
  const sections = useMemo(() => {
    const counts = new Map<string, number>()
    for (const match of all) {
      const name = sectionOf(match)
      counts.set(name, (counts.get(name) ?? 0) + 1)
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  }, [all])

  const inSection = useMemo(
    () =>
      all.filter(
        (match) =>
          (!section || sectionOf(match) === section) &&
          (!hideSoldOut ||
            (match.item.inStock && (match.item.stock === undefined || match.item.stock > 0))),
      ),
    [all, section, hideSoldOut],
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
  const showWindow = !section && query.trim() === '' && !categoryId
  const picks = useMemo(() => (showWindow ? topPicks(all, 10) : []), [all, showWindow])

  const isFiltered = query.trim() !== '' || categoryId !== null || section !== null || hideSoldOut
  const heading =
    query.trim() !== ''
      ? `Matching “${query.trim()}”`
      : (section ?? (categoryId ? categoryName(categoryId) : 'Everything on sale'))

  const railRow = (name: string, label: string, count: number) => {
    const active = name === ALL ? section === null : section === name
    return (
      <button
        key={name}
        type="button"
        onClick={() => setParam('section', name === ALL ? null : name)}
        aria-current={active ? 'true' : undefined}
        className={`flex shrink-0 items-center justify-between gap-3 rounded-xl px-3.5 py-2.5 text-left transition duration-150 active:scale-[0.98] md:w-full ${
          active
            ? 'bg-brand-500/20 text-brand-200'
            : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
        }`}
      >
        <span className="truncate text-[15.5px] font-bold whitespace-nowrap">{label}</span>
        <span className="shrink-0 font-mono text-[12.5px] text-white/30">{count}</span>
      </button>
    )
  }

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
          {/* SEGMENT ONE: the sections.
              A column on a desktop, where there is room for a dozen names to
              be readable at once, and a scrolling row of the same rows on a
              phone, where there is not. Sticky in both, because the point of
              it is switching sections without scrolling back to the top. */}
          {sections.length > 1 && (
            <nav
              aria-label="Sections"
              className="liquid-glass-panel sticky top-20 z-20 shrink-0 rounded-2xl p-2 md:top-24 md:w-56"
            >
              <div className="flex gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] md:max-h-[70vh] md:flex-col md:overflow-x-visible md:overflow-y-auto [&::-webkit-scrollbar]:hidden">
                {railRow(ALL, 'Everything', all.length)}
                {sections.map(([name, count]) => railRow(name, name, count))}
              </div>
            </nav>
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
                  <p className="mt-0.5 font-mono text-[13px] font-bold text-white/30">
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
                <p className="px-1 text-[16px] text-white/45">
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
                  <p className="mt-0.5 text-[15.5px] text-white/40">
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
