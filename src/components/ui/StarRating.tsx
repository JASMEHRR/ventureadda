import { Star } from 'lucide-react'

/** Read-only rating display. */
export function StarDisplay({
  value,
  size = 13,
  className = '',
}: {
  value: number
  size?: number
  className?: string
}) {
  const rounded = Math.round(value)
  return (
    <span className={`flex items-center gap-0.5 ${className}`} aria-hidden="true">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= rounded ? 'text-brand-400' : 'text-white/15'}
          fill={star <= rounded ? 'currentColor' : 'none'}
        />
      ))}
    </span>
  )
}

/**
 * Rating input.
 *
 * A radiogroup of real radio inputs rather than five buttons: arrow keys move
 * between options for free, the choice is announced as "3 of 5", and it works
 * inside a form without any of it being hand-rolled.
 */
export function StarInput({
  value,
  onChange,
  name = 'rating',
}: {
  value: number
  onChange: (value: number) => void
  name?: string
}) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <label
          key={star}
          className="cursor-pointer rounded-lg p-1 transition duration-150 hover:scale-110 active:scale-95"
        >
          <input
            type="radio"
            name={name}
            value={star}
            checked={value === star}
            onChange={() => onChange(star)}
            className="sr-only"
          />
          <Star
            size={26}
            aria-hidden="true"
            className={star <= value ? 'text-brand-400' : 'text-white/20'}
            fill={star <= value ? 'currentColor' : 'none'}
          />
          <span className="sr-only">
            {star} {star === 1 ? 'star' : 'stars'}
          </span>
        </label>
      ))}
    </div>
  )
}
