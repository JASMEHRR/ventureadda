import { useCallback, useSyncExternalStore } from 'react'

/**
 * The two glass knobs, made adjustable by the reader.
 *
 * index.css already declares `--glass-opacity` and `--glass-blur` on :root and
 * multiplies every fill, border and highlight through them — the design system
 * was built with runtime control in mind and nothing had ever used it. This is
 * that control. Nothing here invents a new styling mechanism; it writes two
 * custom properties onto the document element and lets the existing rules do
 * the work.
 *
 * WHY IT IS WORTH HAVING. Glass takes its contrast from whatever is behind it,
 * and what is behind it here is a photograph. On a dim laptop screen the panels
 * read fine; on a bright phone outdoors, white-on-glass over a light patch of
 * sky is genuinely hard to read. Turning the panels more solid is the fix, and
 * it is the reader's call, not something a stylesheet can guess.
 *
 * PERSISTED LOCALLY, NOT ON THE ACCOUNT. This is a property of the screen you
 * are looking at, not of who you are: the same person wants heavier glass on a
 * phone in sunlight and lighter glass on a laptop indoors. localStorage is
 * per-device, which is exactly the right scope, and it costs no read.
 */

const STORAGE_KEY = 'ventureadda:appearance'

/**
 * Whether venture photos cycle on their own.
 *
 * 'auto' follows the operating system: no auto-advance for anyone who has
 * asked for reduced motion. That was the only behaviour at first, and it was
 * wrong on its own — Windows turns `prefers-reduced-motion` on as part of
 * "Animation effects: off", which plenty of people set for reasons that have
 * nothing to do with a photo slider, and they had no way to get it back. 'on'
 * is that way back: an explicit request beats an inferred one. It still drops
 * the smooth scroll and jumps between photos instead, because the request was
 * for the slideshow, not for the sliding.
 */
export type AutoPlay = 'auto' | 'on' | 'off'

export type Appearance = {
  /** Multiplies every glass fill, border and highlight. 0 is invisible glass. */
  glassOpacity: number
  /** Backdrop blur in pixels. 0 shows the photograph through, sharp. */
  glassBlur: number
  /** Dims the backdrop photograph behind everything. 0 leaves it as shot. */
  backdropDim: number
  autoPlayPhotos: AutoPlay
}

/**
 * `autoPlayPhotos` defaults to 'on', which is a product decision rather than a
 * technical one and is worth writing down.
 *
 * 'auto' would be the conservative default, and it is what shipped first. It
 * meant that every visitor whose device reports reduced motion — which on
 * Windows includes anyone who simply turned animation effects off for speed —
 * saw one static photo per venture and no sign there were three more. On a
 * directory whose entire job is showing what people are selling, that is the
 * feature failing silently for a large share of the people it was built for.
 *
 * What makes 'on' defensible rather than careless: reduced motion still
 * removes the sliding — photos swap instantly instead of animating across —
 * and 'auto' and 'never' are both one tap away in Settings. The accessible
 * behaviour is honoured in how it moves; the content is not withheld.
 */
export const DEFAULTS: Appearance = {
  glassOpacity: 1,
  glassBlur: 20,
  backdropDim: 0,
  autoPlayPhotos: 'on',
}

const AUTO_PLAY: AutoPlay[] = ['auto', 'on', 'off']

/** Ranges are clamped rather than trusted: this comes back from storage, which
 *  is hand-editable, and a NaN reaching a CSS variable silently kills the rule
 *  it lands in. The upper bounds are what still looks like this app. */
type NumericKey = 'glassOpacity' | 'glassBlur' | 'backdropDim'

const LIMITS: Record<NumericKey, [number, number]> = {
  glassOpacity: [0.2, 3],
  glassBlur: [0, 40],
  backdropDim: [0, 0.85],
}

function clamp(key: NumericKey, value: unknown): number {
  const [min, max] = LIMITS[key]
  if (typeof value !== 'number' || !Number.isFinite(value)) return DEFAULTS[key]
  return Math.min(max, Math.max(min, value))
}

let snapshot: Appearance | null = null
const listeners = new Set<() => void>()

function read(): Appearance {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULTS
    const parsed: unknown = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return DEFAULTS
    const value = parsed as Record<string, unknown>
    return {
      glassOpacity: clamp('glassOpacity', value.glassOpacity),
      glassBlur: clamp('glassBlur', value.glassBlur),
      backdropDim: clamp('backdropDim', value.backdropDim),
      autoPlayPhotos: AUTO_PLAY.includes(value.autoPlayPhotos as AutoPlay)
        ? (value.autoPlayPhotos as AutoPlay)
        : DEFAULTS.autoPlayPhotos,
    }
  } catch {
    // Blocked storage or malformed JSON. The defaults are a working app.
    return DEFAULTS
  }
}

/**
 * Pushes the values onto the document element.
 *
 * Called at boot before React renders and again on every change, so there is
 * no flash of default glass on load for someone who has turned it up.
 */
export function applyAppearance(next: Appearance = getAppearance()): void {
  const root = document.documentElement
  root.style.setProperty('--glass-opacity', String(next.glassOpacity))
  root.style.setProperty('--glass-blur', `${next.glassBlur}px`)
  root.style.setProperty('--backdrop-dim', String(next.backdropDim))
}

export function getAppearance(): Appearance {
  if (snapshot === null) snapshot = read()
  return snapshot
}

export function setAppearance(patch: Partial<Appearance>): void {
  const next: Appearance = {
    glassOpacity: clamp('glassOpacity', patch.glassOpacity ?? getAppearance().glassOpacity),
    glassBlur: clamp('glassBlur', patch.glassBlur ?? getAppearance().glassBlur),
    backdropDim: clamp('backdropDim', patch.backdropDim ?? getAppearance().backdropDim),
    autoPlayPhotos: patch.autoPlayPhotos ?? getAppearance().autoPlayPhotos,
  }
  snapshot = next
  applyAppearance(next)
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // The session still looks right; it just will not be remembered.
  }
  for (const listener of listeners) listener()
}

export function resetAppearance(): void {
  setAppearance(DEFAULTS)
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** The current appearance, plus the setter, for the settings page. */
export function useAppearance(): [Appearance, (patch: Partial<Appearance>) => void] {
  const value = useSyncExternalStore(subscribe, getAppearance, () => DEFAULTS)
  const update = useCallback((patch: Partial<Appearance>) => setAppearance(patch), [])
  return [value, update]
}
