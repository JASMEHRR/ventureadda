import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, SearchX } from 'lucide-react'
import Select from '../components/ui/Select'
import type { SelectOption } from '../components/ui/Select'
import VentureCard from '../components/ui/VentureCard'
import { useAsyncData } from '../hooks/useAsyncData'
import { listCategories, listVentures } from '../data/ventures'

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

  return (
    <div className="space-y-4">
      <section className="liquid-glass-panel space-y-4 rounded-3xl p-4 sm:p-5">
        <div>
          <label
            htmlFor="venture-search"
            className="mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
          >
            Search
          </label>
          <div className="relative">
            <Search
              size={14}
              aria-hidden="true"
              className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-white/30"
            />
            <input
              id="venture-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Brownies, earrings, embroidery…"
              className="liquid-glass-input w-full rounded-xl py-2.5 pr-4 pl-10 text-[14px] text-white placeholder-white/30"
            />
          </div>
        </div>

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
        <p className="px-1 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          Loading ventures…
        </p>
      )}

      {ventures.data && total === 0 && (
        <div className="liquid-glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/35">
            <SearchX size={22} aria-hidden="true" />
          </span>
          <p className="mt-5 text-[17px] font-extrabold text-white">Nothing matches that</p>
          <p className="mt-2 max-w-sm text-[14px] text-white/45">
            Try a different word, or clear the category filter to see everything on campus.
          </p>
        </div>
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
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}
