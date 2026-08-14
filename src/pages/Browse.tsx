import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Plus, Search, SearchX, Store } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'
import TextField from '../components/ui/TextField'
import VentureCard from '../components/ui/VentureCard'
import LoadingLine from '../components/ui/LoadingLine'
import { useAsyncData } from '../hooks/useAsyncData'
import { listCategories, listVentures } from '../data/ventures'
import { listRatingSummaries } from '../data/reviews'

export default function Browse() {
  const [query, setQuery] = useState('')

  // Category lives in the URL so a filtered view can be shared, and so the
  // Categories page can link straight into it. Search stays local — putting
  // every keystroke in the URL is not worth the churn.
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryId = searchParams.get('category')

  const setCategoryId = (next: string | null) => {
    const params = new URLSearchParams(searchParams)
    if (next) params.set('category', next)
    else params.delete('category')
    // replace, so filtering does not stack up entries the back button has to
    // walk through one at a time.
    setSearchParams(params, { replace: true })
  }

  const categories = useAsyncData(() => listCategories(), [])
  // One read for every card's rating, rather than one per venture.
  const ratings = useAsyncData(() => listRatingSummaries(), [])
  const ventures = useAsyncData(
    () => listVentures({ query, categoryId: categoryId ?? undefined }),
    [query, categoryId],
  )

  const categoryOptions = useMemo<SelectOption<string>[]>(
    () => [
      { value: 'all', label: 'All categories' },
      ...(categories.data ?? []).map((category) => ({
        value: category.id,
        label: category.name,
      })),
    ],
    [categories.data],
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
      <section className="liquid-glass-panel space-y-4 rounded-3xl p-4 sm:p-5">
        <TextField
          id="venture-search"
          label="Search"
          type="search"
          icon={Search}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Brownies, earrings, embroidery…"
        />

        <Select
          label="Category"
          value={categoryId ?? 'all'}
          options={categoryOptions}
          onChange={(value) => setCategoryId(value === 'all' ? null : value)}
        />
      </section>

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
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
