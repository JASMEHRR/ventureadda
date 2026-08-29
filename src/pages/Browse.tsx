import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, SearchX, Store } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import VentureCard from '../components/ui/VentureCard'
import LoadingLine from '../components/ui/LoadingLine'
import { useAsyncData } from '../hooks/useAsyncData'
import { listCategories, listVentures, searchMenuItems } from '../data/ventures'
import ProductCard from '../components/ui/ProductCard'
import { cartQuantity, useCart } from '../data/cart'
import { listRatingSummaries } from '../data/reviews'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'

/**
 * How the directory is ordered.
 *
 * IT USED TO BE SECTIONED BY CATEGORY, one heading per category with its
 * ventures underneath. That reads well at forty listings and badly at four:
 * six headings each holding a single card, a column of cards down the left and
 * an empty screen to the right of every one of them. The directory is now one
 * grid that fills the row, and the grouping that was the layout becomes one of
 * the ways to sort it — still there for whoever wants it, no longer imposed on
 * a page that has three ventures on it.
 *
 * In the URL like every other filter here, so an ordering can be shared and
 * survives a reload.
 */
type SortKey = 'category' | 'name' | 'popular' | 'rated'

const SORT_OPTIONS: SelectOption<SortKey>[] = [
  { value: 'category', label: 'By category' },
  { value: 'name', label: 'A to Z' },
  { value: 'popular', label: 'Most opened' },
  { value: 'rated', label: 'Best rated' },
]

const SORTS: SortKey[] = ['category', 'name', 'popular', 'rated']

export default function Browse() {
  // Both filters live in the URL and are driven by the controls in TopBar. The
  // page reads them and does not own them: one control per job, and a filtered
  // directory stays a shareable link.
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const query = searchParams.get('q') ?? ''
  const sortParam = searchParams.get('sort')
  const sort: SortKey = SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'category'

  const setSort = (next: SortKey) => {
    const params = new URLSearchParams(searchParams)
    // The default is absent rather than spelled out, so the plain /browse
    // link a person shares is not secretly carrying an ordering.
    if (next === 'category') params.delete('sort')
    else params.set('sort', next)
    setSearchParams(params, { replace: true })
  }

  const categories = useAsyncData(() => listCategories(), [])
  // One read for every card's rating, rather than one per venture.
  const ratings = useAsyncData(() => listRatingSummaries(), [])
  const ventures = useAsyncData(
    () => listVentures({ query, categoryId: categoryId ?? undefined }),
    [query, categoryId],
  )

  /**
   * Products matching the search, across every seller.
   *
   * Its own read rather than something derived from `ventures`, because the
   * venture list deliberately returns ventures — a buyer who typed "brownie"
   * wants the brownie, and landing them on a shop page with forty items to
   * scan is the search only half working. Runs only when there is a term:
   * an unfiltered directory has nothing to match against.
   */
  // Named for what it holds rather than `items`, which the category loop below
  // already binds to a venture group's contents — one shadowing the other is a
  // bug waiting for whoever edits this next.
  const productMatches = useAsyncData(() => searchMenuItems(query), [query])

  // One subscription for the page rather than one per card. See Products.
  const cart = useCart()

  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ?? ''

  /**
   * One list, ordered by whichever sort is chosen.
   *
   * Every branch falls back to the name when its own key ties, which is what
   * keeps the page stable: Firestore's document order is arbitrary and differs
   * between reads, so an unresolved tie means the same directory deals its
   * cards differently on every visit. Sorting a copy, because `.sort` mutates
   * and this array belongs to the fetch hook.
   */
  const ordered = useMemo(() => {
    const list = [...(ventures.data ?? [])]
    const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

    if (sort === 'name') return list.sort(byName)

    if (sort === 'popular') {
      return list.sort((a, b) => b.clickCount - a.clickCount || byName(a, b))
    }

    if (sort === 'rated') {
      // A venture nobody has reviewed sorts as unrated rather than as zero
      // stars: no reviews is not a bad score, and burying a new seller under
      // the ones with a single five-star review would be the wrong reading.
      const score = (id: string) => ratings.data?.[id]?.average ?? -1
      return list.sort((a, b) => score(b.id) - score(a.id) || byName(a, b))
    }

    // 'category': the launch order the categories are declared in, so the page
    // reads the same way every time, with names inside each one.
    const order = new Map((categories.data ?? []).map((category, index) => [category.id, index]))
    return list.sort(
      (a, b) =>
        (order.get(a.categoryId) ?? 99) - (order.get(b.categoryId) ?? 99) || byName(a, b),
    )
  }, [ventures.data, categories.data, ratings.data, sort])

  const total = ventures.data?.length ?? 0
  const isFiltered = query.trim() !== '' || categoryId !== null

  return (
    <div className="space-y-4">
      {ventures.error && (
        <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-red-400">
          Could not load the listings: {ventures.error.message}
        </p>
      )}

      {ventures.loading && !ventures.data && (
        <LoadingLine label="Loading ventures…" />
      )}

      {/* Two different nothings. "No results" tells you to change your search;
          an empty directory has no search to change, and saying otherwise
          sends people hunting for a filter that is not set. */}
      {ventures.data && total === 0 && (
        <EmptyState
          icon={isFiltered ? SearchX : Store}
          title={isFiltered ? 'Nothing matched that' : 'Nothing listed yet'}
          action={
            !isFiltered && (
              <Button to="/add">
                <Plus size={13} aria-hidden="true" />
                List yours
              </Button>
            )
          }
        >
          {isFiltered
            ? 'Try another word, or clear the filters to see everything.'
            : 'No one has listed a venture yet. If you sell something on campus, you can be the first.'}
        </EmptyState>
      )}

      {/* Above the ventures, because it is the more specific answer. Somebody
          who typed a product name has told you exactly what they want; the
          shops that sell it are the follow-up, not the headline. */}
      {query.trim() !== '' && (productMatches.data?.length ?? 0) > 0 && (
        <section className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              Items matching &ldquo;{query.trim()}&rdquo;
            </h2>
            <span className="font-mono text-[13px] font-bold text-white/30">
              {productMatches.data!.length} {productMatches.data!.length === 1 ? 'item' : 'items'}
            </span>
          </header>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 min-[1800px]:grid-cols-4">
            {productMatches.data!.map((match) => (
              <ProductCard
                key={match.item.id}
                match={match}
                quantity={cartQuantity(cart, match.item.id)}
                // Straight to the seller's page with the menu already filtered
                // to what was typed, so the item is on screen on arrival rather
                // than somewhere in a grid of forty.
                itemQuery={query.trim()}
              />
            ))}
          </div>

          {/* The same grid, the same card and the same stepper the products
              page uses: a result here is a product, and it behaved differently
              from one there for no reason other than that it was written
              twice. */}
        </section>
      )}

      {ordered.length > 0 && (
        <section className="space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-3 px-1">
            <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              {categoryId ? categoryName(categoryId) : 'Every venture'}
            </h2>

            <div className="flex items-center gap-3">
              <span className="font-mono text-[13px] font-bold text-white/30">
                {ordered.length} {ordered.length === 1 ? 'venture' : 'ventures'}
              </span>
              {/* Hidden until there is more than one card to order. A sort
                  control over a single venture is a control that cannot do
                  anything, on the exact page that already looked empty. */}
              {ordered.length > 1 && (
                <Select
                  label="Sort by"
                  labelHidden
                  dataTour="sort"
                  value={sort}
                  options={SORT_OPTIONS}
                  onChange={setSort}
                  className="w-40 shrink-0"
                  triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
                />
              )}
            </div>
          </header>

          {/* Column count follows the viewport rather than stopping at three.
              A card stays readable down to about 280px, so the grid keeps
              adding columns as the screen allows instead of stretching four
              cards across a 2560px monitor. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6">
            {ordered.map((venture, index) => (
              <VentureCard
                key={venture.id}
                // Only the first: the tour points at one card as an example of
                // all of them, and nine identical highlights is not a tour.
                dataTour={index === 0 ? 'venture-card' : undefined}
                venture={venture}
                categoryName={categoryName(venture.categoryId)}
                rating={ratings.data?.[venture.id]}
                index={index}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
