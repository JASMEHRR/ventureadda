import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { Clock, MapPin, MessageCircle, PackageSearch, Phone, Trash2 } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import LoadingLine from '../components/ui/LoadingLine'
import Modal from '../components/ui/Modal'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { hideOrderForBuyer, listOrdersForBuyer } from '../data/orders'
import type { Order, OrderStatus } from '../data/orders'
import { PAYMENT_LABEL } from '../data/types'

/**
 * The buyer's side of an order.
 *
 * A SEPARATE PAGE FROM /orders, not a filter on it. That page is a seller's
 * workbench — mark paid, mark completed, delete a prank — and none of those
 * actions is the buyer's to take. What a buyer needs is the opposite: where it
 * stands, who to chase, and the number to chase them on. Sharing one page
 * would mean every row carrying buttons half its readers must never press.
 *
 * The statuses here are the seller's own notes, so the wording says so.
 * "Payment received" on a dashboard the seller controls means the seller
 * ticked a box, and a buyer reading it as proof of anything would be reading
 * more into it than exists.
 */

const STATUS_STYLE: Record<OrderStatus, string> = {
  pending: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  paid: 'border-brand-500/30 bg-brand-500/15 text-brand-300',
  completed: 'border-white/15 bg-white/[0.06] text-white/50',
}

/** What each status means from this side of the transaction. */
const BUYER_STATUS: Record<OrderStatus, { label: string; detail: string }> = {
  pending: {
    label: 'Placed',
    detail: 'The seller has it. They mark it paid once they have your money.',
  },
  paid: {
    label: 'Paid',
    detail: 'The seller has marked your payment received.',
  },
  completed: {
    label: 'Completed',
    detail: 'The seller has marked this handed over.',
  },
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

function OrderCard({ order, onRemove }: { order: Order; onRemove: () => void }) {
  const state = BUYER_STATUS[order.status]

  // NO WHATSAPP BUTTON HERE, deliberately. The seller's number is not on the
  // order document — only the buyer's is — so a wa.me link built from what is
  // here would open a chat with the buyer themselves. Reading the venture for
  // its number would be one extra billed read per row on a page whose whole
  // job is a list. The listing link goes to where that number already is.
  return (
    <article className="liquid-glass-panel space-y-3 rounded-2xl p-4">
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <Link
            to={`/venture/${order.ventureId}`}
            className="text-[17px] font-bold text-white transition-colors hover:text-brand-300"
          >
            {order.ventureName}
          </Link>
          <p className="font-mono text-[13px] tracking-wider text-white/55 uppercase">
            {when(order.createdAt)}
          </p>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-wider uppercase ${STATUS_STYLE[order.status]}`}
        >
          {state.label}
        </span>
      </header>

      <ul className="space-y-1">
        {order.lines.map((line) => (
          <li key={line.itemId + line.name} className="flex items-baseline gap-2 text-[16px]">
            <span className="font-mono font-bold text-brand-400">{line.quantity}×</span>
            <span className="min-w-0 flex-1 truncate text-white/80">{line.name}</span>
            <span className="shrink-0 font-mono text-[15px] text-white/60">
              ₹{line.price * line.quantity}
            </span>
          </li>
        ))}
      </ul>

      <div className="flex items-center justify-between border-t border-white/8 pt-2.5">
        <span className="font-mono text-[12.5px] font-bold tracking-[0.18em] text-white/55 uppercase">
          {PAYMENT_LABEL[order.payment]}
        </span>
        <span className="font-mono text-[17px] font-extrabold text-brand-400">₹{order.total}</span>
      </div>

      <dl className="space-y-1.5 border-t border-white/8 pt-2.5 text-[15.5px]">
        <div className="flex items-start gap-2">
          <dt className="sr-only">Going to</dt>
          <MapPin size={13} className="mt-0.5 shrink-0 text-white/55" aria-hidden="true" />
          <dd className="min-w-0 flex-1 text-white/70">{order.deliveryAddress}</dd>
        </div>
        {order.deliverySlot && (
          <div className="flex items-start gap-2">
            <dt className="sr-only">Time</dt>
            <Clock size={13} className="mt-0.5 shrink-0 text-white/55" aria-hidden="true" />
            <dd className="min-w-0 flex-1 text-white/70">{order.deliverySlot}</dd>
          </div>
        )}
        <div className="flex items-start gap-2">
          <dt className="sr-only">They will reach you on</dt>
          <Phone size={13} className="mt-0.5 shrink-0 text-white/55" aria-hidden="true" />
          <dd className="min-w-0 flex-1 font-mono text-white/70">+{order.buyerPhone}</dd>
        </div>
      </dl>

      <p className="text-[15px] leading-relaxed text-white/60">{state.detail}</p>

      <div className="flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">
        {order.status !== 'completed' && (
          <Button variant="secondary" to={`/venture/${order.ventureId}`}>
            <MessageCircle size={13} aria-hidden="true" />
            Open listing to contact them
          </Button>
        )}
        {/* Last and quiet. This clears a row off a list; it is not a way out
            of an order, and a button that looks like one would be read as
            cancelling. */}
        <button
          type="button"
          onClick={onRemove}
          className="ml-auto flex items-center gap-1.5 rounded-xl px-3 py-2 text-[15px] font-bold text-white/45 transition duration-150 hover:bg-white/[0.06] hover:text-white/70 active:scale-[0.96]"
        >
          <Trash2 size={13} aria-hidden="true" />
          Remove
          <span className="sr-only"> this order from your list</span>
        </button>
      </div>
    </article>
  )
}

export default function MyOrders() {
  const { profile, status } = useAuth()
  const [confirmRemove, setConfirmRemove] = useState<Order | null>(null)
  const [removed, setRemoved] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetched = useAsyncData(
    () => (profile ? listOrdersForBuyer(profile.uid) : Promise.resolve([])),
    [profile?.uid],
  )

  if (status === 'loading') return <LoadingLine label="Loading your orders…" />
  if (status === 'signedOut') return <Navigate to="/signin" replace />

  /**
   * Hides the order, then drops it from the list already on screen rather than
   * re-reading every order to learn one is gone — the write has either
   * succeeded, in which case the row is right to go, or thrown, in which case
   * the row stays and the message says why.
   */
  const remove = async () => {
    const target = confirmRemove
    if (!target) return
    setBusy(true)
    setError(null)
    try {
      await hideOrderForBuyer(target.id)
      setRemoved((previous) => [...previous, target.id])
      setConfirmRemove(null)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not remove that order.')
    } finally {
      setBusy(false)
    }
  }

  const orders = (fetched.data ?? []).filter((order) => !removed.includes(order.id))
  const open = orders.filter((order) => order.status !== 'completed')
  const done = orders.filter((order) => order.status === 'completed')

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <header className="liquid-glass-panel rounded-3xl px-5 py-4">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Your orders
        </h2>
        <p className="mt-2 text-[16px] leading-relaxed text-white/50">
          Everything you have ordered. The status is the seller&rsquo;s own note on the order, not
          a payment record: no money moves through this site.
        </p>
      </header>

      {fetched.error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-4 text-[16px] text-red-400">
          Could not load your orders: {fetched.error.message}
        </p>
      )}

      {error && (
        <p role="alert" className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] text-red-400">
          {error}
        </p>
      )}

      {fetched.loading && !fetched.data && <LoadingLine label="Loading your orders…" />}

      {fetched.data && orders.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="Nothing ordered yet"
          action={
            <Button variant="secondary" to="/browse">
              Browse ventures
            </Button>
          }
        >
          Orders you place show up here with the seller&rsquo;s progress on them.
        </EmptyState>
      )}

      {open.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/60 uppercase">
            In progress · {open.length}
          </h3>
          {open.map((order) => (
            <OrderCard key={order.id} order={order} onRemove={() => setConfirmRemove(order)} />
          ))}
        </section>
      )}

      {done.length > 0 && (
        <section className="space-y-3">
          <h3 className="px-1 font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/60 uppercase">
            Done · {done.length}
          </h3>
          {done.map((order) => (
            <OrderCard key={order.id} order={order} onRemove={() => setConfirmRemove(order)} />
          ))}
        </section>
      )}

      <Modal
        open={confirmRemove !== null}
        onClose={() => setConfirmRemove(null)}
        title={`Remove your order from ${confirmRemove?.ventureName ?? ''}?`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmRemove(null)}>
              Keep it
            </Button>
            <Button variant="danger" loading={busy} onClick={() => void remove()}>
              Remove from my list
            </Button>
          </>
        }
      >
        <p className="text-[16px] leading-relaxed text-white/70">
          This clears it off your list only. It does <strong>not</strong> cancel the order and the
          seller is not told &mdash; they keep their copy, because they may already have made it.
          If you no longer want it, message them from the listing first.
        </p>
        {/* IN THE DIALOG, not only on the page. A failed removal leaves this
            open, and Modal draws a backdrop over everything behind it — an
            error message out there is an error message nobody can read, so
            the button would just stop spinning and say nothing. */}
        {error && (
          <p role="alert" className="mt-3 text-[15.5px] leading-relaxed text-red-400">
            {error}
          </p>
        )}
      </Modal>
    </div>
  )
}
