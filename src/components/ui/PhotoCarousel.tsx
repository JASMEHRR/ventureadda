import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, ImageOff } from 'lucide-react'
import { useReducedMotion } from 'motion/react'
import { displayUrl } from '../../lib/cloudinary'
import { useAppearance } from '../../lib/appearance'
import type { StoredImage } from '../../data/types'

/**
 * A photo slider, shared by the venture cards on Browse and the detail page.
 *
 * WHY A SCROLL CONTAINER AND NOT A TRANSFORM. The slides live in a real
 * horizontally-scrolling element with CSS scroll snapping, so a thumb swipe is
 * handled by the browser's own momentum scrolling rather than by pointer maths
 * this file would have to get right on every device. The arrows and the dots
 * just call scrollTo. It also means the whole thing degrades to a normal
 * scrollable strip if the script never runs.
 *
 * WHY EVERY IMAGE IS object-cover AT A FIXED RATIO. Sellers upload whatever
 * their phone took — portrait, square, a screenshot. Letting the tallest photo
 * set the height made one card in a grid twice the height of its neighbours
 * and left the rest letterboxed. Every slide is cropped to the same 4:3 box
 * instead, so the grid stays a grid; PhotoUploader lets the owner choose which
 * photo leads, which is the real answer to a crop they do not like.
 *
 * AUTO-ADVANCE DEFERS TO THE READER. prefers-reduced-motion stops it by
 * default, Settings can force it on or off regardless, hover and focus pause
 * it, and touching a card stands it down for fifteen seconds — fighting a
 * reader for control of the thing they just touched is the worst version of
 * this component.
 */
export default function PhotoCarousel({
  photos,
  alt,
  /** Cloudinary width to request. Cards need far less than the detail page.
   *  The union is Cloudinary's — displayUrl only serves these three widths. */
  width = 800,
  /** Wraps each slide in a link, for the cards on Browse. */
  to,
  autoAdvanceMs = 0,
  className = 'aspect-4/3',
  rounded = 'rounded-2xl',
}: {
  photos: StoredImage[]
  alt: string
  width?: 400 | 800 | 1200
  to?: string
  autoAdvanceMs?: number
  className?: string
  rounded?: string
}) {
  const trackRef = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  /** Set by any manual interaction, cleared fifteen seconds later. */
  const [userTook, setUserTook] = useState(false)
  const [paused, setPaused] = useState(false)
  const reduce = useReducedMotion()

  const count = photos.length

  /**
   * Move to a slide, and record that we did.
   *
   * THE INDEX IS SET HERE, not left to the scroll handler below. It used to be
   * derived only from scroll events, and the dots stayed on the first photo
   * while the arrows moved the strip: `scrollTo` with smooth behaviour is
   * asynchronous, a background tab may not dispatch the event at all, and a
   * reader who cannot see which dot is lit has no idea where they are. The
   * handler still exists for swipes, which never come through here.
   */
  const goTo = useCallback((next: number) => {
    const track = trackRef.current
    if (!track) return
    setIndex(next)
    track.scrollTo({ left: track.clientWidth * next, behavior: reduce ? 'auto' : 'smooth' })
  }, [reduce])

  /** A swipe moved the strip. The dots follow it. */
  const onScroll = useCallback(() => {
    const track = trackRef.current
    if (!track || track.clientWidth === 0) return
    setIndex(Math.round(track.scrollLeft / track.clientWidth))
  }, [])

  /**
   * Whether to cycle, and how.
   *
   * `autoPlayPhotos` is the reader's explicit answer and it wins over the
   * operating system's inferred one. Under 'auto' — the default — reduced
   * motion still switches this off, which is the accessible behaviour. Under
   * 'on' it cycles even with reduced motion set, but jumps rather than slides:
   * they asked for the slideshow, not for the sliding.
   */
  const [{ autoPlayPhotos }] = useAppearance()
  const cycling =
    autoPlayPhotos === 'off' ? false : autoPlayPhotos === 'on' ? true : !reduce
  const behavior: ScrollBehavior = reduce ? 'auto' : 'smooth'

  useEffect(() => {
    if (count < 2 || autoAdvanceMs <= 0 || !cycling || userTook || paused) return
    const timer = window.setInterval(() => {
      // The tab is in the background: advancing costs layout and image decode
      // work nobody is looking at, and it would land the reader on a photo
      // they never chose when they come back.
      if (document.hidden) return
      setIndex((current) => {
        const next = (current + 1) % count
        const track = trackRef.current
        if (track) track.scrollTo({ left: track.clientWidth * next, behavior })
        return next
      })
    }, autoAdvanceMs)
    return () => window.clearInterval(timer)
    // `index` is deliberately absent: including it would tear down and rebuild
    // the timer on every advance, so the updater form above reads the current
    // slide instead.
  }, [count, autoAdvanceMs, cycling, behavior, userTook, paused])

  /**
   * Cycling resumes a while after you stop touching it.
   *
   * It used to stop for good on the first swipe or arrow press, which is right
   * for the moment somebody is looking at a photo and wrong ten minutes later
   * on a page they have scrolled away from and back to. Fifteen seconds is
   * long enough that it never yanks a photo out from under a reader mid-look.
   */
  useEffect(() => {
    if (!userTook) return
    const timer = window.setTimeout(() => setUserTook(false), 15000)
    return () => window.clearTimeout(timer)
  }, [userTook])

  const step = (delta: number) => {
    setUserTook(true)
    goTo((index + delta + count) % count)
  }

  if (count === 0) {
    return (
      <div
        className={`flex w-full items-center justify-center bg-white/[0.03] text-white/20 ring-1 ring-white/10 ring-inset ${className} ${rounded}`}
      >
        <ImageOff size={22} aria-hidden="true" />
      </div>
    )
  }

  const slides = photos.map((photo, slide) => {
    const image = (
      <img
        src={displayUrl(photo, width)}
        alt={count === 1 ? alt : `${alt}, photo ${slide + 1} of ${count}`}
        // The first slide is what a visitor sees before scrolling; the rest are
        // off screen inside a scroller, so they wait.
        loading={slide === 0 ? 'eager' : 'lazy'}
        className={`h-full w-full object-cover ${rounded}`}
      />
    )
    return (
      <div
        key={photo.url + slide}
        className={`w-full shrink-0 snap-center snap-always ${className}`}
        aria-hidden={slide === index ? undefined : true}
      >
        {to ? (
          <Link to={to} className="block h-full w-full" tabIndex={slide === index ? undefined : -1}>
            {image}
          </Link>
        ) : (
          image
        )}
      </div>
    )
  })

  return (
    <div
      className={`group/carousel relative w-full overflow-hidden ${rounded} ring-1 ring-white/10 ring-inset`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
      // A swipe never reaches the buttons, so the flag is set here as well.
      onTouchStart={() => setUserTook(true)}
    >
      <div
        ref={trackRef}
        onScroll={onScroll}
        // scrollbar-none is not available in stock Tailwind v4, hence the
        // arbitrary properties. Without them a grey scrollbar sits across the
        // bottom of every photo on desktop Chrome.
        className="flex w-full snap-x snap-mandatory overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides}
      </div>

      {count > 1 && (
        <>
          {/* Arrows on pointer devices only. On a phone the swipe is the
              control, and two 32px targets over a 150px-wide card photo would
              cover most of the thing they are meant to help you look at. */}
          <button
            type="button"
            onClick={() => step(-1)}
            aria-label="Previous photo"
            className="absolute top-1/2 left-2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 opacity-0 backdrop-blur-sm transition duration-150 group-hover/carousel:opacity-100 focus-visible:opacity-100 hover:bg-black/80 active:scale-[0.94] sm:flex"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => step(1)}
            aria-label="Next photo"
            className="absolute top-1/2 right-2 hidden h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/60 text-white/80 opacity-0 backdrop-blur-sm transition duration-150 group-hover/carousel:opacity-100 focus-visible:opacity-100 hover:bg-black/80 active:scale-[0.94] sm:flex"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center gap-1.5 bg-gradient-to-t from-black/50 to-transparent px-3 pt-6 pb-2.5">
            {photos.map((photo, dot) => (
              <button
                key={photo.url + dot}
                type="button"
                onClick={() => {
                  setUserTook(true)
                  goTo(dot)
                }}
                aria-label={`Show photo ${dot + 1}`}
                aria-current={dot === index}
                className={`pointer-events-auto h-1.5 rounded-full transition-all duration-200 ${
                  dot === index ? 'w-5 bg-white' : 'w-1.5 bg-white/45 hover:bg-white/80'
                }`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}
