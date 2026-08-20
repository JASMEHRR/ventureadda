import { Check, X } from 'lucide-react'

/**
 * In stock / out of stock, as two halves of one control rather than a switch.
 *
 * A bare switch labelled "In stock" makes the off state something you infer
 * from the absence of a highlight, which on a form of thirty identical rows is
 * a mistake waiting to happen — and the mistake is invisible until a buyer
 * cannot order. Both states are written out, and only the active one is
 * coloured, so the answer is readable at a glance down the column.
 *
 * Implemented as a radiogroup rather than a checkbox: the two states are named
 * alternatives, and that is what a screen reader should hear.
 */
export default function StockToggle({
  value,
  onChange,
  label,
}: {
  value: boolean
  onChange: (next: boolean) => void
  /** Accessible name for the group, e.g. "Item 3 availability". */
  label: string
}) {
  const options = [
    { on: true, text: 'In stock', Icon: Check, active: 'bg-brand-500/20 text-brand-300' },
    { on: false, text: 'Sold out', Icon: X, active: 'bg-red-500/20 text-red-300' },
  ]

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="inline-flex shrink-0 rounded-xl border border-white/10 bg-white/[0.03] p-1"
    >
      {options.map(({ on, text, Icon, active }) => (
        <button
          key={text}
          type="button"
          role="radio"
          aria-checked={value === on}
          onClick={() => onChange(on)}
          className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-mono text-[13px] font-bold tracking-wider uppercase transition duration-150 active:scale-[0.96] ${
            value === on ? active : 'text-white/35 hover:text-white/70'
          }`}
        >
          <Icon size={11} aria-hidden="true" />
          {text}
        </button>
      ))}
    </div>
  )
}
