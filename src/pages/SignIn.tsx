import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MailCheck, Mail, ShieldCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import TextField from '../components/ui/TextField'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/firebase'

type Mode = 'form' | 'sent' | 'completing' | 'needsEmail'

/** Long enough that a second tap is a real retry, short enough not to feel punitive. */
const RESEND_COOLDOWN_SECONDS = 45

/** What the mail arrives as. Given verbatim so there is a string to search for. */
const SENDER_ADDRESS = 'noreply@ventureadda.firebaseapp.com'

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
      case 'auth/account-exists-with-different-credential':
        return 'You already have an account with that address. Sign in with the email link instead.'
      case 'auth/unauthorized-domain':
        return 'This domain is not authorised in Firebase yet. Add it under Authentication, Settings, Authorized domains.'
      default:
        break
    }
  }
  return cause instanceof Error ? cause.message : 'Something went wrong. Try again.'
}

/**
 * Where the email link actually lands, said plainly.
 *
 * Firebase sends from a noreply@ address on a firebaseapp.com subdomain the
 * recipient has never had mail from, so Gmail files it under Spam or Promotions
 * more often than not — confirmed on the owner's own account. Someone who is
 * not told this looks in the inbox, finds nothing, and concludes the site is
 * broken. Stated as the expected outcome rather than an edge case, and calmly:
 * this is ordinary for transactional mail, not a fault.
 */
function InboxAdvice() {
  return (
    <div className="mt-5 w-full max-w-sm rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-left">
      <p className="font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
        Check spam
      </p>
      <p className="mt-2 text-[15.5px] leading-relaxed text-white/60">
        It usually lands in <span className="text-white/85">Spam</span> or{' '}
        <span className="text-white/85">Promotions</span> rather than your inbox. Search for{' '}
        <span className="text-white/85">VentureAdda</span> or:
      </p>
      <p className="mt-2 rounded-lg bg-black/25 px-3 py-2 font-mono text-[14px] break-all text-white/70">
        {SENDER_ADDRESS}
      </p>
      <p className="mt-2 text-[15px] leading-relaxed text-white/40">
        Marking it "not spam" means the next one arrives properly.
      </p>
    </div>
  )
}

export default function SignIn() {
  const { status, signInWithGoogle, sendLink, completeSignInFromLink } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('form')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
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

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  if (status === 'ready') return <Navigate to="/browse" replace />

  const google = async () => {
    setError(null)
    setGoogleBusy(true)
    try {
      await signInWithGoogle()
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setGoogleBusy(false)
    }
  }

  const send = async (address: string) => {
    if (mode === 'needsEmail') {
      const result = await completeSignInFromLink(window.location.href, address)
      if (result === 'done') {
        window.history.replaceState({}, '', '/signin')
        navigate('/browse', { replace: true })
      }
      return
    }
    await sendLink(address)
    setMode('sent')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  const submitEmail = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    // No domain check here any more. Anyone with a verified address may hold an
    // account; what they may post is decided at the action, not at the door.
    setBusy(true)
    try {
      await send(email.trim().toLowerCase())
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const resend = async () => {
    setError(null)
    setBusy(true)
    try {
      await sendLink(email.trim().toLowerCase())
      setCooldown(RESEND_COOLDOWN_SECONDS)
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  if (mode === 'completing') {
    return <LoadingLine label="Signing you in…" />
  }

  if (mode === 'sent') {
    return (
      <EmptyState
        icon={MailCheck}
        tone="brand"
        eyebrow="Link sent"
        title={`Sent to ${email}`}
        extra={<InboxAdvice />}
        action={
          <>
            <Button variant="secondary" loading={busy} disabled={cooldown > 0} onClick={resend}>
              {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend link'}
            </Button>
            <Button variant="ghost" onClick={() => setMode('form')}>
              Use a different address
            </Button>
          </>
        }
      >
        Open it on this device if you can — that keeps things quickest. If you open it elsewhere
        you will just be asked for your address again.
      </EmptyState>
    )
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <div className="liquid-glass-panel space-y-5 rounded-3xl p-5 sm:p-6">
        <div>
          <h2 className="text-[21px] font-extrabold text-white">
            {mode === 'needsEmail' ? 'Confirm your address' : 'Sign in'}
          </h2>
          <p className="mt-1.5 text-[16px] leading-relaxed text-white/50">
            {mode === 'needsEmail'
              ? 'You opened the link on a different device, so we need the address you asked for it with.'
              : 'Browsing needs no account at all. Sign in to review a venture, and with your Thapar address to post or list one.'}
          </p>
        </div>

        {mode !== 'needsEmail' && (
          <>
            {/* Primary. Thapar is on Google Workspace, so a student is already
                signed in as their @thapar.edu address — one tap, no mail, and
                none of the spam-folder or cross-device trouble below. */}
            <Button
              variant="primary"
              className="w-full"
              loading={googleBusy}
              onClick={() => void google()}
            >
              Continue with Google
            </Button>

            <div className="flex items-center gap-3">
              <span className="h-px flex-1 bg-white/10" />
              <span className="font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/30 uppercase">
                or
              </span>
              <span className="h-px flex-1 bg-white/10" />
            </div>
          </>
        )}

        <form onSubmit={submitEmail} className="space-y-4">
          <TextField
            id="signin-email"
            label="Email address"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder={`you@${ALLOWED_EMAIL_DOMAIN}`}
            error={error ?? undefined}
          />

          <Button type="submit" variant="secondary" loading={busy} className="w-full">
            <Mail size={13} aria-hidden="true" />
            {mode === 'needsEmail' ? 'Finish signing in' : 'Email me a link instead'}
          </Button>
        </form>

        {mode === 'needsEmail' && (
          <div className="flex justify-center">
            <InboxAdvice />
          </div>
        )}

        <p className="flex items-start gap-2 text-[15px] leading-relaxed text-white/40">
          <ShieldCheck size={13} aria-hidden="true" className="mt-0.5 shrink-0 text-brand-400" />
          <span>
            Posting in chat and listing a venture need an @{ALLOWED_EMAIL_DOMAIN} address.
            Anyone can sign in to browse and review.
          </span>
        </p>
      </div>
    </div>
  )
}
