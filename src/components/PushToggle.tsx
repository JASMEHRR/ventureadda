import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import Button from './ui/Button'
import { disablePush, enablePush, pushAvailability } from '../lib/push'
import type { PushAvailability } from '../lib/push'

/**
 * Turns browser push on for this device.
 *
 * WHY IT IS ON THE ORDERS PAGE and nowhere else. A permission prompt fired
 * anywhere a passer-by can reach is how a site gets permanently blocked —
 * people dismiss what they did not ask for, and the browser remembers that
 * decision forever. Asking here means asking someone who is looking at their
 * own orders, which is the one moment "tell me when these arrive" is obviously
 * what they want.
 *
 * Per device, not per account, and the copy says so. A seller who enables this
 * on a laptop and then wonders why their phone stays silent is the predictable
 * confusion, and one sentence prevents it.
 *
 * Renders NOTHING when push is unconfigured. An always-visible control that
 * cannot work is worse than no control.
 */
export default function PushToggle({ uid }: { uid: string }) {
  const [availability, setAvailability] = useState<PushAvailability | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    void pushAvailability().then((next) => {
      if (!cancelled) setAvailability(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Still checking, or there is nothing to offer on this deployment.
  if (!availability || availability.state === 'unconfigured') return null

  if (availability.state === 'unsupported' || availability.state === 'blocked') {
    return (
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[12.5px] leading-relaxed text-white/40">
        {availability.state === 'unsupported'
          ? availability.reason
          : 'Notifications are blocked for this site in your browser settings. The site cannot ask again once you have refused, so unblock them there if you want to be told about new orders.'}{' '}
        Orders still show up on this page either way.
      </p>
    )
  }

  const { enabled } = availability

  const toggle = async () => {
    setBusy(true)
    setError(null)
    try {
      if (enabled) {
        await disablePush(uid)
        setAvailability({ state: 'ready', enabled: false })
      } else {
        const granted = await enablePush(uid)
        // Refusing the prompt is an answer, not an error. It also means the
        // browser will not ask again, which is what 'blocked' renders.
        setAvailability(granted ? { state: 'ready', enabled: true } : { state: 'blocked' })
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not change that setting.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="liquid-glass-panel flex flex-wrap items-center gap-3 rounded-2xl px-5 py-4">
      {enabled ? (
        <Bell size={16} className="shrink-0 text-brand-400" aria-hidden="true" />
      ) : (
        <BellOff size={16} className="shrink-0 text-white/30" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold text-white">
          {enabled ? 'Notifications are on for this device' : 'Get told about new orders'}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-relaxed text-white/45">
          {enabled
            ? 'This device will buzz when an order arrives, even with the site closed. Turn it on separately on your other devices.'
            : 'Your browser will tell you when an order arrives, even with the site closed. This applies to this device only.'}
        </p>
        {error && (
          <p role="alert" className="mt-1.5 text-[12.5px] text-red-400">
            {error}
          </p>
        )}
      </div>
      <Button
        variant={enabled ? 'secondary' : 'primary'}
        loading={busy}
        onClick={() => void toggle()}
        className="shrink-0"
      >
        {enabled ? 'Turn off' : 'Turn on'}
      </Button>
    </div>
  )
}
