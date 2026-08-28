import { useEffect, useState } from 'react'
import { getSiteSettings } from '../data/settings'
import type { SiteSettings } from '../data/settings'
import { displayUrl } from '../lib/cloudinary'
import { resolveTheme, useAppearance } from '../lib/appearance'

/**
 * Full-bleed photographic backdrop sitting behind the entire app.
 *
 * This is load-bearing, not decoration. The glass classes in index.css only
 * read as *glass* because there is something with real detail behind them to
 * blur and saturate; drop the same CSS onto a flat #02040a and it reads as
 * frosted plastic (spec §8, intangible 2).
 *
 * Sits at -z-10, so no ancestor may create a stacking context (a `transform`,
 * `filter`, `isolation` or non-auto `z-index` on a wrapper would trap it behind
 * the content and hide it entirely).
 *
 * Photo: Joshua Woroniecki (@joshuaworoniecki) via Unsplash, free licence.
 * https://unsplash.com/photos/lruHubmBzl0
 * Chosen for a teal starfield in the same hue family as brand cyan, so the
 * accent harmonises with the backdrop rather than competing with it (§8:
 * multiple accent hues in play at once is explicitly avoided).
 *
 * The asset is stored at 60% of the original exposure. The original's upper
 * sky was bright enough that text sitting on bare backdrop between panels
 * washed out. This is baked into the file rather than applied as an overlay
 * on purpose: a translucent veil between photo and UI is a light-mode-only
 * device in Ascend (§2), and a runtime filter would cost a full-screen pass.
 * A flat multiply keeps the stars proportionally brighter than the sky, so
 * none of the texture the blur needs is lost.
 *
 * A moderator can replace this from /moderator, stored in settings/site in
 * Firestore. Starts on the file above and swaps in whatever is there once the
 * one-document read resolves, rather than blocking first paint on it — a
 * flash from default to custom is far cheaper than a blank screen while
 * every visitor, signed in or not, waits on a network round trip.
 */
const DEFAULT_BACKDROP = '/atmosphere.jpg'

/**
 * The day wallpaper, shipped with the app the way the night one is.
 *
 * Drawn rather than photographed — see the note inside the file. Day mode used
 * to fall back to a flat gradient painted over the washed-out night sky, which
 * is why it read as "no background": there genuinely was not one, just paint.
 * This is a real image with light and direction in it, at four kilobytes,
 * and a moderator uploading a photograph still overrides it.
 */
const DEFAULT_DAY_BACKDROP = '/atmosphere-day.svg'

export default function AtmosphereBackdrop() {
  const [settings, setSettings] = useState<SiteSettings | null>(null)
  const [appearance] = useAppearance()
  const day = resolveTheme(appearance.theme) === 'light'

  /**
   * Day mode gets its own wallpaper when a moderator has set one.
   *
   * Falls back to the night photograph — washed out, as before — when there is
   * no day picture, because a missing setting must not leave the app with no
   * backdrop at all. What the wash is doing differs between the two: over the
   * night sky it is hiding a photograph that cannot carry dark text, and over
   * a day photograph it is only softening one that can.
   */
  const dayImage = day
    ? settings?.backdropLight
      ? displayUrl(settings.backdropLight, 1200)
      : DEFAULT_DAY_BACKDROP
    : null
  const url = settings?.backdrop ? displayUrl(settings.backdrop, 1200) : DEFAULT_BACKDROP

  useEffect(() => {
    let cancelled = false
    getSiteSettings()
      .then((next) => {
        if (!cancelled) setSettings(next)
      })
      .catch(() => {
        // The default backdrop is already showing. Nobody sees a broken page
        // over a failed read of an optional override.
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 bg-app bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: `url(${dayImage ?? url})` }}
    >
      {/*
        The dimmer from Settings.
        A child rather than a filter on the parent: `filter` on this element
        would create a stacking context and trap the whole backdrop, which the
        note above is explicit about. A flat black sheet at a variable alpha
        costs nothing and cannot do that. `--backdrop-dim` defaults to 0 in
        index.css, so this is invisible until somebody asks for it.
      */}
      <div className="absolute inset-0 bg-black opacity-[var(--backdrop-dim)]" />

      {/*
        Day mode's half of the same trick. The backdrop is a night sky and the
        panels above it turn white with dark text, so without this the app
        reads as light panels floating on midnight — the one combination the
        glass cannot survive. A flat sheet rather than a filter, for the same
        stacking-context reason as the dimmer, and the literal hex rather than
        a token because this is the paper colour of day mode specifically,
        not a value that should follow the theme.
      */}
      <div
        // A real day photograph needs a veil, not a lid: enough to keep the
        // panels legible over it, nowhere near enough to hide it. Only the
        // night sky standing in for one gets covered almost completely.
        // Day always has a real image behind it now — the shipped one or a
        // moderator's — so this is a veil at all times rather than the lid it
        // had to be when it was standing in for a background of its own.
        className={dayImage ? 'absolute inset-0 opacity-20' : 'absolute inset-0 opacity-[var(--backdrop-wash)]'}
        style={{
          // A GRADIENT, NOT A FLAT SHEET. At 86% white over a starfield the
          // page read as a blank white screen with faint dots on it — the
          // stars survived the wash better than anything else in the photo and
          // came through as snow. Taking the wash higher and giving it a
          // gentle diagonal shift replaces the photograph in day mode with
          // something that looks like a chosen background rather than a night
          // sky somebody bleached: no dots, and still enough tonal movement
          // for the glass panels to have something to sit on.
          background: 'linear-gradient(160deg, #f4f7fb 0%, #e6edf7 45%, #dde8f6 100%)',
        }}
      />
    </div>
  )
}
