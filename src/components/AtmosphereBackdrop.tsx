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
 * A PHOTOGRAPH, after two wrong answers. It was a drawn gradient: first too
 * faint to see at all, then visible but obviously synthetic — "very plain, no
 * snowy mountain or anything". A gradient is what you reach for when you have
 * no picture, and the site already had a real photograph at night.
 *
 * Snow, pines and a misted lake under a pale sky: light enough for dark text
 * to sit over, and cool-toned, so brand cyan stays the only warm-cold decision
 * on the page rather than fighting a second palette. A moderator uploading
 * their own still overrides it.
 *
 * Photo: Joel & Jasmin Førestbird via Unsplash, free licence, no attribution
 * required — credited anyway, the same as the night backdrop above.
 * https://unsplash.com/photos/efuwb5eBDrI
 */
const DEFAULT_DAY_BACKDROP = '/atmosphere-day.jpg'

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
  const uploadedDayImage = day && settings?.backdropLight
    ? displayUrl(settings.backdropLight, 1200)
    : null
  const dayImage = day ? (uploadedDayImage ?? DEFAULT_DAY_BACKDROP) : null
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
        /*
          NO VEIL OVER THE SHIPPED DAY WALLPAPER. It was drawn for this exact
          job — light, soft, nothing behind the panels to fight — so covering
          it with a 20% sheet of near-white only did what the flat gradient did
          before it: made the page look like it had no background. A
          moderator's uploaded photograph is a different case entirely, since
          it could be anything, so that one keeps a veil.

          The night sky keeps the full wash, which is not a veil at all: there
          it is standing in for a background day mode cannot use.
        */
        // The shipped day photo takes the same light veil an uploaded one
        // does, now that it IS a photograph: a picture with trees and rock in
        // it has contrast of its own, and the glass panels need a calmer thing
        // to sit on than bare bark. Only the night sky still gets the full
        // wash, because there it covers an image day mode cannot use.
        className={dayImage ? 'absolute inset-0 opacity-40' : 'absolute inset-0 opacity-[var(--backdrop-wash)]'}
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
