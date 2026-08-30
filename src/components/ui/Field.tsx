import type { ReactNode } from 'react'

/**
 * Label, control, hint. The label is Ascend's field label from spec §4 — 9px
 * mono, extrabold, wide-tracked, uppercase, at 40% white.
 *
 * Promoted out of VentureForm, which had it as a local helper while nine other
 * places hand-rolled the same three classes. Wrapping the control rather than
 * owning it keeps Select, PhotoUploader and the text inputs on one label
 * treatment without forcing them to share an implementation.
 *
 * `htmlFor` is required rather than optional: a label that points at nothing
 * looks identical and is useless to a screen reader, and making it optional is
 * how that happens.
 */
export default function Field({
  id,
  label,
  hint,
  error,
  className = '',
  children,
}: {
  id: string
  label: string
  /** Quiet guidance under the control. Hidden while an error is showing. */
  hint?: string
  /** Replaces the hint, in red, and is announced. */
  error?: string
  className?: string
  children: ReactNode
}) {
  return (
    <div className={className}>
      <label
        htmlFor={id}
        className="mb-1.5 block font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/60 uppercase"
      >
        {label}
      </label>
      {children}
      {/* One slot, not two stacked messages. An error that appears below a hint
          leaves the hint contradicting it. */}
      {error ? (
        <p role="alert" className="mt-1.5 text-[15px] text-red-400">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1.5 text-[15px] text-white/55">{hint}</p>
      )}
    </div>
  )
}
