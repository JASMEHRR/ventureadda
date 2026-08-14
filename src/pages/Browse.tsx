import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, SearchX, Store } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import VentureCard from '../components/ui/VentureCard'
import LoadingLine from '../components/ui/LoadingLine'
import { useAsyncData } from '../hooks/useAsyncData'
import { listCategories, listVentures } from '../data/ventures'
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

  const categoryName = (id: string) =>
    categories.data?.find((category) => category.id === id)?.name ?? ''

  // Group into category sections, in the launch order the categories define,
  // so the page reads the same way every time rather than by insertion order.
  const grouped = useMemo(() => {
    if (!ventures.data || !categories.data) return []
    return categories.data
      .map((category) => ({
        category,
        items: ventures.data!.filter((venture) => venture.categoryId === category.id),
      }))
      .filter((group) => group.items.length > 0)
  }, [ventures.data, categories.data])

  const total = ventures.data?.length ?? 0
  const isFiltered = query.trim() !== '' || categoryId !== null

  return (
    <div className="space-y-4">
      {ventures.error && (
        <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-red-400">
          Could not load ventures: {ventures.error.message}
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
          title={isFiltered ? 'Nothing matches that' : 'No ventures yet'}
          action={
            !isFiltered && (
              <Button to="/add">
                <Plus size={13} aria-hidden="true" />
                List your venture
              </Button>
            )
          }
        >
          {isFiltered
            ? 'Try a different word, or clear the category filter to see everything on campus.'
            : 'Nobody has listed anything yet. If you make or sell something, you could be first.'}
        </EmptyState>
      )}

      {grouped.map(({ category, items }) => (
        <section key={category.id} className="space-y-3">
          <header className="flex items-baseline justify-between gap-3 px-1">
            <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              {category.name}
            </h2>
            <span className="font-mono text-[10px] font-bold text-white/30">
              {items.length} {items.length === 1 ? 'venture' : 'ventures'}
            </span>
          </header>
          {/* Column count follows the viewport rather than stopping at three.
              A card stays readable down to about 280px, so the grid keeps
              adding columns as the screen allows instead of stretching four
              cards across a 2560px monitor. */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6">
            {items.map((venture) => (
              <VentureCard
                key={venture.id}
                venture={venture}
                categoryName={categoryName(venture.categoryId)}
                rating={ratings.data?.[venture.id]}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
