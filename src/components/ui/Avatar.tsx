/**
 * The tile that stands in for a person: their initial, or one of two drawn
 * faces they can pick instead.
 *
 * INITIALS WERE THE WHOLE THING here, and the reasoning still holds for the
 * default — Ascend's pattern, nothing to load, nothing to moderate, and it
 * cannot fail. What it could not do is let anyone feel like the tile was
 * theirs, which matters more now that nobody chooses their username either:
 * a name derived from an email address and a letter taken off the front of it
 * is an account with no decision in it anywhere.
 *
 * So: two faces, drawn here rather than uploaded. Still nothing to load, still
 * nothing to moderate — a drawing in the file cannot be a photograph of
 * somebody else — and it keeps the "no photo avatars" line the original note
 * drew, which was about user-supplied images rather than about faces.
 *
 * They are deliberately plain. A boy and a girl at this size come down to
 * hair, and anything more detailed reads as clip art at 32px.
 */
export type AvatarStyle = 'initial' | 'boy' | 'girl'

export const AVATAR_STYLES: AvatarStyle[] = ['initial', 'boy', 'girl']

export function isAvatarStyle(value: unknown): value is AvatarStyle {
  return AVATAR_STYLES.includes(value as AvatarStyle)
}

/** Shared face, with only the hair differing between the two. */
function Face({ girl }: { girl: boolean }) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className="h-[72%] w-[72%]"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.1}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="16" cy="12" r="6" />
      {girl ? (
        // Hair falling either side of the face, and a centre parting. Drawn
        // outside the head circle so the face stays a face at small sizes.
        <>
          <path d="M9 12a7 7 0 0 1 14 0" />
          <path d="M8.5 11v7" />
          <path d="M23.5 11v7" />
        </>
      ) : (
        // A short fringe: one arc across the top of the head, nothing else.
        <path d="M10 9.5c1.8-2.2 10.2-2.2 12 0" />
      )}
      {/* Shoulders, cut off by the tile like a passport crop. */}
      <path d="M5.5 27.5c1.6-4.7 5.6-7 10.5-7s8.9 2.3 10.5 7" />
    </svg>
  )
}

export default function Avatar({
  name,
  style = 'initial',
  className = '',
}: {
  name: string
  style?: AvatarStyle
  className?: string
}) {
  const initial = name.trim().charAt(0).toUpperCase() || '?'
  return (
    <span
      aria-hidden="true"
      className={`flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-500/20 text-[15.5px] font-bold text-brand-300 ${className}`}
    >
      {style === 'initial' ? initial : <Face girl={style === 'girl'} />}
    </span>
  )
}
