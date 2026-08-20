/**
 * The one loading line the whole app uses.
 *
 * It existed as nine hand-copied paragraphs before this, all carrying the same
 * classes, which is how they all ended up at white/30 — a value that measures
 * around 3:1 against the photographic backdrop, under AA. Most of these render
 * with no glass panel beneath them, since the panel is usually the thing still
 * being loaded, so the text gets none of the dark fill the rest of the app's
 * prose sits on.
 *
 * white/75 rather than the white/55 used for the backdrop paragraphs: this is
 * 10px mono with wide tracking, which is thinner on screen than 13px Jakarta,
 * so it needs more alpha to clear the same bar. Measured on the backdrop:
 * white/60 measured 4.05:1, still under AA; white/75 measures 5.71:1.
 *
 * Campus wifi is the constraint the whole mobile-first pass is built around,
 * and a slow connection is exactly when this line is on screen longest.
 */
export default function LoadingLine({
  label,
  /** Panels supply their own padding; pages on bare backdrop need the inset. */
  inset = true,
}: {
  label: string
  inset?: boolean
}) {
  return (
    <p
      role="status"
      className={`font-mono text-[11.5px] tracking-[0.18em] text-white/75 uppercase ${
        inset ? 'px-1' : ''
      }`}
    >
      {label}
    </p>
  )
}
