import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { Inbox, MapPin, MessageCircle, Phone, Clock, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import Modal from '../components/ui/Modal'
import PushToggle from '../components/PushToggle'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  ORDER_STATUS_LABEL,
  PAYMENT_LABEL,
  deleteOrder,
  listOrdersForOwner,
  markOrdersSeen,
  setOrderStatus,
} from '../data/orders'
import type { Order, OrderStatus } from '../data/orders'
import { sellerReplyLink } from '../lib/whatsapp'

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  paid: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  completed: 'border-white/15 bg-white/[0.06] text-white/50',
}

/** The order a seller moves an order through, and what the next step is called. */
const NEXT: Record<OrderStatus, { to: OrderStatus; label: string } | null> = {
  pending: { to: 'paid', label: 'Mark paid' },
  paid: { to: 'completed', label: 'Mark completed' },
  completed: null,
}

function when(date: Date | null): string {
  if (!date) return 'Just now'
  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function OrderCard({
  order,
  busy,
  onStatus,
  onDelete,
}: {
  order: Order
  busy: boolean
  onStatus: (status: OrderStatus) => void
  onDelete: () => void
}) {
  const next = NEXT[order.status]

  /**
   * The seller's side of the same wa.me link the buyer gets, with the order
   * already written out — pre-addressed to the buyer's number so "please
   * contact them" is one tap rather than copying digits into WhatsApp by hand.
   * Null when the buyer's number will not make a valid link, in which case the
   * number is still printed above for them to dial.
   */
  const reply = sellerReplyLink(
    order.buyerPhone,
    order.ventureName,
    order.lines.map(({ name, price, quantity }) => ({ name, price, quantity })),
    order.buyerName,
  )

  return (
    <article
      className={`liquid-glass-panel space-y-3 rounded-2xl p-4 ${
        order.seen ? '' : 'ring-1 ring-brand-400/40'
      }`}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[15px] font-bold text-white">
            {order.buyerName}
            {!order.seen && (
              <span className="ml-2 rounded-full bg-brand-500/25 px-2 py-0.5 align-middle font-mono text-[9px] font-bold tracking-wider text-brand-300 uppercase">
                New
              </span>
            )}
          </p>
          <p className="font-mono text-[10px] tracking-wider text-white/35 uppercase">
            {when(order.createdAt)} · {order.ventureName}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[9px] font-bold tracking-wider uppercase ${STATUS_STYLE[order.status]}`}
        >
          {ORDER_STATUS_LABEL[order.status]}
        </span>
      </header>

      <ul className="space-y-1">
        {order.lines.map((line) => (
          <li key={line.itemId + line.name} className="flex items-baseline gap-2 text-[13.5px]">
            <span className="font-mono font-bold text-brand-400">{line.quantity}×</span>
            <span className="min-w-0 flex-1 truncate text-white/80">{line.name}</span>
            <span className="shrink-0 font-mono text-[12.5px] text-white/45">
              ₹{line.price * line.quantity}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
        <span className="font-mono text-[9px] font-bold tracking-[0.18em] text-white/35 uppercase">
          {PAYMENT_LABEL[order.payment]}
        </span>
        <span className="font-mono text-[15px] font-extrabold text-brand-400">₹{order.total}</span>
      </div>

      <dl className="space-y-1.5 border-t border-white/8 pt-2.5 text-[13px]">
        <div className="flex items-start gap-2">
          <dt className="sr-only">Deliver to</dt>
          <MapPin size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden="true" />
          <dd className="min-w-0 flex-1 text-white/70">{order.deliveryAddress}</dd>
        </div>
        {order.deliverySlot && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Time</dt>
            <Clock size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden="true" />
            <dd className="min-w-0 flex-1 text-white/70">{order.deliverySlot}</dd>
          </div>
        )}
        <div className="flex items-start gap-2">
          <dt className="sr-only">Phone</dt>
          <Phone size={13} className="mt-0.5 shrink-0 text-white/30" aria-hidden="true" />
          <dd className="min-w-0 flex-1">
            {/* A real tel: link. On the phone this seller is almost certainly
                reading this on, that is the whole interaction. */}
            <a
              href={`tel:+${order.buyerPhone}`}
              className="font-mono text-white/70 underline decoration-white/20 underline-offset-2 transition hover:text-white"
            >
              +{order.buyerPhone}
            </a>
            {order.contactPreference === 'sellerContacts' && (
              <span className="ml-2 text-[12px] text-amber-400">Asked you to call them</span>
            )}
          </dd>
        </div>
      </dl>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        {next && (
          <Button variant="primary" loading={busy} onClick={() => onStatus(next.to)}>
            {next.label}
          </Button>
        )}
        {/* Always available, so a status set by mistake is one tap to undo
            rather than a dead end at "completed". */}
        {order.status !== 'pending' && (
          <Button variant="ghost" disabled={busy} onClick={() => onStatus('pending')}>
            Back to pending
          </Button>
        )}
        {reply && (
          <Button variant="whatsapp" href={reply} target="_blank" rel="noopener noreferrer">
            <MessageCircle size={13} aria-hidden="true" />
            Message
          </Button>
        )}
        <button
          type="button"
          onClick={onDelete}
          disabled={busy}
          aria-label={`Delete the order from ${order.buyerName}`}
          className="ml-auto rounded-full border border-white/10 bg-white/5 p-1.5 text-white/35 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94] disabled:opacity-40"
        >
          <Trash2 size={13} aria-hidden="true" />
        </button>
      </div>
    </article>
  )
}

/**
 * Everything anyone has ordered from every venture this account owns.
 *
 * WHY THIS IS THE NOTIFICATION. There is no email and no push: Firebase is on
 * the Spark plan so there are no Cloud Functions, and sending mail to arbitrary
 * sellers needs a verified sending domain this project does not have yet. So
 * the ping is the unread count in the nav and the ring around a new order
 * here. That is honest about what it is — a seller who never opens the site
 * does not find out — and it is why the checkout tells buyers to message the
 * seller as well rather than promising them the seller has been alerted.
 */
export default function Orders() {
  const { profile, status } = useAuth()
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<Order | null>(null)
  const [refreshToken, setRefreshToken] = useState(0)
  /** Applied over the fetched list so a status change shows before the refetch. */
  const [overrides, setOverrides] = useState<Record<string, OrderStatus>>({})
  const [removed, setRemoved] = useState<string[]>([])

  const fetched = useAsyncData(
    () => (profile ? listOrdersForOwner(profile.uid) : Promise.resolve([])),
    [profile?.uid, refreshToken],
  )

  const orders = useMemo(
    () =>
      (fetched.data ?? [])
        .filter((order) => !removed.includes(order.id))
        .map((order) =>
          overrides[order.id] ? { ...order, status: overrides[order.id] } : order,
        ),
    [fetched.data, overrides, removed],
  )

  /**
   * Clear the unread flags for whatever was on screen.
   *
   * Keyed on the id list rather than on the orders themselves: this runs after
   * the write completes, the refetch that follows produces new objects with
   * seen: true, and depending on those would loop. Fire-and-forget by design —
   * markOrdersSeen swallows its own failures, because a badge that will not
   * clear is not worth an error over the orders the seller came to read.
   */
  const unseenIds = (fetched.data ?? [])
    .filter((order) => !order.seen)
    .map((order) => order.id)
    .join(',')

  useEffect(() => {
    if (!unseenIds) return
    void markOrdersSeen(unseenIds.split(','))
  }, [unseenIds])

  if (status === 'loading') return <LoadingLine label="Loading orders…" />
  if (status === 'signedOut') return <Navigate to="/signin" replace />
  if (!profile) {
    return <ChooseUsername reason="Orders are filed against your listings, so pick a name first." />
  }

  const changeStatus = async (order: Order, next: OrderStatus) => {
    setBusyId(order.id)
    setError(null)
    try {
      await setOrderStatus(order.id, next)
      setOverrides((prev) => ({ ...prev, [order.id]: next }))
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not update that order.')
    } finally {
      setBusyId(null)
    }
  }

  const remove = async () => {
    const target = confirmDelete
    if (!target) return
    setBusyId(target.id)
    setError(null)
    try {
      await deleteOrder(target.id)
      setRemoved((prev) => [...prev, target.id])
      setConfirmDelete(null)
      setRefreshToken((n) => n + 1)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete that order.')
    } finally {
      setBusyId(null)
    }
  }

  const open = orders.filter((order) => order.status !== 'completed')
  const done = orders.filter((order) => order.status === 'completed')

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <header className="liquid-glass-panel rounded-3xl px-5 py-4">
        <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Orders
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-white/50">
          Everything ordered from your listings. No money moves through this site, so these
          statuses are your own record: what you have been paid, and what you have handed over.
        </p>
      </header>

      <PushToggle uid={profile.uid} />

      {fetched.error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-4 text-[14px] text-red-400">
          Could not load your orders: {fetched.error.message}
        </p>
      )}

      {error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[13.5px] text-red-400">
          {error}
        </p>
      )}

      {!fetched.data && !fetched.error && <LoadingLine label="Loading orders…" />}

      {fetched.data && orders.length === 0 && (
        <EmptyState icon={Inbox} title="No orders yet">
          Orders land here with the buyer's number and where to take it.
        </EmptyState>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
            Open · {open.length}
          </h3>
          {open.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={busyId === order.id}
              onStatus={(next) => void changeStatus(order, next)}
              onDelete={() => setConfirmDelete(order)}
            />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
            Completed · {done.length}
          </h3>
          {done.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              busy={busyId === order.id}
              onStatus={(next) => void changeStatus(order, next)}
              onDelete={() => setConfirmDelete(order)}
            />
          ))}
        </section>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title={`Delete the order from ${confirmDelete?.buyerName ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              loading={busyId === confirmDelete?.id}
              onClick={() => void remove()}
            >
              Delete permanently
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-white/70">
          This removes your only record of what they asked for and how to reach them. The buyer is
          not told. Use it for pranks and duplicates, not for orders you have finished — mark those
          completed instead.
        </p>
      </Modal>
    </div>
  )
}
