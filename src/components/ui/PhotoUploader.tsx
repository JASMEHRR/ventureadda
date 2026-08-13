import { useRef, useState } from 'react'
import { ImagePlus, Loader2, X } from 'lucide-react'
import { ACCEPT_ATTRIBUTE, displayUrl, uploadImage } from '../../lib/cloudinary'
import type { StoredImage } from '../../data/types'

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
      <span className="mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
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
            <button
              type="button"
              onClick={() => onChange(photos.filter((_, i) => i !== index))}
              aria-label={`Remove photo ${index + 1}`}
              className="absolute -top-2 -right-2 rounded-full border border-white/15 bg-surface p-1 text-white/70 transition duration-150 hover:bg-red-500/25 hover:text-red-300 active:scale-[0.9]"
            >
              <X size={12} aria-hidden="true" />
            </button>
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
            <span className="font-mono text-[9px] tracking-wider uppercase">
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

      {hint && !error && <p className="mt-1.5 text-[12.5px] text-white/35">{hint}</p>}
      {error && (
        <p role="alert" className="mt-1.5 text-[12.5px] text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
