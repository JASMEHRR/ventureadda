import { useState } from 'react'
import { ImageOff, Loader2, Search } from 'lucide-react'
import Button from './ui/Button'
import Modal from './ui/Modal'
import { inputClass } from './ui/TextField'
import { uploadImage } from '../lib/cloudinary'
import type { StoredImage } from '../data/types'

/**
 * Describe the thing, pick a photograph of it.
 *
 * For the seller who has forty items and no photographs — which is most of
 * them, because taking, cropping and uploading forty pictures between classes
 * is not a thing that happens. A blank tile says nothing about what is for
 * sale; a picture of a brownie says most of it.
 *
 * WHAT COMES BACK IS OPENLY LICENSED, and that is a product decision as much
 * as a legal one. See api/find-photos: pulling a photograph off a web search
 * and putting it on something you are selling is taking somebody's work. These
 * results are licensed for exactly this, on the condition that the creator is
 * named, so the credit travels with the picture and the venture page prints
 * it.
 *
 * It follows that this finds generic things well and specific branded ones
 * badly. Nobody has openly licensed a photograph of a particular energy drink.
 * The copy says so rather than letting a seller search four times and conclude
 * the feature is broken.
 */

type Candidate = {
  id: string
  url: string
  thumbnail: string
  title: string
  creator: string
  license: string
  source: string
}

export default function PhotoFinder({
  open,
  onClose,
  onPick,
  /** What the seller already typed as the item's name, as a starting point. */
  initialQuery = '',
}: {
  open: boolean
  onClose: () => void
  onPick: (image: StoredImage) => void
  initialQuery?: string
}) {
  const [query, setQuery] = useState(initialQuery)
  const [results, setResults] = useState<Candidate[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const search = async () => {
    const term = query.trim()
    if (term.length < 2) return
    setSearching(true)
    setError(null)
    try {
      const response = await fetch(`/api/find-photos?q=${encodeURIComponent(term)}`)
      const payload = (await response.json()) as { results?: Candidate[]; error?: string }
      if (!response.ok) throw new Error(payload.error ?? 'That search did not work.')
      setResults(payload.results ?? [])
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That search did not work.')
      setResults(null)
    } finally {
      setSearching(false)
    }
  }

  /**
   * Copies the chosen photograph onto our own Cloudinary account.
   *
   * Not a hotlink: a listing whose picture lives on somebody else's server
   * goes blank the day they move it, and this is a shop.
   *
   * THE BROWSER FETCHES THE BYTES rather than handing Cloudinary the address,
   * which was the first attempt and does not work: Wikimedia refuses fetchers
   * it does not recognise, so every pick came back "Error in loading". The
   * image host does send `Access-Control-Allow-Origin: *`, so the page itself
   * is allowed to read the file — and going through a real File means the
   * upload takes the same validated path as a photograph off the camera roll.
   */
  const choose = async (candidate: Candidate) => {
    setSaving(candidate.id)
    setError(null)
    try {
      const response = await fetch(candidate.url)
      if (!response.ok) throw new Error('That photo could not be downloaded.')
      const blob = await response.blob()
      const stored = await uploadImage(
        new File([blob], 'found-photo.jpg', { type: blob.type || 'image/jpeg' }),
      )
      onPick({
        ...stored,
        credit: {
          creator: candidate.creator,
          license: candidate.license,
          source: candidate.source,
        },
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that photo.')
    } finally {
      setSaving(null)
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Find a photo">
      <div className="space-y-4">
        <p className="text-[15.5px] leading-relaxed text-white/60">
          Describe the item and pick a picture. These come from a library of openly licensed
          photographs, so everyday things — brownies, cold coffee, earrings, stickers — turn up
          plenty. A particular brand of drink or a specific product will not: photograph those
          yourself.
        </p>

        <div className="flex gap-2">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              void search()
            }}
            maxLength={80}
            placeholder="Chocolate brownie"
            aria-label="Describe the item"
            className={inputClass}
          />
          <Button
            type="button"
            onClick={() => void search()}
            loading={searching}
            disabled={query.trim().length < 2}
            className="shrink-0"
          >
            <Search size={13} aria-hidden="true" />
            Search
          </Button>
        </div>

        {error && (
          <p role="alert" className="text-[15px] text-red-400">
            {error}
          </p>
        )}

        {searching && !results && (
          <p className="flex items-center gap-2 text-[15.5px] text-white/60">
            <Loader2 size={14} aria-hidden="true" className="animate-spin" />
            Looking…
          </p>
        )}

        {results?.length === 0 && (
          <p className="flex items-start gap-2 text-[15.5px] leading-relaxed text-white/60">
            <ImageOff size={15} aria-hidden="true" className="mt-0.5 shrink-0" />
            Nothing openly licensed matches that. Try plainer words — the thing itself rather than
            its brand, like &ldquo;energy drink&rdquo; instead of a name.
          </p>
        )}

        {results && results.length > 0 && (
          <div className="grid max-h-[46vh] grid-cols-2 gap-2.5 overflow-y-auto sm:grid-cols-3">
            {results.map((candidate) => (
              <button
                key={candidate.id}
                type="button"
                onClick={() => void choose(candidate)}
                disabled={saving !== null}
                title={candidate.title || undefined}
                className="group relative overflow-hidden rounded-xl ring-1 ring-white/10 transition duration-150 hover:ring-brand-400/60 focus-visible:ring-brand-400 disabled:opacity-50"
              >
                <img
                  src={candidate.thumbnail}
                  alt={candidate.title}
                  loading="lazy"
                  className="aspect-square w-full bg-white/[0.04] object-cover"
                />
                {/* The credit is on the tile before it is chosen, not only
                    after — somebody picking a photograph should be able to see
                    whose it is while they pick. */}
                <span className="absolute inset-x-0 bottom-0 truncate bg-black/70 px-2 py-1 text-left font-mono text-[11.5px] text-white/80">
                  {candidate.creator} · {candidate.license}
                </span>
                {saving === candidate.id && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/60">
                    <Loader2 size={18} aria-hidden="true" className="animate-spin text-white" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
