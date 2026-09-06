import { useState } from 'react'
import { Megaphone, Trash2 } from 'lucide-react'
import Button from './ui/Button'
import TextField from './ui/TextField'
import LoadingLine from './ui/LoadingLine'
import StockToggle from './ui/StockToggle'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  BILLBOARD_STATUS_LABEL,
  OFFER_LIMIT,
  PITCH_LIMIT,
  deleteBillboard,
  listBillboardsForVenture,
  setBillboardPaused,
  submitBillboard,
} from '../data/billboard'
import type { Billboard, BillboardStatus } from '../data/billboardPick'
import type { MenuItem, Venture } from '../data/types'

const STATUS_STYLE: Record<BillboardStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  live: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  rejected: 'border-red-500/30 bg-red-500/15 text-red-400',
}

/**
 * Where a seller asks for the front page.
 *
 * ON THE VENTURE'S EDIT PAGE rather than in a corner of the site of its own,
 * because this is a thing you do about a listing while you are looking at that
 * listing, and a separate page is a page nobody finds. It sits below the form
 * and saves independently of it: an advert is submitted, not edited into
 * existence alongside twenty menu items.
 *
 * IT SAYS WHAT WILL HAPPEN, in the panel, before they write anything. A seller
 * who submits and then sees nothing appear will assume the site is broken; the
 * one who was told a moderator has to approve it will wait. Half of what this
 * component does is manage that expectation.
 */
export default function BillboardPanel({
  venture,
  items,
  ownerId,
}: {
  venture: Pick<Venture, 'id' | 'name' | 'slug' | 'status'>
  items: MenuItem[]
  ownerId: string
}) {
  const [refreshToken, setRefreshToken] = useState(0)
  const [itemId, setItemId] = useState('')
  const [pitch, setPitch] = useState('')
  const [offer, setOffer] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const ads = useAsyncData(
    () => listBillboardsForVenture(venture.id),
    [venture.id, refreshToken],
  )

  const refresh = () => setRefreshToken((n) => n + 1)

  const submit = async () => {
    const chosen = items.find((item) => item.id === itemId)
    if (!chosen) {
      setError('Pick which item the advert is for.')
      return
    }
    if (pitch.trim() === '') {
      setError('Write the line people will read on the front page.')
      return
    }
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      await submitBillboard({
        ventureId: venture.id,
        ventureName: venture.name,
        ventureSlug: venture.slug ?? '',
        ownerId,
        itemId: chosen.id,
        itemName: chosen.name,
        photo: chosen.photo,
        pitch,
        offer,
      })
      setPitch('')
      setOffer('')
      setItemId('')
      setNotice('Sent for approval. It goes up once a moderator has read it.')
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not send that.')
    } finally {
      setBusy(false)
    }
  }

  const act = async (fn: () => Promise<void>) => {
    setBusy(true)
    setError(null)
    try {
      await fn()
      refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const existing = ads.data ?? []
  const sellable = items.filter((item) => item.name.trim() !== '')

  return (
    <section className="liquid-glass-panel space-y-4 rounded-3xl p-5">
      <header>
        <h2 className="flex items-center gap-2 font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          <Megaphone size={13} aria-hidden="true" />
          Billboard
        </h2>
        <p className="mt-2 text-[16px] leading-relaxed text-white/55">
          One advert sits across the top of the front page, and every venture on the site takes
          turns in it. Pick something of yours, write the line, and a moderator reads it before it
          goes up.
        </p>
      </header>

      {venture.status !== 'live' && (
        <p className="rounded-2xl bg-white/[0.04] px-4 py-3 text-[15.5px] leading-relaxed text-white/60">
          Your listing has to be approved before you can advertise it.
        </p>
      )}

      {ads.loading && !ads.data && <LoadingLine label="Loading your adverts…" />}

      {existing.length > 0 && (
        <ul className="space-y-2.5">
          {existing.map((ad: Billboard) => (
            <li
              key={ad.id}
              className="space-y-2 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="min-w-0 flex-1 text-[16px] leading-snug font-bold text-white">
                  {ad.pitch}
                </p>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[12px] font-bold tracking-wider uppercase ${STATUS_STYLE[ad.status]}`}
                >
                  {BILLBOARD_STATUS_LABEL[ad.status]}
                </span>
              </div>

              <p className="font-mono text-[12.5px] tracking-wider text-white/50 uppercase">
                {ad.itemName}
                {ad.offer && ` · ${ad.offer}`}
              </p>

              {ad.status === 'rejected' && ad.rejectionReason && (
                <p className="text-[15px] leading-relaxed text-red-300">{ad.rejectionReason}</p>
              )}

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {/* Pausing needs no re-approval: nothing the moderator agreed
                    to has changed. Only shown once it is actually up, since
                    pausing something nobody can see is a control with no
                    meaning. */}
                {ad.status === 'live' && (
                  <StockToggle
                    value={!ad.paused}
                    onChange={(next) => void act(() => setBillboardPaused(ad.id, !next))}
                    label={`${ad.itemName} advert`}
                    onText="Running"
                    offText="Paused"
                  />
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void act(() => deleteBillboard(ad.id))}
                  className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-bold text-white/45 transition duration-150 hover:bg-white/[0.06] hover:text-white/70 active:scale-[0.96] disabled:opacity-50"
                >
                  <Trash2 size={13} aria-hidden="true" />
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {venture.status === 'live' && (
        <div className="space-y-3 border-t border-white/8 pt-4">
          <div>
            <label
              htmlFor="billboard-item"
              className="mb-1.5 block font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/55 uppercase"
            >
              What are you advertising
            </label>
            <select
              id="billboard-item"
              value={itemId}
              onChange={(event) => setItemId(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white"
            >
              <option value="">Pick one of your items…</option>
              {sellable.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>

          <TextField
            id="billboard-pitch"
            label="The line people read"
            value={pitch}
            onChange={(event) => setPitch(event.target.value)}
            maxLength={PITCH_LIMIT}
            placeholder="Handmade crochet roses, made to order this week"
            hint={`${pitch.length}/${PITCH_LIMIT}. This is the whole advert, so make it the reason to tap.`}
          />

          <TextField
            id="billboard-offer"
            label="The offer, if there is one"
            value={offer}
            onChange={(event) => setOffer(event.target.value)}
            maxLength={OFFER_LIMIT}
            placeholder="30% off"
            hint="Optional. A price cut or a deal, in a few words. Leave it empty if the advert is not about a price."
          />

          {error && (
            <p role="alert" className="text-[15.5px] leading-relaxed text-red-400">
              {error}
            </p>
          )}
          {notice && <p className="text-[15.5px] leading-relaxed text-brand-300">{notice}</p>}

          <Button onClick={() => void submit()} loading={busy}>
            Send for approval
          </Button>
        </div>
      )}
    </section>
  )
}
