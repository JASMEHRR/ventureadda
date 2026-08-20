import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, ImagePlus, Loader2, X } from 'lucide-react'
import { ACCEPT_ATTRIBUTE, displayUrl, uploadImage } from '../../lib/cloudinary'
import type { StoredImage } from '../../data/types'

/**
 * Two photos exchanged, as a new array. Out-of-range targets return the list
 * untouched rather than throwing — the buttons are disabled at both ends, but
 * a guard here means the ends stay safe wherever this is called from.
 */
function swap(photos: StoredImage[], from: number, to: number): StoredImage[] {
  if (to < 0 || to >= photos.length || from < 0 || from >= photos.length) return photos
  const next = [...photos]
  next[from] = photos[to]
  next[to] = photos[from]
  return next
}

type PhotoUploaderProps = {
  label: string
  hint?: string
  photos: StoredImage[]
  onChange: (photos: StoredImage[]) => void
  max?: number
}

/**
 * Uploads straight from the browser to Cloudinary, because Firebase Storage
 * needs the paid plan.
 *
 * Removing a photo drops it from the venture but leaves the Cloudinary asset
 * in place — deletion needs the API secret, which must never reach frontend
 * code. Orphans are a housekeeping job in the Cloudinary console.
 *
 * ORDER IS MEANINGFUL, so it is editable. Photo one is the cover: it is the
 * slide the browse card opens on, the first thing in the carousel, and the
 * only photo most visitors will look at. Every photo is cropped to the same
 * 4:3 box so a grid of cards stays a grid, which means a portrait shot loses
 * its top and bottom — and the answer to a crop the owner does not like is
 * letting them lead with a different photo, not letting one listing set its
 * own height. Arrows rather than drag and drop: two buttons work with a
 * keyboard, a screen reader and a thumb, and drag and drop reliably does none
 * of the three without a library this project does not need.
 */
export default function PhotoUploader({
  label,
  hint,
  photos,
  onChange,
  max = 4,
}: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const atLimit = photos.length >= max

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    setError(null)
    setBusy(true)
    const room = max - photos.length
    const chosen = [...files].slice(0, room)
    const uploaded: StoredImage[] = []
    try {
      for (const file of chosen) {
        uploaded.push(await uploadImage(file))
      }
      // Commit whatever succeeded even if a later one failed, so a bad third
      // file does not throw away two good uploads.
      if (uploaded.length > 0) onChange([...photos, ...uploaded])
    } catch (cause) {
      if (uploaded.length > 0) onChange([...photos, ...uploaded])
      setError(cause instanceof Error ? cause.message : 'Upload failed.')
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div>
      <span className="mb-1.5 block font-mono text-[11px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
        {label}
      </span>

      <div className="flex flex-wrap gap-2.5">
        {photos.map((image, index) => (
          <div key={image.url + index} className="relative">
            <img
              src={displayUrl(image, 400)}
              alt=""
              className="h-20 w-20 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
            />
            {/* Only when there is an order to have. One photo is not a cover,
                it is the photo. */}
            {photos.length > 1 && index === 0 && (
              <span className="absolute top-1 left-1 rounded-full bg-brand-500/90 px-1.5 py-0.5 font-mono text-[11px] font-extrabold tracking-wider text-app uppercase">
                Cover
              </span>
            )}
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, i) => i !== index))}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -top-2 -right-2 rounded-full border border-white/15 bg-surface p-1 text-white/70 transition duration-150 hover:bg-red-500/25 hover:text-red-300 active:scale-[0.9]"
            >
              <X size={12} aria-hidden="true" />
            </button>

            {photos.length > 1 && (
              <span className="absolute inset-x-0 bottom-0 flex justify-between rounded-b-xl bg-black/65 px-0.5 py-0.5">
                <button
                  type="button"
                  onClick={() => onChange(swap(photos, index, index - 1))}
                  disabled={index === 0}
                  aria-label={
                    index === 1
                      ? `Make photo ${index + 1} the cover`
                      : `Move photo ${index + 1} earlier`
                  }
                  className="rounded-md p-0.5 text-white/80 transition duration-150 hover:bg-white/20 active:scale-[0.9] disabled:opacity-25"
                >
                  <ChevronLeft size={13} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => onChange(swap(photos, index, index + 1))}
                  disabled={index === photos.length - 1}
                  aria-label={`Move photo ${index + 1} later`}
                  className="rounded-md p-0.5 text-white/80 transition duration-150 hover:bg-white/20 active:scale-[0.9] disabled:opacity-25"
                >
                  <ChevronRight size={13} aria-hidden="true" />
                </button>
              </span>
            )}
          </div>
        ))}

        {!atLimit && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            className="liquid-glass-input flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl text-white/40 transition duration-150 hover:text-white/80 active:scale-[0.96] disabled:opacity-50"
          >
            {busy ? (
              <Loader2 size={18} aria-hidden="true" className="animate-spin" />
            ) : (
              <ImagePlus size={18} aria-hidden="true" />
            )}
            <span className="font-mono text-[11px] tracking-wider uppercase">
              {busy ? 'Sending' : 'Add'}
            </span>
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_ATTRIBUTE}
        multiple={max > 1}
        className="sr-only"
        onChange={(event) => void handleFiles(event.target.files)}
      />

      {hint && !error && <p className="mt-1.5 text-[14px] text-white/35">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[14px] text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
