import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { useAsyncData } from '../hooks/useAsyncData'
import { countVenturesByCategory, listCategories } from '../data/ventures'
import LoadingLine from '../components/ui/LoadingLine'

/**
 * The sub-navigation pattern: bold mono uppercase title over a sentence-case
 * description, with the count as quiet mono data on the right.
 */
const BLURBS: Record<string, string> = {
  food: 'Home bakers, midnight kitchens and snack runs.',
  fashion: 'Thrifted, upcycled and made-to-order pieces.',
  art: 'Prints, custom portraits and handmade gifts.',
  services: 'Repairs, tutoring, photography and design work.',
  tech: 'Accessories, refurbs and device help.',
  other: 'Everything that does not fit the boxes above.',
}

export default function Categories() {
  const categories = useAsyncData(() => listCategories(), [])
  const counts = useAsyncData(() => countVenturesByCategory(), [])

  if (categories.error || counts.error) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-red-400">
        Could not load categories: {(categories.error ?? counts.error)?.message}
      </p>
    )
  }

  if (!categories.data) {
    return (
      <LoadingLine label="Loading categories…" />
    )
  }

  return (
    <div className="liquid-glass-panel divide-y divide-white/8 rounded-3xl p-2">
      {categories.data.map((category) => {
        const count = counts.data?.[category.id] ?? 0
        return (
          <Link
            key={category.id}
            // Filters Browse rather than opening a separate page: one listing
            // surface, and the filtered view is a shareable URL.
            to={`/?category=${category.id}`}
            className="group flex w-full items-center gap-3.5 rounded-2xl px-3 py-4 text-left transition duration-150 hover:bg-white/[0.05] active:scale-[0.99]"
          >
            <span className="min-w-0 flex-1">
              <span className="block font-mono text-[12px] font-extrabold tracking-wider text-white uppercase">
                {category.name}
              </span>
              <span className="mt-1 block text-[13px] text-white/45">{BLURBS[category.id]}</span>
            </span>

            <span className="shrink-0 font-mono text-[11px] font-bold text-white/30">
              {count}
              <span className="sr-only"> ventures</span>
            </span>
            <ChevronRight
              size={16}
              aria-hidden="true"
              className="shrink-0 text-white/25 transition-colors group-hover:text-white"
            />
          </Link>
        )
      })}
    </div>
  )
}
