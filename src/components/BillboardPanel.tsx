import { useState } from 'react'
import { ChevronRight, Megaphone, Trash2 } from 'lucide-react'
import Button from './ui/Button'
import TextField from './ui/TextField'
import LoadingLine from './ui/LoadingLine'
import StockToggle from './ui/StockToggle'
import BillboardSlot from './BillboardSlot'
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
  const [itemQuery, setItemQuery] = useState('')
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
      setItemQuery('')
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
  const needle = itemQuery.trim().toLowerCase()
  const matchingItems = needle
    ? sellable.filter((item) => item.name.toLowerCase().includes(needle))
    : sellable
  const chosen = sellable.find((item) => item.id === itemId)

  const live = existing.filter((ad: Billboard) => ad.status === 'live' && !ad.paused).length

  return (
    /*
      SHUT UNTIL ASKED. This lives in an eighteen-rem rail beside a form people
      came here to fill in, and open it was four paragraphs and a search box
      standing between them and the save button. A seller who has no advert
      never needs to see any of it; one who has three wants the count, which is
      why it is in the summary.
    */
    <details className="liquid-glass-panel group rounded-3xl">
      <summary className="flex cursor-pointer items-center gap-2.5 rounded-3xl px-4 py-3.5 transition duration-150 hover:bg-white/[0.04] [&::-webkit-details-marker]:hidden">
        <ChevronRight
          size={14}
          aria-hidden="true"
          className="shrink-0 text-white/55 transition-transform duration-200 group-open:rotate-90"
        />
        <Megaphone size={13} aria-hidden="true" className="shrink-0 text-brand-400" />
        <span className="min-w-0 flex-1">
          <span className="block font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Billboard
          </span>
          <span className="mt-0.5 block text-[14.5px] text-white/55">
            {existing.length === 0
              ? 'Advertise something on the front page.'
              : `${existing.length} advert${existing.length === 1 ? '' : 's'}${live > 0 ? `, ${live} up` : ''}.`}
          </span>
        </span>
      </summary>

      <div className="space-y-4 px-4 pt-1 pb-4">
        <p className="text-[15.5px] leading-relaxed text-white/55">
          One advert sits across the top of the front page, and every venture takes turns in it.
          Put up as many as you like &mdash; the turn belongs to your venture, so several adverts
          means more to say rather than more time on the board. A moderator reads each one first.
        </p>

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
        <div className="space-y-4 border-t border-white/8 pt-4">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/55 uppercase">
                What are you advertising
              </p>

              {/*
                NOT A <select>. The native one draws its popup in the operating
                system's own colours -- a white list, carrying this app's white
                text -- so on a dark theme every option was invisible and the
                control looked broken. It also cannot be searched, and there is
                a venture on this site with a hundred and fifty items in it.

                A filtered list of buttons is the same choice, made visible.
              */}
              <input
                type="search"
                value={itemQuery}
                onChange={(event) => setItemQuery(event.target.value)}
                placeholder="Search your items..."
                aria-label="Search your items"
                className="w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-[16px] text-white placeholder:text-white/35"
              />

              <div
                role="radiogroup"
                aria-label="The item this advert is for"
                className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-white/8 bg-white/[0.02] p-1.5"
              >
                {matchingItems.length === 0 ? (
                  <p className="px-2.5 py-3 text-[15px] text-white/50">
                    {sellable.length === 0
                      ? 'Add an item to your menu first, then you can advertise it.'
                      : 'Nothing on your menu matches that.'}
                  </p>
                ) : (
                  matchingItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      role="radio"
                      aria-checked={itemId === item.id}
                      onClick={() => setItemId(item.id)}
                      className={`flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition duration-150 ${
                        itemId === item.id
                          ? 'bg-brand-500/20 text-brand-200'
                          : 'text-white/75 hover:bg-white/[0.06]'
                      }`}
                    >
                      <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">
                        {item.name}
                      </span>
                      <span className="shrink-0 font-mono text-[13px] text-white/50">
                        {typeof item.price === 'number' ? `₹${item.price}` : 'Ask'}
                      </span>
                    </button>
                  ))
                )}
              </div>
            </div>

            <TextField
              id="billboard-pitch"
              label="The line people read"
              value={pitch}
              onChange={(event) => setPitch(event.target.value)}
              maxLength={PITCH_LIMIT}
              placeholder="Handmade crochet roses, made to order this week"
              hint={`${pitch.length}/${PITCH_LIMIT}. The whole advert, so make it the reason to tap. **bold** and *italic* work, the same as WhatsApp.`}
            />

            <TextField
              id="billboard-offer"
              label="The offer, if there is one"
              value={offer}
              onChange={(event) => setOffer(event.target.value)}
              maxLength={OFFER_LIMIT}
              placeholder="30% off"
              hint="Optional. A price cut or a deal, in a few words."
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

          {/*
            A LIVE PREVIEW, because a seller writing ninety characters for the
            front page of a site whose front page they may never have looked at
            is writing blind. This is the real BillboardSlot drawn from what
            they have typed so far, so the thing being decided is on the screen
            during the deciding — and if the component changes, this changes
            with it rather than drifting into a lie.
          */}
          <div className="space-y-2.5">
            <p className="font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/55 uppercase">
              How it will look
            </p>
            <BillboardSlot
              preview
              ad={{
                id: 'preview',
                ventureId: venture.id,
                ventureName: venture.name,
                ventureSlug: venture.slug ?? '',
                ownerId,
                itemId: chosen?.id ?? '',
                itemName: chosen?.name ?? 'Your item',
                photo: chosen?.photo,
                pitch: pitch.trim() || 'Your line goes here',
                offer: offer.trim(),
                status: 'live',
                rejectionReason: '',
                paused: false,
                createdAt: null,
              }}
            />
            <p className="text-[14.5px] leading-relaxed text-white/50">
              It carries the item&rsquo;s own photo. Adverts take turns by venture, so putting up
              several gives you more to say rather than more time on the board.
            </p>
          </div>
        </div>
      )}
      </div>
    </details>
  )
}
