import { useEffect, useState } from 'react'
import { getSiteSettings } from '../data/settings'
import { displayUrl } from '../lib/cloudinary'

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

export default function AtmosphereBackdrop() {
  const [url, setUrl] = useState(DEFAULT_BACKDROP)

  useEffect(() => {
    let cancelled = false
    getSiteSettings()
      .then((settings) => {
        if (!cancelled && settings.backdrop) setUrl(displayUrl(settings.backdrop, 1200))
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
      style={{ backgroundImage: `url(${url})` }}
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
    </div>
  )
}
