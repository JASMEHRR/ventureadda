import { useCallback, useEffect, useId, useRef } from 'react'
import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'
import { useMotionAllowed } from '../../lib/appearance'
import { X } from 'lucide-react'

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

type ModalProps = {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** Buttons row along the bottom. */
  footer?: ReactNode
}

/**
 * Dialog built to spec §5, with the accessibility Ascend leaves to the browser
 * filled in: focus moves into the panel on open, Tab is trapped inside it,
 * and focus returns to whatever opened it on close.
 *
 * Entrance animation only. An AnimatePresence exit would make unmounting
 * depend on the animation reporting completion, and under
 * prefers-reduced-motion it does not — which in this codebase already produced
 * a fully opaque overlay stuck over the page swallowing every click.
 */
export default function Modal({ open, onClose, title, children, footer }: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const restoreFocusTo = useRef<HTMLElement | null>(null)
  const titleId = useId()
  const reduce = !useMotionAllowed()

  const handleKeyDown = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = [...panel.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      )
      if (focusable.length === 0) {
        // Nothing to move to — keep focus in the dialog rather than letting it
        // escape to the page behind the backdrop.
        event.preventDefault()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    },
    [onClose],
  )

  /**
   * Open/close lifecycle. Depends on `open` and NOTHING else, which is the
   * whole point.
   *
   * THE BUG THIS FIXES. This used to also depend on `handleKeyDown`, and every
   * caller in this app passes an inline arrow as `onClose` — so `onClose` was a
   * new function on every render, `handleKeyDown` was rebuilt with it, and this
   * effect tore down and re-ran. Its cleanup calls restoreFocusTo.focus(). So
   * typing one character into a field inside a dialog re-rendered the parent,
   * ripped focus out of that field back to whatever opened the dialog, and then
   * the timer below moved it to the close button. The checkout form could not
   * be filled in: one keystroke per click into the field.
   *
   * The listener therefore lives in its own effect below, where being rebuilt
   * costs nothing but a removeEventListener/addEventListener pair.
   */
  useEffect(() => {
    if (!open) return

    restoreFocusTo.current = document.activeElement as HTMLElement | null

    // The panel animates in; focusing on the next frame lets it be laid out
    // first so the browser does not scroll to a half-positioned element.
    const focusTimer = window.setTimeout(() => {
      const panel = panelRef.current
      if (!panel) return
      const target = panel.querySelector<HTMLElement>(FOCUSABLE) ?? panel
      target.focus()
    }, 40)

    // Stop the page behind the dialog scrolling under the backdrop.
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    return () => {
      window.clearTimeout(focusTimer)
      document.body.style.overflow = previousOverflow
      restoreFocusTo.current?.focus()
    }
  }, [open])

  // Escape and the Tab trap. Re-subscribing when the handler identity changes
  // is free and has no effect on focus.
  useEffect(() => {
    if (!open) return
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, handleKeyDown])

  if (!open) return null

  return createPortal(
    // `dvh`, not `vh`: on mobile Safari and Chrome the URL bar is inside `vh`,
    // so a dialog sized to 100vh sits partly under browser chrome that is
    // still on screen.
    <div className="fixed inset-0 z-50 flex h-[100dvh] items-end justify-center p-3 sm:items-center sm:p-6">
      {/* Backdrop is its own element so a click on it closes without needing
          the panel to stop propagation. */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
        aria-hidden="true"
      />

      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        initial={reduce ? false : { opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        /**
         * THE BUG THIS FIXES. The panel had no height bound and no scroll
         * container, so a dialog taller than the window — the checkout, which
         * is a cart, three fields, a slot picker and two choice groups — grew
         * past both edges of the viewport. The flex parent centres it, so it
         * overflowed equally above and below, and `document.body` is set to
         * `overflow: hidden` while a dialog is open, so there was nothing to
         * scroll: the total and the Place order button were simply off screen
         * with no way to reach them.
         *
         * The panel is now a column capped at the viewport, with the header
         * and footer pinned and only the body scrolling. `min-h-0` on that
         * body is what actually allows it to shrink — a flex child defaults to
         * `min-height: auto` and refuses to be smaller than its content, which
         * would push the footer straight back off the bottom.
         */
        className="relative flex max-h-full w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border border-white/12 bg-surface/95 shadow-[0_30px_60px_rgba(0,0,0,0.8)] outline-none"
      >
        <div className="flex shrink-0 items-start gap-3 border-b border-white/8 px-5 py-4">
          <h2 id={titleId} className="min-w-0 flex-1 text-sm font-bold text-white">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/60 transition duration-150 hover:bg-white/15 hover:text-white active:scale-[0.94]"
          >
            <X size={14} aria-hidden="true" />
          </button>
        </div>

        {/* overscroll-contain stops a flick at the end of this list from
            scrolling the page behind the backdrop on iOS. */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4">{children}</div>

        {footer && (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2.5 border-t border-white/8 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] sm:pb-4">
            {footer}
          </div>
        )}
      </motion.div>
    </div>,
    document.body,
  )
}
