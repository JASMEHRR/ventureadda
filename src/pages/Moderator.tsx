import { useCallback, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Check, Inbox, MessageCircle, MousePointerClick, Sprout, Store, X } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import Modal from '../components/ui/Modal'
import StatCard from '../components/ui/StatCard'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  createVenture,
  deleteVenture,
  listMenuItems,
  listVenturesByStatus,
  setVentureStatus,
} from '../data/ventures'
import type { Venture } from '../data/ventures'
import { categoryName } from '../data/types'
import { SEED_VENTURES } from '../data/seed'
import { displayUrl } from '../lib/cloudinary'

type Tab = 'pending' | 'live'

function VentureRow({
  venture,
  inquiries,
  children,
}: {
  venture: Venture
  inquiries?: number
  children: React.ReactNode
}) {
  return (
    <article className="liquid-glass-panel rounded-2xl p-4">
      <div className="flex items-start gap-3.5">
        {venture.photos[0] && (
          <img
            src={displayUrl(venture.photos[0], 400)}
            alt=""
            className="h-16 w-16 shrink-0 rounded-xl object-cover ring-1 ring-white/10 ring-inset"
          />
        )}
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[9px] tracking-[0.22em] text-white/30 uppercase">
            {categoryName(venture.categoryId)}
          </p>
          <h3 className="mt-1 truncate text-[16px] font-extrabold text-white">{venture.name}</h3>
          <p className="mt-0.5 truncate text-[13px] text-white/45">
            {venture.ownerUsername} · {venture.hours}
          </p>
          <p className="mt-2 line-clamp-2 text-[13px] leading-snug text-white/55">
            {venture.description}
          </p>

          <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="flex items-center gap-1.5 font-mono text-[10px] text-white/35">
              <MousePointerClick size={11} aria-hidden="true" />
              {venture.clickCount} opens
            </span>
            {inquiries !== undefined && (
              <span className="flex items-center gap-1.5 font-mono text-[10px] text-brand-400">
                <MessageCircle size={11} aria-hidden="true" />
                {inquiries} enquiries
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center gap-2.5 border-t border-white/8 pt-3.5">
        {children}
      </div>
    </article>
  )
}

export default function Moderator() {
  const { profile, status } = useAuth()
  const [tab, setTab] = useState<Tab>('pending')
  const [refreshToken, setRefreshToken] = useState(0)
  const [confirmDelete, setConfirmDelete] = useState<Venture | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(() => setRefreshToken((n) => n + 1), [])

  const pending = useAsyncData(() => listVenturesByStatus('pending'), [refreshToken])
  const live = useAsyncData(() => listVenturesByStatus('live'), [refreshToken])

  // Enquiry totals per venture, for the live tab. One read of the whole menu
  // collection is cheaper than one per venture at this size.
  const inquiries = useAsyncData(async () => {
    const ventures = await listVenturesByStatus('live')
    const totals: Record<string, number> = {}
    for (const venture of ventures) {
      const items = await listMenuItems(venture.id)
      totals[venture.id] = items.reduce((sum, item) => sum + item.inquiryCount, 0)
    }
    return totals
  }, [refreshToken])

  if (status === 'loading') {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  if (!profile?.isModerator) return <Navigate to="/" replace />

  const act = async (fn: () => Promise<void>, message: string) => {
    setBusy(true)
    setNotice(null)
    try {
      await fn()
      setNotice(message)
      refresh()
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'That did not work.')
    } finally {
      setBusy(false)
    }
  }

  const importSeed = () =>
    act(async () => {
      for (const entry of SEED_VENTURES) {
        const id = await createVenture(
          { uid: profile.uid, username: profile.username },
          entry.venture,
          entry.items,
        )
        // Seeded listings skip the queue: you are the moderator and you just
        // asked for them.
        await setVentureStatus(id, 'live')
      }
    }, `Imported ${SEED_VENTURES.length} demo ventures.`)

  const totalInquiries = Object.values(inquiries.data ?? {}).reduce((a, b) => a + b, 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
        <StatCard
          label="Pending"
          value={pending.data?.length ?? 0}
          unit="to review"
          icon={Inbox}
          accent="amber"
        />
        <StatCard
          label="Live"
          value={live.data?.length ?? 0}
          unit="listings"
          icon={Store}
          accent="neutral"
        />
        <StatCard
          label="Enquiries"
          value={totalInquiries}
          unit="taps"
          icon={MessageCircle}
          accent="brand"
        />
        <StatCard
          label="Opens"
          value={(live.data ?? []).reduce((sum, v) => sum + v.clickCount, 0)}
          unit="views"
          icon={MousePointerClick}
          accent="neutral"
        />
      </div>

      <div className="liquid-glass-panel flex gap-1.5 rounded-2xl p-1.5">
        {(['pending', 'live'] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            aria-current={tab === value ? 'true' : undefined}
            className={`flex-1 rounded-xl px-4 py-2.5 font-mono text-[11px] tracking-wider uppercase transition duration-150 active:scale-[0.98] ${
              tab === value
                ? 'bg-white/15 font-extrabold text-white'
                : 'font-bold text-white/40 hover:bg-white/[0.07] hover:text-white/85'
            }`}
          >
            {value === 'pending' ? `Pending (${pending.data?.length ?? 0})` : 'Live listings'}
          </button>
        ))}
      </div>

      {notice && (
        <p
          role="status"
          className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[13.5px] text-white/70"
        >
          {notice}
        </p>
      )}

      {tab === 'pending' && (
        <div className="space-y-2.5">
          {pending.error && (
            <p className="liquid-glass-panel rounded-2xl px-5 py-4 text-[14px] text-red-400">
              {pending.error.message}
            </p>
          )}
          {pending.data?.length === 0 && (
            <p className="liquid-glass-panel rounded-3xl px-6 py-12 text-center text-[14px] text-white/45">
              Nothing waiting. New submissions land here.
            </p>
          )}
          {pending.data?.map((venture) => (
            <VentureRow key={venture.id} venture={venture}>
              <Button
                variant="primary"
                disabled={busy}
                onClick={() => act(() => setVentureStatus(venture.id, 'live'), `${venture.name} is live.`)}
              >
                <Check size={13} aria-hidden="true" />
                Approve
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() =>
                  act(() => setVentureStatus(venture.id, 'rejected'), `${venture.name} rejected.`)
                }
              >
                <X size={13} aria-hidden="true" />
                Reject
              </Button>
              <Link
                to={`/venture/${venture.id}`}
                className="ml-auto font-mono text-[10px] tracking-wider text-white/40 uppercase transition hover:text-white"
              >
                Preview
              </Link>
            </VentureRow>
          ))}
        </div>
      )}

      {tab === 'live' && (
        <div className="space-y-2.5">
          {live.data?.length === 0 && (
            <EmptyState
              icon={Sprout}
              title="The directory is empty"
              action={
                <Button variant="secondary" loading={busy} onClick={importSeed}>
                  Import demo ventures
                </Button>
              }
            >
              An empty directory gets no submissions. Import the demo ventures to have something
              worth sharing, then replace them with real ones.
            </EmptyState>
          )}
          {live.data?.map((venture) => (
            <VentureRow
              key={venture.id}
              venture={venture}
              inquiries={inquiries.data?.[venture.id]}
            >
              <Button variant="secondary" to={`/venture/${venture.id}/edit`}>
                Edit
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => setConfirmDelete(venture)}
              >
                Remove
              </Button>
              <Link
                to={`/venture/${venture.id}`}
                className="ml-auto font-mono text-[10px] tracking-wider text-white/40 uppercase transition hover:text-white"
              >
                View
              </Link>
            </VentureRow>
          ))}
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Remove ${confirmDelete?.name ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busy}
              onClick={() => {
                const target = confirmDelete
                if (!target) return
                setConfirmDelete(null)
                void act(() => deleteVenture(target.id), `${target.name} removed.`)
              }}
            >
              Remove permanently
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-white/70">
          This deletes the listing and its whole menu, including the enquiry counts. It cannot be
          undone. Rejecting instead keeps the record and lets the owner fix it.
        </p>
      </Modal>
    </div>
  )
}
