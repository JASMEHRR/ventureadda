import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MailCheck, ShieldCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import TextField from '../components/ui/TextField'
import LoadingLine from '../components/ui/LoadingLine'
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
        navigate('/browse', { replace: true })
      },
      (cause: unknown) => {
        setError(errorMessage(cause))
        setMode('form')
      },
    )
  }, [completeSignInFromLink, navigate])

  if (status === 'ready') return <Navigate to="/browse" replace />

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
          navigate('/browse', { replace: true })
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
      <LoadingLine label="Signing you in…" />
    )
  }

  if (mode === 'sent') {
    return (
      <EmptyState
        icon={MailCheck}
        tone="brand"
        eyebrow="Check your inbox"
        title={`Link sent to ${email}`}
        action={
          <Button variant="ghost" onClick={() => setMode('form')}>
            Use a different address
          </Button>
        }
      >
        Open it on this device if you can — that keeps things quickest. If you open it elsewhere
        you will just be asked for your address again.
      </EmptyState>
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

        <TextField
          id="signin-email"
          label="Thapar email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
          error={error ?? undefined}
        />

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
