import { useId } from 'react'
import { Check } from 'lucide-react'

export type Choice<T extends string> = {
  value: T
  label: string
  /** One line under the label. This is where the consequence of the choice goes. */
  detail?: string
}

/**
 * A small set of named alternatives, each with its consequence written under
 * it. Not a Select: these are decisions a buyer makes once at checkout, where
 * the whole point is being able to compare the options without opening
 * anything, and a dropdown hides every option but the default.
 *
 * A real radiogroup rather than styled buttons, so arrow keys move between
 * options and the group is announced as one control with n choices.
 */
export default function ChoiceGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string
  value: T
  choices: Choice<T>[]
  onChange: (next: T) => void
}) {
  const labelId = useId()

  /**
   * Arrow keys wrap around the list, which is what the radiogroup pattern
   * expects. Only the checked option is in the tab order (`tabIndex` below),
   * so Tab leaves the group rather than walking through every option.
   */
  const move = (event: React.KeyboardEvent, index: number) => {
    const forward = event.key === 'ArrowDown' || event.key === 'ArrowRight'
    const back = event.key === 'ArrowUp' || event.key === 'ArrowLeft'
    if (!forward && !back) return
    event.preventDefault()
    const next = (index + (forward ? 1 : -1) + choices.length) % choices.length
    onChange(choices[next].value)
    // Focus follows selection in this pattern, so the next arrow press
    // continues from where the reader now is.
    event.currentTarget.parentElement
      ?.querySelectorAll<HTMLButtonElement>('[role="radio"]')
      [next]?.focus()
  }

  return (
    <div>
      <span
        id={labelId}
        className="mb-1.5 block font-mono text-[11px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
      >
        {label}
      </span>
      <div role="radiogroup" aria-labelledby={labelId} className="space-y-2">
        {choices.map((choice, index) => {
          const active = choice.value === value
          return (
            <button
              key={choice.value}
              type="button"
              role="radio"
              aria-checked={active}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(choice.value)}
              onKeyDown={(event) => move(event, index)}
              className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition duration-150 active:scale-[0.99] ${
                active
                  ? 'border-brand-400/50 bg-brand-500/15'
                  : 'border-white/10 bg-white/[0.03] hover:border-white/25 hover:bg-white/[0.06]'
              }`}
            >
              <span
                aria-hidden="true"
                className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border transition-colors ${
                  active ? 'border-brand-400 bg-brand-500/40' : 'border-white/25'
                }`}
              >
                {active && <Check size={10} className="text-brand-200" />}
              </span>
              <span className="min-w-0 flex-1">
                <span
                  className={`block text-[15px] font-bold ${active ? 'text-white' : 'text-white/75'}`}
                >
                  {choice.label}
                </span>
                {choice.detail && (
                  <span className="mt-0.5 block text-[14px] leading-relaxed text-white/45">
                    {choice.detail}
                  </span>
                )}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
