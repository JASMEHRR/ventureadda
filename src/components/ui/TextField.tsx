import type { InputHTMLAttributes } from 'react'
import type { LucideIcon } from 'lucide-react'
import Field from './Field'

/**
 * The recessed input from spec §4: .liquid-glass-input, inset shadow, no top
 * highlight, so it reads as carved in rather than sitting proud.
 *
 * There is deliberately no `outline-none` anywhere in here. Tailwind's
 * utilities layer outranks the base layer where the focus ring lives, so adding
 * it would silently delete the ring on the controls most likely to be reached
 * by keyboard.
 */
export const inputClass =
  'liquid-glass-input w-full rounded-xl px-4 py-2.5 text-[16px] text-white placeholder-white/30'

/** Leaves room for the glyph sitting inside the field. */
const withIcon = 'liquid-glass-input w-full rounded-xl py-2.5 pr-4 pl-10 text-[16px] text-white placeholder-white/30'

type TextFieldProps = {
  id: string
  label: string
  hint?: string
  error?: string
  /** Sits inside the field on the left, decorative — the label carries meaning. */
  icon?: LucideIcon
  /** Applied to the wrapper, not the input, so grid placement works. */
  wrapperClassName?: string
} & Omit<InputHTMLAttributes<HTMLInputElement>, 'id'>

export default function TextField({
  id,
  label,
  hint,
  error,
  icon: Icon,
  wrapperClassName,
  className = '',
  ...rest
}: TextFieldProps) {
  const input = (
    <input
      id={id}
      aria-invalid={error ? true : undefined}
      className={`${Icon ? withIcon : inputClass} ${className}`}
      {...rest}
    />
  )

  return (
    <Field id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      {Icon ? (
        <div className="relative">
          <Icon
            size={14}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-white/30"
          />
          {input}
        </div>
      ) : (
        input
      )}
    </Field>
  )
}
