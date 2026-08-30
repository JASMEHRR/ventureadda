import { useCallback, useSyncExternalStore } from 'react'
import { MENU_DENSITIES } from '../data/types'
import type { MenuDensity } from '../data/types'

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

/**
 * Whether the interface moves between its states.
 *
 * SAME ARGUMENT AS autoPlayPhotos ABOVE, and the same default, for the same
 * reason: 'auto' alone was wrong in practice. Windows sets
 * `prefers-reduced-motion` as part of "Animation effects: off", which people
 * turn on for speed, and index.css honoured that by cutting every transition
 * in the app to nothing. The result is not a calmer interface — it is a
 * twitchy one. A sidebar that grows over 200ms reads as a drawer opening; the
 * same sidebar with the transition removed snaps four inches wide and shoves
 * the page sideways in a single frame, which is what "fidgety" means here.
 *
 * What makes 'on' defensible rather than careless is what it covers. These are
 * small, local, self-initiated changes — a panel widening under the pointer, a
 * fade — not parallax, not autoplaying video, not anything that moves while
 * the reader is still. Nothing here scrolls the page on its own. 'auto' and
 * 'off' are both one tap away in Settings, and 'off' is genuinely off: it
 * kills the transitions rather than shortening them.
 */
export type InterfaceMotion = 'auto' | 'on' | 'off'

/**
 * Night, day, or whatever the device is set to.
 *
 * 'auto' is the default because a phone that is already in light mode at noon
 * is telling us something we would otherwise have to guess, and someone who
 * has never opened Settings should still get a readable screen in sunlight.
 * The two explicit values beat the system, because plenty of people run their
 * OS dark and still want this one site light, or the reverse.
 */
export type Theme = 'auto' | 'dark' | 'light'

/**
 * How many items the reader wants across a menu grid.
 *
 * 'store' — the default — means whatever the seller set on that venture, and
 * it is the honest default because the seller is the one who knows whether
 * their items are photographed cakes or a price list. The other three overrule
 * them for this device only: a menu that is comfortable on the seller's phone
 * can be three items to a screen on a laptop, and someone scanning forty items
 * for one price wants them all at once.
 */
export type MenuDensityChoice = 'store' | MenuDensity

export type Appearance = {
  /** Multiplies every glass fill, border and highlight. 0 is invisible glass. */
  glassOpacity: number
  /** Backdrop blur in pixels. 0 shows the photograph through, sharp. */
  glassBlur: number
  /** Dims the backdrop photograph behind everything. 0 leaves it as shot. */
  backdropDim: number
  autoPlayPhotos: AutoPlay
  interfaceMotion: InterfaceMotion
  theme: Theme
  menuDensity: MenuDensityChoice
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
  interfaceMotion: 'on',
  theme: 'auto',
  menuDensity: 'store',
}

const AUTO_PLAY: AutoPlay[] = ['auto', 'on', 'off']
const MOTION: InterfaceMotion[] = ['auto', 'on', 'off']
const THEMES: Theme[] = ['auto', 'dark', 'light']
const DENSITY_CHOICES: MenuDensityChoice[] = ['store', ...MENU_DENSITIES]

/** The system preference, for `theme: 'auto'`. Defaults to night if the
 *  browser has no opinion, which is what this app was designed in. */
function systemTheme(): 'dark' | 'light' {
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark'
}

export function resolveTheme(theme: Theme): 'dark' | 'light' {
  return theme === 'auto' ? systemTheme() : theme
}

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
      interfaceMotion: MOTION.includes(value.interfaceMotion as InterfaceMotion)
        ? (value.interfaceMotion as InterfaceMotion)
        : DEFAULTS.interfaceMotion,
      theme: THEMES.includes(value.theme as Theme) ? (value.theme as Theme) : DEFAULTS.theme,
      menuDensity: DENSITY_CHOICES.includes(value.menuDensity as MenuDensityChoice)
        ? (value.menuDensity as MenuDensityChoice)
        : DEFAULTS.menuDensity,
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
  // The one attribute the day-mode block in index.css keys off. Written even
  // for night, so the selector is never matching a stale value from a theme
  // the reader has since switched away from.
  root.dataset.theme = resolveTheme(next.theme)
  // Read by the reduced-motion block in index.css. 'auto' writes nothing, so
  // the media query decides on its own — an attribute of "auto" would have to
  // be spelled out in that selector twice.
  if (next.interfaceMotion === 'auto') delete root.dataset.motion
  else root.dataset.motion = next.interfaceMotion
}

// Following the system means following it while the page is open, not only at
// boot: phones flip to light at sunrise with the tab still sitting there.
// Registered once, at module load, and only ever repaints for 'auto'.
window.matchMedia?.('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (getAppearance().theme !== 'auto') return
  // A fresh object, not the same one. useSyncExternalStore compares snapshots
  // by identity, so notifying with the identical reference repaints the CSS
  // and leaves every subscriber rendering the old theme — the top bar would
  // sit there offering "Switch to day mode" on an already-light page.
  snapshot = { ...getAppearance() }
  applyAppearance(snapshot)
  for (const listener of listeners) listener()
})

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
    interfaceMotion: patch.interfaceMotion ?? getAppearance().interfaceMotion,
    theme: patch.theme ?? getAppearance().theme,
    menuDensity: patch.menuDensity ?? getAppearance().menuDensity,
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

/** The grid to actually render: the reader's override, or the seller's own
 *  setting when they have not asked for one. */
export function resolveMenuDensity(
  choice: MenuDensityChoice,
  storeDefault: MenuDensity,
): MenuDensity {
  return choice === 'store' ? storeDefault : choice
}

/**
 * Whether this reader wants the interface to move.
 *
 * The one place anything should ask. `useReducedMotion` from motion/react
 * reads the operating system and nothing else, which meant a reader who chose
 * "Move smoothly" in Settings still got a dropdown that snapped open — the
 * setting said menus and panels slide, and the menus did not. This consults
 * the choice first and falls back to the system for 'auto'.
 */
export function useMotionAllowed(): boolean {
  const [appearance] = useAppearance()
  const system = useSyncExternalStore(subscribeReducedMotion, reducedMotionNow, () => false)
  if (appearance.interfaceMotion === 'on') return true
  if (appearance.interfaceMotion === 'off') return false
  return !system
}

function reducedMotionNow(): boolean {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
}

function subscribeReducedMotion(callback: () => void): () => void {
  const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
  query?.addEventListener('change', callback)
  return () => query?.removeEventListener('change', callback)
}
