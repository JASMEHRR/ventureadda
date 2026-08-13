import { useCallback, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Clock, MessageCircle, SearchX, Star, UtensilsCrossed } from 'lucide-react'
import Button from '../components/ui/Button'
import ListRow from '../components/ui/ListRow'
import Modal from '../components/ui/Modal'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems, recordInquiry } from '../data/ventures'
import type { MenuItem, Venture } from '../data/ventures'
import { inquiryLink, inquiryMessage } from '../lib/whatsapp'

function PhotoGallery({ venture }: { venture: Venture }) {
  const [active, setActive] = useState(0)
  const photo = venture.photos[active]

  return (
    <div className="liquid-glass-panel rounded-3xl p-3">
      <img
        src={photo}
        alt={`${venture.name}, photo ${active + 1} of ${venture.photos.length}`}
        className="aspect-4/3 w-full rounded-2xl object-cover ring-1 ring-white/10 ring-inset"
      />
      {venture.photos.length > 1 && (
        <div className="mt-3 flex gap-2 px-1 pb-1">
          {venture.photos.map((src, index) => (
            <button
              key={src}
              type="button"
              onClick={() => setActive(index)}
              aria-label={`Show photo ${index + 1}`}
              aria-current={index === active}
              className={`h-14 w-14 shrink-0 overflow-hidden rounded-xl ring-1 transition duration-150 active:scale-[0.94] ${
                index === active ? 'ring-brand-400' : 'ring-white/10 hover:ring-white/30'
              }`}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function VentureDetail() {
  const { ventureId = '' } = useParams()
  const [pending, setPending] = useState<MenuItem | null>(null)
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])
  const menu = useAsyncData(() => listMenuItems(ventureId), [ventureId])

  /**
   * Counting on confirm rather than on the WhatsApp tap: the anchor navigates
   * away the moment it is activated, so anything queued behind it is a race.
   * Confirming is also the honest signal — it is the point the buyer decided.
   */
  const confirmInquiry = useCallback(async (item: MenuItem) => {
    const next = await recordInquiry(item.id)
    setLocalCounts((prev) => ({ ...prev, [item.id]: next }))
  }, [])

  if (venture.error || menu.error) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-red-400">
        Could not load this venture: {(venture.error ?? menu.error)?.message}
      </p>
    )
  }

  if (venture.loading) {
    return (
      <p className="px-1 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
        Loading venture…
      </p>
    )
  }

  if (!venture.data) {
    return (
      <div className="liquid-glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/35">
          <SearchX size={22} aria-hidden="true" />
        </span>
        <p className="mt-5 text-[17px] font-extrabold text-white">No such venture</p>
        <p className="mt-2 max-w-sm text-[14px] text-white/45">
          It may have been removed, or the link is wrong.
        </p>
        <Link
          to="/"
          className="mt-5 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 font-mono text-[11px] font-bold tracking-wider text-white/80 uppercase transition duration-150 hover:bg-white/10 hover:text-white"
        >
          Back to browse
        </Link>
      </div>
    )
  }

  const v = venture.data
  const waLink = pending ? inquiryLink(v.phone, v.name, pending.name) : null

  return (
    <div className="space-y-4">
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-full px-1 py-1 font-mono text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase transition-colors hover:text-white"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        All ventures
      </Link>

      <PhotoGallery venture={v} />

      <section className="liquid-glass-panel rounded-3xl p-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {v.rating !== null && (
            <span className="flex items-center gap-1.5 text-white/70">
              <Star size={13} aria-hidden="true" className="text-brand-400" />
              <span className="font-mono text-[13px] font-bold text-white">
                {v.rating.toFixed(1)}
              </span>
              <span className="text-[12px] text-white/40">({v.reviewCount} reviews)</span>
            </span>
          )}
          <span className="flex items-center gap-1.5 text-white/40">
            <Clock size={12} aria-hidden="true" />
            <span className="font-mono text-[10px] tracking-wider uppercase">{v.hours}</span>
          </span>
        </div>

        <p className="mt-3 text-[14.5px] leading-relaxed text-white/70">{v.description}</p>
        <p className="mt-3 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
          Run by {v.ownerName}
        </p>
      </section>

      <section className="space-y-3">
        <header className="flex items-baseline justify-between gap-3 px-1">
          <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Menu
          </h2>
          <span className="font-mono text-[10px] font-bold text-white/30">
            Tap an item to ask about it
          </span>
        </header>

        {menu.data?.length === 0 && (
          <p className="liquid-glass-panel rounded-2xl px-5 py-6 text-center text-[14px] text-white/45">
            This venture has not listed any items yet.
          </p>
        )}

        <div className="space-y-2.5">
          {menu.data?.map((item) => (
            <ListRow
              key={item.id}
              title={item.name}
              description={item.description}
              meta={`₹${item.price}`}
              thumbnail={item.photo}
              icon={item.photo ? undefined : UtensilsCrossed}
              actionIcon={MessageCircle}
              actionLabel={`Ask ${v.name} about this on WhatsApp`}
              onClick={() => setPending(item)}
            />
          ))}
        </div>
      </section>

      <p className="px-1 pb-2 text-center font-mono text-[9px] tracking-[0.18em] text-white/25 uppercase">
        Payment is settled directly with the seller
      </p>

      <Modal
        open={pending !== null}
        onClose={() => setPending(null)}
        title={`Message ${v.name} on WhatsApp?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPending(null)}>
              Cancel
            </Button>
            {waLink ? (
              <a
                href={waLink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => {
                  if (pending) void confirmInquiry(pending)
                  setPending(null)
                }}
                className="inline-flex items-center justify-center gap-2 rounded-full border border-whatsapp bg-whatsapp px-5 py-2.5 text-[12px] font-bold tracking-wider text-black uppercase transition duration-150 hover:bg-whatsapp/85 active:scale-[0.97]"
              >
                <MessageCircle size={13} aria-hidden="true" />
                Open WhatsApp
              </a>
            ) : (
              <Button variant="secondary" disabled>
                No number on file
              </Button>
            )}
          </>
        }
      >
        {pending && (
          <div className="space-y-3">
            <p className="text-[14px] leading-relaxed text-white/70">
              This opens WhatsApp with a message already written about{' '}
              <span className="font-bold text-white">{pending.name}</span>.
            </p>
            <p className="rounded-xl border border-white/8 bg-white/[0.03] px-4 py-3 text-[13.5px] leading-relaxed text-white/55 italic">
              {inquiryMessage(v.name, pending.name)}
            </p>
            <p className="font-mono text-[9px] tracking-[0.18em] text-white/30 uppercase">
              {(localCounts[pending.id] ?? pending.inquiryCount).toLocaleString('en-IN')} people have
              asked about this
            </p>
          </div>
        )}
      </Modal>
    </div>
  )
}
