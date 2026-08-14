import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent as ReactKeyboardEvent } from 'react'
import { createPortal } from 'react-dom'
import { motion, useReducedMotion } from 'motion/react'
import { Check, ChevronDown } from 'lucide-react'

export type SelectOption<T extends string> = { value: T; label: string }

type SelectProps<T extends string> = {
  /** Visible mono eyebrow, and the accessible name of the control. */
  label: string
  /** Keeps the label as the accessible name but takes it off screen. */
  labelHidden?: boolean
  value: T | null
  options: SelectOption<T>[]
  onChange: (value: T) => void
  placeholder?: string
  className?: string
  /** Overrides the trigger's own classes, e.g. to size it for the top bar. */
  triggerClassName?: string
}

/** Typeahead buffer lifetime, matching the usual native select behaviour. */
const TYPEAHEAD_RESET_MS = 500

/** Gap between the trigger and the popup, and the popup's clearance from the viewport edge. */
const POPUP_GAP = 8
const POPUP_MAX_HEIGHT = 256
const VIEWPORT_MARGIN = 16

type TriggerRect = { top: number; left: number; width: number; bottom: number }

/**
 * Places the popup below the trigger, or flips it above when there is more
 * room up there. Height is capped to whatever the chosen side actually has,
 * so a select near the bottom of a phone screen still scrolls rather than
 * running off the viewport.
 */
function popupPosition(rect: TriggerRect): CSSProperties {
  const spaceBelow = window.innerHeight - rect.bottom - POPUP_GAP - VIEWPORT_MARGIN
  const spaceAbove = rect.top - POPUP_GAP - VIEWPORT_MARGIN
  const flipUp = spaceBelow < Math.min(POPUP_MAX_HEIGHT, spaceAbove)
  const available = flipUp ? spaceAbove : spaceBelow

  return {
    left: rect.left,
    width: rect.width,
    maxHeight: Math.max(96, Math.min(POPUP_MAX_HEIGHT, available)),
    ...(flipUp
      ? { bottom: window.innerHeight - rect.top + POPUP_GAP, transformOrigin: 'bottom center' }
      : { top: rect.bottom + POPUP_GAP, transformOrigin: 'top center' }),
  }
}

/**
 * Glass dropdown. Ascend has no reusable Select — one bespoke instance only —
 * so this is designed here in its language: a recessed .liquid-glass-input
 * trigger and a floating .liquid-glass-panel popup, cyan for the chosen row.
 *
 * Implements the ARIA select-only combobox pattern. Focus never leaves the
 * trigger; the active option is tracked with aria-activedescendant, which
 * avoids roving tabindex entirely.
 *
 * The popup is portalled to document.body and positioned with fixed
 * coordinates. That is not optional in this design system: `backdrop-filter`
 * creates a stacking context, so every .liquid-glass-panel is one — and form
 * fields live inside glass panels. An in-place absolute popup has its z-index
 * scoped to the enclosing panel and is painted over by the next panel down
 * the page, no matter how high the z-index goes.
 *
 * Fixed coordinates rather than absolute means no scroll-offset arithmetic;
 * the trade is that the rect must be re-measured while open, which the
 * capture-phase scroll listener below handles.
 */
export default function Select<T extends string>({
  label,
  labelHidden = false,
  value,
  options,
  onChange,
  placeholder = 'Select…',
  className = '',
  triggerClassName = 'liquid-glass-input flex w-full items-center justify-between gap-3 rounded-xl px-4 py-2.5 text-left text-[13px] font-bold transition duration-150 active:scale-[0.99]',
}: SelectProps<T>) {
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(-1)
  const [rect, setRect] = useState<TriggerRect | null>(null)
  const reduce = useReducedMotion()

  const wrapperRef = useRef<HTMLDivElement>(null)
  const popupRef = useRef<HTMLUListElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const optionRefs = useRef<Array<HTMLLIElement | null>>([])
  const typeahead = useRef('')
  const typeaheadTimer = useRef<number | null>(null)

  const baseId = useId()
  const labelId = `${baseId}-label`
  const comboId = `${baseId}-combo`
  const listboxId = `${baseId}-listbox`
  const optionId = (index: number) => `${baseId}-option-${index}`

  const selectedIndex = options.findIndex((option) => option.value === value)
  const selectedLabel = selectedIndex >= 0 ? options[selectedIndex].label : null

  const openAt = useCallback(
    (index: number) => {
      // Categories arrive from Firestore, so an empty list is a real state on
      // first paint. Refusing to open keeps every open-branch key handler from
      // having to defend against it, and stops aria-activedescendant pointing
      // at an option id that was never rendered.
      if (options.length === 0) return
      setActiveIndex(Math.min(Math.max(index, 0), options.length - 1))
      setOpen(true)
    },
    [options.length],
  )

  const close = useCallback((returnFocus = true) => {
    setOpen(false)
    setActiveIndex(-1)
    if (returnFocus) triggerRef.current?.focus()
  }, [])

  const commit = useCallback(
    (index: number) => {
      const option = options[index]
      if (!option) return
      onChange(option.value)
      close()
    },
    [options, onChange, close],
  )

  /**
   * Prefix matching over the option labels, wrapping around the end.
   *
   * A single-character search starts *after* the current option, so pressing
   * the same letter repeatedly cycles through everything beginning with it —
   * what native selects do, and independent of how fast the presses come. A
   * multi-character search starts *at* the current option instead, so refining
   * a prefix ("f" then "fa") does not jump away from a match already found.
   */
  const runTypeahead = useCallback(
    (char: string) => {
      if (typeaheadTimer.current !== null) window.clearTimeout(typeaheadTimer.current)
      typeaheadTimer.current = window.setTimeout(() => {
        typeahead.current = ''
        typeaheadTimer.current = null
      }, TYPEAHEAD_RESET_MS)

      const buffer = typeahead.current + char.toLowerCase()
      typeahead.current = buffer

      const current = open ? activeIndex : selectedIndex
      const from = current < 0 ? 0 : current + (buffer.length === 1 ? 1 : 0)

      for (let step = 0; step < options.length; step += 1) {
        const index = (from + step) % options.length
        if (options[index].label.toLowerCase().startsWith(buffer)) {
          if (open) setActiveIndex(index)
          else onChange(options[index].value)
          return
        }
      }
    },
    [activeIndex, selectedIndex, onChange, open, options],
  )

  const handleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const isPrintable = event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey

    if (!open) {
      if (event.key === 'Enter' || event.key === ' ' || event.key === 'ArrowDown') {
        event.preventDefault()
        openAt(selectedIndex >= 0 ? selectedIndex : 0)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        openAt(selectedIndex >= 0 ? selectedIndex : options.length - 1)
      } else if (isPrintable) {
        event.preventDefault()
        runTypeahead(event.key)
      }
      return
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault()
        setActiveIndex((index) => Math.min(index + 1, options.length - 1))
        break
      case 'ArrowUp':
        event.preventDefault()
        setActiveIndex((index) => Math.max(index - 1, 0))
        break
      case 'Home':
        event.preventDefault()
        setActiveIndex(0)
        break
      case 'End':
        event.preventDefault()
        setActiveIndex(options.length - 1)
        break
      case 'Enter':
      case ' ':
        event.preventDefault()
        commit(activeIndex)
        break
      case 'Escape':
        event.preventDefault()
        close()
        break
      case 'Tab':
        // Close but let focus move on naturally — no preventDefault.
        close(false)
        break
      default:
        if (isPrintable) {
          event.preventDefault()
          runTypeahead(event.key)
        }
    }
  }

  // Track the trigger's viewport position while the popup is open. The scroll
  // listener is capture-phase so it also fires for scrollable ancestors, not
  // just the window.
  useLayoutEffect(() => {
    if (!open) return
    const measure = () => {
      const trigger = triggerRef.current
      if (!trigger) return
      const box = trigger.getBoundingClientRect()
      // Capture-phase means this also fires for scrolls of the popup's own
      // overflow container. Returning the previous object when nothing moved
      // keeps a long list from re-rendering on every wheel tick.
      setRect((prev) =>
        prev &&
        prev.top === box.top &&
        prev.left === box.left &&
        prev.width === box.width &&
        prev.bottom === box.bottom
          ? prev
          : { top: box.top, left: box.left, width: box.width, bottom: box.bottom },
      )
    }
    measure()
    window.addEventListener('scroll', measure, true)
    window.addEventListener('resize', measure)
    return () => {
      window.removeEventListener('scroll', measure, true)
      window.removeEventListener('resize', measure)
    }
  }, [open])

  // Keep the active option in view while arrowing through a scrolled list.
  // `rect` is a dependency because the popup does not exist in the commit
  // where `open` first flips true — it is gated on rect below, which the
  // layout effect fills in a commit later. Without it the option refs are
  // still null when this runs and the first open never scrolls.
  useEffect(() => {
    if (!open || !rect || activeIndex < 0) return
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' })
  }, [open, rect, activeIndex])

  // Dismiss on any pointer press outside the control. The popup is portalled,
  // so it is not inside wrapperRef — both have to be checked, otherwise
  // pressing an option would unmount it before its click ever landed.
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (wrapperRef.current?.contains(target) || popupRef.current?.contains(target)) return
      close(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open, close])

  useEffect(
    () => () => {
      if (typeaheadTimer.current !== null) window.clearTimeout(typeaheadTimer.current)
    },
    [],
  )

  return (
    <div ref={wrapperRef} className={`relative ${className}`}>
      {/* Never dropped, only hidden. The label is what makes the combobox
          announce as "Category, Food & Snacks" rather than reading its current
          value with no idea what it selects — so in the top bar, where there is
          no room for it, it goes to screen readers only. */}
      <span
        id={labelId}
        className={
          labelHidden
            ? 'sr-only'
            : 'mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase'
        }
      >
        {label}
      </span>

      <button
        ref={triggerRef}
        id={comboId}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        // Only while the listbox exists — a dangling idref is invalid.
        aria-controls={open ? listboxId : undefined}
        // Load-bearing because the popup is portalled. aria-activedescendant
        // may only reference a DOM descendant of the focused element, or a
        // logical one declared through aria-owns. Without this the option ids
        // below resolve to nothing for a screen reader and arrowing through
        // the list announces silence. aria-controls does not establish it.
        aria-owns={open ? listboxId : undefined}
        // Self-reference is deliberate: it appends the button's own text — the
        // current value — to the name, so the control announces as
        // "Category, Food & Snacks" rather than just "Category".
        aria-labelledby={`${labelId} ${comboId}`}
        aria-activedescendant={open && activeIndex >= 0 ? optionId(activeIndex) : undefined}
        onClick={() => (open ? close() : openAt(selectedIndex >= 0 ? selectedIndex : 0))}
        onKeyDown={handleKeyDown}
        className={triggerClassName}
      >
        <span className={`truncate ${selectedLabel ? 'text-white' : 'text-white/30'}`}>
          {selectedLabel ?? placeholder}
        </span>
        <ChevronDown
          size={14}
          aria-hidden="true"
          className={`shrink-0 text-white/40 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open &&
        rect &&
        createPortal(
          <motion.ul
            ref={popupRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            // Entrance only, and deliberately no AnimatePresence exit. An exit
            // animation makes unmounting depend on that animation reporting
            // completion — and under prefers-reduced-motion it does not, which
            // leaves a fully opaque popup mounted over the page swallowing
            // clicks, and wedges every subsequent open at its initial state.
            // A dropdown that vanishes instantly is what native selects do.
            //
            // `initial={false}` under reduced motion renders straight at the
            // target, so the popup can never mount stuck at opacity 0.
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            style={{ ...popupPosition(rect), position: 'fixed', zIndex: 50 }}
            className="liquid-glass-panel overflow-auto rounded-2xl p-1.5"
          >
            {options.map((option, index) => {
              const isSelected = option.value === value
              const isActive = index === activeIndex
              return (
                <li
                  key={option.value}
                  id={optionId(index)}
                  ref={(node) => {
                    optionRefs.current[index] = node
                  }}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => commit(index)}
                  onPointerEnter={() => setActiveIndex(index)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-[13px] font-bold transition-colors ${
                    isActive ? 'bg-white/[0.07]' : ''
                  } ${isSelected ? 'text-brand-300' : isActive ? 'text-white/85' : 'text-white/60'}`}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected && (
                    <Check size={14} aria-hidden="true" className="text-brand-400 shrink-0" />
                  )}
                </li>
              )
            })}
          </motion.ul>,
          document.body,
        )}
    </div>
  )
}
