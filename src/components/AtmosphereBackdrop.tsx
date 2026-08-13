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
 */
export default function AtmosphereBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="fixed inset-0 -z-10 bg-app bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: 'url(/atmosphere.jpg)' }}
    />
  )
}
