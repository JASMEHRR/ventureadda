import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, SearchX, Store } from 'lucide-react'
import { Link } from 'react-router-dom'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import VentureCard from '../components/ui/VentureCard'
import LoadingLine from '../components/ui/LoadingLine'
import { useAsyncData } from '../hooks/useAsyncData'
import { listCategories, listVentures, searchMenuItems } from '../data/ventures'
import VentureLogo from '../components/ui/VentureLogo'
import { displayUrl } from '../lib/cloudinary'
import { listRatingSummaries } from '../data/reviews'

export default function Browse() {
  // Both filters live in the URL and are driven by the controls in TopBar. The
  // page reads them and does not own them: one control per job, and a filtered
  // directory stays a shareable link.
  const [searchParams] = useSearchParams()
  const categoryId = searchParams.get('category')
  const query = searchParams.get('q') ?? ''

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

  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ?? ''

  // Group into category sections, in the launch order the categories define,
  // so the page reads the same way every time rather than by insertion order.
  const grouped = useMemo(() => {
    if (!ventures.data || !categories.data) return []
    return categories.data
      .map((category) => ({
        category,
        // Sorted by name, not left in Firestore's document order. That order
        // is effectively arbitrary and changes between reads, so the same
        // category could deal its cards differently on each visit. It also
        // makes the sequence within a category predictable, which is what
        // lets the seed photos be assigned so no two neighbours match.
        items: ventures
          .data!.filter((venture) => venture.categoryId === category.id)
          .sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .filter((group) => group.items.length > 0)
  }, [ventures.data, categories.data])

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

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {productMatches.data!.map(({ item, venture }) => {
              const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
              return (
                <Link
                  key={item.id}
                  // Straight to the seller's page with the menu already
                  // filtered to what was typed, so the item is on screen on
                  // arrival rather than somewhere in a grid of forty.
                  to={`/venture/${venture.id}?item=${encodeURIComponent(query.trim())}`}
                  className="liquid-glass-panel flex items-center gap-3 rounded-2xl p-3 transition duration-150 hover:bg-white/[0.06] active:scale-[0.99]"
                >
                  {item.photo ? (
                    <img
                      src={displayUrl(item.photo, 400)}
                      alt=""
                      loading="lazy"
                      className={`h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset ${
                        sellable ? '' : 'grayscale'
                      }`}
                    />
                  ) : (
                    <VentureLogo name={venture.name} logo={venture.logo} size={64} />
                  )}
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[16.5px] font-bold text-white">
                      {item.name}
                    </span>
                    <span className="block truncate font-mono text-[13px] tracking-wider text-white/35 uppercase">
                      {venture.name}
                    </span>
                    <span className="mt-1 flex items-baseline gap-2">
                      <span className="font-mono text-[15.5px] font-bold text-brand-400">
                        ₹{item.price}
                      </span>
                      {!sellable && (
                        <span className="font-mono text-[12.5px] font-bold tracking-wider text-red-300 uppercase">
                          Sold out
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {grouped.map(({ category, items }) => (
        <section key={category.id} className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              {category.name}
            </h2>
            <span className="font-mono text-[13px] font-bold text-white/30">
              {items.length} {items.length === 1 ? 'venture' : 'ventures'}
            </span>
          </header>
          {/* Column count follows the viewport rather than stopping at three.
              A card stays readable down to about 280px, so the grid keeps
              adding columns as the screen allows instead of stretching four
              cards across a 2560px monitor. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6">
            {items.map((venture, index) => (
              <VentureCard
                key={venture.id}
                venture={venture}
                categoryName={categoryName(venture.categoryId)}
                rating={ratings.data?.[venture.id]}
                index={index}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
