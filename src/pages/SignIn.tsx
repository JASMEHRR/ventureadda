import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MailCheck, ShieldCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import { useAuth } from '../auth/AuthProvider'
import { ALLOWED_EMAIL_DOMAIN, isAllowedEmail } from '../lib/firebase'

type Mode = 'form' | 'sent' | 'completing' | 'needsEmail'

function errorMessage(cause: unknown): string {
  if (cause && typeof cause === 'object' && 'code' in cause) {
    switch ((cause as { code: string }).code) {
      case 'auth/invalid-email':
        return 'That does not look like a valid email address.'
      case 'auth/invalid-action-code':
        return 'That link has already been used or has expired. Request a new one.'
      case 'auth/unauthorized-continue-uri':
        return 'This domain is not authorised in Firebase yet. Add it under Authentication, Settings, Authorized domains.'
      case 'auth/too-many-requests':
        return 'Too many attempts. Wait a few minutes and try again.'
      case 'auth/network-request-failed':
        return 'Could not reach Firebase. Check your connection and try again.'
      default:
        break
    }
  }
  return cause instanceof Error ? cause.message : 'Something went wrong. Try again.'
}

export default function SignIn() {
  const { status, sendLink, completeSignInFromLink } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('form')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempted = useRef(false)

  // A sign-in link lands back on this page. Completing it is guarded by a ref
  // because StrictMode mounts effects twice in development, and the second
  // attempt would fail with "invalid action code" against an already-used link.
  useEffect(() => {
    if (attempted.current) return
    attempted.current = true

    const href = window.location.href
    if (!href.includes('apiKey')) return

    setMode('completing')
    completeSignInFromLink(href).then(
      (result) => {
        if (result === 'needsEmail') {
          setMode('needsEmail')
          return
        }
        // Strip the credential out of the address bar so it is not left in
        // history or copied out of the URL.
        window.history.replaceState({}, '', '/signin')
        navigate('/', { replace: true })
      },
      (cause: unknown) => {
        setError(errorMessage(cause))
        setMode('form')
      },
    )
  }, [completeSignInFromLink, navigate])

  if (status === 'ready') return <Navigate to="/" replace />

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (!isAllowedEmail(email)) {
      setError(`Use your @${ALLOWED_EMAIL_DOMAIN} address — this site is Thapar students only.`)
      return
    }

    setBusy(true)
    try {
      if (mode === 'needsEmail') {
        const result = await completeSignInFromLink(window.location.href, email)
        if (result === 'done') {
          window.history.replaceState({}, '', '/signin')
          navigate('/', { replace: true })
          return
        }
      } else {
        await sendLink(email)
        setMode('sent')
      }
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'completing') {
    return (
      <p className="px-1 font-mono text-[10px] tracking-[0.18em] text-white/30 uppercase">
        Signing you in…
      </p>
    )
  }

  if (mode === 'sent') {
    return (
      <div className="liquid-glass-panel flex flex-col items-center rounded-3xl px-6 py-14 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-brand-500/30 bg-brand-500/15 text-brand-300">
          <MailCheck size={22} aria-hidden="true" />
        </span>
        <p className="mt-5 font-mono text-[9px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Check your inbox
        </p>
        <h2 className="mt-2 text-[19px] font-extrabold text-white">Link sent to {email}</h2>
        <p className="mt-2 max-w-sm text-[14px] leading-relaxed text-white/45">
          Open it on this device if you can — that keeps things quickest. If you open it elsewhere
          you will just be asked for your address again.
        </p>
        <Button variant="ghost" className="mt-5" onClick={() => setMode('form')}>
          Use a different address
        </Button>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <form onSubmit={submitEmail} className="liquid-glass-panel space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-brand-400">
          <ShieldCheck size={13} aria-hidden="true" />
          <span className="font-mono text-[9px] font-extrabold tracking-[0.22em] uppercase">
            Thapar students only
          </span>
        </div>

        <div>
          <h2 className="text-[19px] font-extrabold text-white">
            {mode === 'needsEmail' ? 'Confirm your address' : 'Sign in'}
          </h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
            {mode === 'needsEmail'
              ? 'You opened the link on a different device, so we need the address you asked for it with.'
              : 'No password. We email you a link, and clicking it proves the inbox is yours.'}
          </p>
        </div>

        <div>
          <label
            htmlFor="signin-email"
            className="mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
          >
            Thapar email
          </label>
          <input
            id="signin-email"
            type="email"
            required
            autoComplete="email"
            autoFocus
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            aria-describedby={error ? 'signin-error' : undefined}
            aria-invalid={error ? true : undefined}
            className="liquid-glass-input w-full rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-white/30"
          />
        </div>

        {error && (
          <p id="signin-error" role="alert" className="text-[13.5px] leading-relaxed text-red-400">
            {error}
          </p>
        )}

        <Button type="submit" variant="primary" loading={busy} className="w-full">
          {mode === 'needsEmail' ? 'Finish signing in' : 'Email me a link'}
        </Button>
      </form>

      {/* white/55, not the white/35 used for asides on glass. This paragraph
          sits on the bare photographic backdrop, where 35% measured 3.24:1 —
          under AA. Glass panels supply their own dark fill; this has none. */}
      <p className="px-2 text-center text-[13px] leading-relaxed text-white/55">
        You can browse every venture without an account. Signing in is only needed to post in chat
        or list your own venture.
      </p>
    </div>
  )
}
