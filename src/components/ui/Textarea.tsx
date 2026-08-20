import type { TextareaHTMLAttributes } from 'react'
import Field from './Field'

type TextareaProps = {
  id: string
  label: string
  hint?: string
  error?: string
  wrapperClassName?: string
} & Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'>

/**
 * Same recessed treatment as TextField, resizable vertically only — a textarea
 * that can be dragged wider breaks the column it sits in.
 */
export default function Textarea({
  id,
  label,
  hint,
  error,
  wrapperClassName,
  className = '',
  rows = 3,
  ...rest
}: TextareaProps) {
  return (
    <Field id={id} label={label} hint={hint} error={error} className={wrapperClassName}>
      <textarea
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={`liquid-glass-input w-full resize-y rounded-xl px-4 py-2.5 text-[15px] text-white placeholder-white/30 ${className}`}
        {...rest}
      />
    </Field>
  )
}
