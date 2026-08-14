import { useRef, useState } from 'react'
import { Camera, Loader2 } from 'lucide-react'
import Button from './ui/Button'
import { SCAN_ACCEPT, extractMenu } from '../lib/extractMenu'
import type { ExtractedItem } from '../lib/extractMenu'

/**
 * Photograph a menu instead of typing it.
 *
 * The extracted items never go anywhere near Firestore from here. They are
 * handed back to the form as ordinary drafts, pre-filled in the same fields
 * anyone would have typed into, and the owner confirms them by submitting the
 * form as usual. That is deliberate and not negotiable: extraction gets prices
 * wrong, and a wrong price is worse than no price, because a buyer turns up
 * expecting it.
 *
 * Typing by hand is always available and is never blocked by anything here.
 * Every failure state below ends by pointing back to it.
 */
export default function MenuScanner({ onExtracted }: { onExtracted: (items: ExtractedItem[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setNote(null)
    setBusy(true)
    try {
      const items = await extractMenu(file)
      onExtracted(items)
      setNote(
        `Added ${items.length} ${items.length === 1 ? 'item' : 'items'}. Check every price before you submit.`,
      )
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scanning failed. Type the items in.')
    } finally {
      setBusy(false)
      // Clearing lets the same file be picked again after a failure.
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
            Scan a menu
          </p>
          <p className="mt-1 text-[12.5px] text-white/45">
            Photograph your menu or price list and we will fill these fields in for you.
          </p>
        </div>
        <Button
          variant="secondary"
          loading={busy}
          onClick={() => inputRef.current?.click()}
          className="shrink-0"
        >
          {busy ? <Loader2 size={13} aria-hidden="true" className="animate-spin" /> : <Camera size={13} aria-hidden="true" />}
          {busy ? 'Reading' : 'Scan photo'}
        </Button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={SCAN_ACCEPT}
        // Deliberately no `capture` attribute. It forces the camera open on
        // Android and removes the gallery option, and most owners already have
        // a photo of their menu saved rather than the menu in front of them.
        className="sr-only"
        onChange={(event) => void handleFile(event.target.files?.[0])}
      />

      {busy && (
        <p role="status" className="mt-2.5 text-[12.5px] text-white/45">
          Reading the photo. This takes a few seconds.
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2.5 text-[12.5px] text-red-400">
          {error}
        </p>
      )}
      {note && !error && (
        <p role="status" className="mt-2.5 text-[12.5px] text-brand-300">
          {note}
        </p>
      )}
    </div>
  )
}
