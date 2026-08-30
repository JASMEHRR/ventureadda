import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Hover, but only when it was meant.
 *
 * A menu that opens the instant a pointer touches it opens on its way past —
 * crossing the sidebar to reach a card fires it, the page shifts under the
 * cursor, and it shuts again before you have read a word. Repeat that on a
 * page with two such panels and the whole interface twitches.
 *
 * Two delays fix it, and they are deliberately different lengths:
 *
 *   Opening waits, so a pointer travelling through does not count. Short
 *   enough that a deliberate hover still feels immediate — nobody perceives
 *   90ms as waiting.
 *
 *   Closing waits longer, because the pointer leaves the panel constantly
 *   while it is being used: crossing a gap between rows, overshooting an edge,
 *   drifting off while reading. Shutting on the first pixel of exit makes the
 *   menu feel like it is trying to escape.
 *
 * Focus is not delayed in either direction. Tabbing into something is never
 * accidental, and a keyboard user waiting 90ms for a panel to acknowledge them
 * is the delay actually being felt.
 */
export function useHoverIntent({
  openDelay = 90,
  closeDelay = 260,
}: { openDelay?: number; closeDelay?: number } = {}): {
  active: boolean
  handlers: {
    // Mouse rather than pointer events: `onPointerEnter` is not delivered by
    // every automation harness, and a touch device has no hover to detect
    // either way — so the pointer variants buy nothing here and cost a class
    // of "works everywhere except where you are testing it" bug.
    onMouseEnter: () => void
    onMouseLeave: () => void
    onFocusCapture: () => void
    onBlurCapture: (event: React.FocusEvent) => void
  }
} {
  const [active, setActive] = useState(false)
  const timer = useRef<number | null>(null)

  const clear = () => {
    if (timer.current !== null) window.clearTimeout(timer.current)
    timer.current = null
  }

  // A pending open must not fire after the component is gone.
  useEffect(() => clear, [])

  const schedule = useCallback((next: boolean, delay: number) => {
    clear()
    timer.current = window.setTimeout(() => setActive(next), delay)
  }, [])

  return {
    active,
    handlers: {
      onMouseEnter: () => schedule(true, openDelay),
      onMouseLeave: () => schedule(false, closeDelay),
      onFocusCapture: () => {
        clear()
        setActive(true)
      },
      // Only when focus has left the panel altogether: a blur fires on every
      // arrow-key move down a list, and closing on those would shut the menu
      // under the reader's own cursor.
      onBlurCapture: (event: React.FocusEvent) => {
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        clear()
        setActive(false)
      },
    },
  }
}
