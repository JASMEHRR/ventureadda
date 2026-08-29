import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PackageSearch, SearchX } from 'lucide-react'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import ProductCard from '../components/ui/ProductCard'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'
import type { ItemMatch } from '../data/ventures'
import { useAsyncData } from '../hooks/useAsyncData'
import { listProducts } from '../data/ventures'
import { cartQuantity, useCart } from '../data/cart'
import { categoryName } from '../data/types'

/**
 * EVERYTHING ON SALE, in one grid.
 *
 * The directory answers "who sells things here". This answers "what is there",
 * which is the question somebody with no particular shop in mind actually has
 * — and until now the only way to ask it was to open every venture in turn, or
 * to already know the word to type into the search box.
 *
 * Filters live in the URL, same as Browse: the category picker in the top bar
 * writes `?category=`, search writes `?q=`, and the two controls below write
 * their own. A filtered grid is a link somebody can paste into the group chat,
 * which is where this site's traffic comes from.
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

type Availability = 'all' | 'available'

const AVAILABILITY_OPTIONS: SelectOption<Availability>[] = [
  { value: 'all', label: 'Everything' },
  { value: 'available', label: 'In stock only' },
]

/**
 * An unpriced item sorts last whichever way the price sort points.
 *
 * "Ask the seller" is not cheap and it is not dear — it is a conversation, and
 * putting it at either end of a price sort makes the number next to everything
 * else mean less.
 */
function priceOf(value: number | undefined): number {
  return typeof value === 'number' ? value : Infinity
}

export default function Products() {
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const categoryId = searchParams.get('category')
  const sortParam = searchParams.get('sort')
  const sort: SortKey = SORTS.includes(sortParam as SortKey) ? (sortParam as SortKey) : 'name'
  const availability: Availability = searchParams.get('stock') === 'in' ? 'available' : 'all'

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
  // the page instead of one per product, on a grid that can hold hundreds.
  const cart = useCart()

  const shown = useMemo(() => {
    const list = (products.data ?? []).filter(
      ({ item }) =>
        availability === 'all' || (item.inStock && (item.stock === undefined || item.stock > 0)),
    )

    // Every branch falls back to the name when its own key ties, so the grid
    // deals its cards the same way on every visit. Sorting a copy, because
    // `.sort` mutates and this array belongs to the fetch hook.
    const byName = (a: ItemMatch, b: ItemMatch) => a.item.name.localeCompare(b.item.name)

    if (sort === 'cheap') {
      return [...list].sort(
        (a, b) => priceOf(a.item.price) - priceOf(b.item.price) || byName(a, b),
      )
    }
    if (sort === 'dear') {
      return [...list].sort((a, b) => {
        const left = priceOf(a.item.price)
        const right = priceOf(b.item.price)
        // Unpriced still sinks, so this cannot simply be reversed.
        if (left === Infinity || right === Infinity) return left - right || byName(a, b)
        return right - left || byName(a, b)
      })
    }
    if (sort === 'asked') {
      return [...list].sort((a, b) => b.item.inquiryCount - a.item.inquiryCount || byName(a, b))
    }
    if (sort === 'venture') {
      return [...list].sort((a, b) => a.venture.name.localeCompare(b.venture.name) || byName(a, b))
    }
    return [...list].sort(byName)
  }, [products.data, sort, availability])

  const isFiltered = query.trim() !== '' || categoryId !== null || availability === 'available'
  const sellers = new Set(shown.map(({ venture }) => venture.id)).size

  return (
    <div className="space-y-4">
      {products.error && (
        <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-red-400">
          Could not load the products: {products.error.message}
        </p>
      )}

      {products.loading && !products.data && <LoadingLine label="Loading products…" />}

      {products.data && (
        <section className="space-y-3">
          <header className="flex flex-wrap items-center justify-between gap-3 px-1">
            <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              {query.trim() !== ''
                ? `Matching “${query.trim()}”`
                : categoryId
                  ? categoryName(categoryId)
                  : 'Everything on sale'}
            </h2>

            <div className="flex flex-wrap items-center gap-3">
              <span className="font-mono text-[13px] font-bold text-white/30">
                {shown.length} {shown.length === 1 ? 'item' : 'items'}
                {sellers > 0 && ` · ${sellers} ${sellers === 1 ? 'shop' : 'shops'}`}
              </span>

              <Select
                label="Availability"
                labelHidden
                value={availability}
                options={AVAILABILITY_OPTIONS}
                onChange={(next) => setParam('stock', next === 'available' ? 'in' : null)}
                className="w-36 shrink-0"
                triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
              />

              <Select
                label="Sort by"
                labelHidden
                value={sort}
                options={SORT_OPTIONS}
                onChange={(next) => setParam('sort', next === 'name' ? null : next)}
                className="w-44 shrink-0"
                triggerClassName="liquid-glass-input flex w-full items-center justify-between gap-2 rounded-full px-4 py-2 text-left font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.99]"
              />
            </div>
          </header>

          {shown.length === 0 ? (
            // Two different nothings, same as Browse: a filtered page tells you
            // to change the filter, an empty campus has no filter to change.
            <EmptyState
              icon={isFiltered ? SearchX : PackageSearch}
              title={isFiltered ? 'Nothing matched that' : 'Nothing on sale yet'}
            >
              {isFiltered
                ? 'Try another word, another category, or show sold-out items too.'
                : 'No approved venture has listed an item yet. Once one does, it shows up here.'}
            </EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
              {shown.map((match) => (
                <ProductCard
                  key={match.item.id}
                  match={match}
                  quantity={cartQuantity(cart, match.item.id)}
                  itemQuery={query.trim() || undefined}
                />
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  )
}
