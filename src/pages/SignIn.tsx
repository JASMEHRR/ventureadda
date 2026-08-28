import { useEffect, useRef, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { MailCheck, Mail, ShieldCheck } from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import TextField from '../components/ui/TextField'
import LoadingLine from '../components/ui/LoadingLine'
import { useAuth } from '../auth/AuthProvider'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/firebase'

/**
 * 'password' and 'setPassword' are the two steps this flow gained.
 *
 * THE PROBLEM THEY SOLVE. An email link signs you in *in the browser that
 * opens it*. Send one to a friend and it signs THEM in on THEIR phone while
 * the sender's screen sits there doing nothing — which is exactly what it
 * looks like: broken. And every subsequent sign-in meant another round trip
 * through an inbox, on a site whose mail Gmail files under Spam.
 *
 * So the link now does the job only a link can do — proving the address
 * belongs to whoever read it — and then hands over to a password, which works
 * on any device, immediately, forever. First visit: address, link, password.
 * Every visit after: address, password.
 */
type Mode = 'form' | 'password' | 'setPassword' | 'sent' | 'completing' | 'needsEmail' | 'confirmed'

/** Where the challenge id waits while the reader goes to find the mail. */
const CHALLENGE_KEY = 'ventureadda.emailChallenge'

async function callVerify<T>(body: Record<string, unknown>): Promise<T> {
  const response = await fetch('/api/email-verify', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json().catch(() => ({}))) as T & { error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'That did not work. Try again.')
  return payload
}

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
      // ONE MESSAGE FOR BOTH, because Firebase gives one code for both. With
      // email-enumeration protection on — it is, by default, and it is what
      // stops strangers probing this form for who has an account — a wrong
      // password and an address that has never set one come back identically
      // as `auth/invalid-credential`. Saying "that password does not match"
      // was therefore a guess, and the wrong one for anybody who has not set a
      // password yet: it told them they had typed it wrong when they had
      // nothing to type.
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'That did not work. If you have not set a password yet, get a link below instead.'
      case 'auth/weak-password':
        return 'Use at least 8 characters.'
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
  const {
    status,
    signInWithGoogle,
    sendLink,
    completeSignInFromLink,
    signInWithPassword,
    signInWithToken,
    setPassword,
    hasPassword,
  } = useAuth()
  const navigate = useNavigate()

  const [mode, setMode] = useState<Mode>('form')
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [googleBusy, setGoogleBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)
  const [password, setPasswordValue] = useState('')
  const [challenge, setChallenge] = useState<string | null>(null)
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

    /**
     * A link carrying a challenge id belongs to a sign-in started elsewhere.
     *
     * This device confirms the address and stops. It is deliberately NOT
     * signed in: the person is standing at the device they started on, and
     * signing in the one that happened to have the mailbox open is the whole
     * behaviour being fixed.
     */
    const verifyId = new URL(href).searchParams.get('challenge')
    const oobCode = new URL(href).searchParams.get('oobCode')
    if (verifyId && oobCode) {
      callVerify({ action: 'confirm', id: verifyId, oobCode })
        .then(() => {
          window.history.replaceState({}, '', '/signin')
          setMode('confirmed')
        })
        .catch((cause: unknown) => {
          setError(errorMessage(cause))
          setMode('form')
        })
      return
    }

    completeSignInFromLink(href).then(
      (result) => {
        if (result === 'needsEmail') {
          setMode('needsEmail')
          return
        }
        // Strip the credential out of the address bar so it is not left in
        // history or copied out of the URL.
        window.history.replaceState({}, '', '/signin')
        // The link has done its job — it proved the address. Offer a password
        // now, while there is a session to attach one to, so the next sign-in
        // needs no inbox at all. Skipped for an account that already has one.
        if (hasPassword) navigate('/browse', { replace: true })
        else setMode('setPassword')
      },
      (cause: unknown) => {
        setError(errorMessage(cause))
        setMode('form')
      },
    )
  }, [completeSignInFromLink, navigate])

  /**
   * Waits for the address to be confirmed somewhere else.
   *
   * Two seconds is the interval because this is somebody standing still
   * looking at a phone, and anything slower feels broken; the challenge
   * expires on the server after fifteen minutes, so this stops on its own
   * rather than polling a dead id forever.
   */
  useEffect(() => {
    if (mode !== 'sent' || !challenge) return
    let cancelled = false

    const timer = window.setInterval(() => {
      callVerify<{ verified: boolean; expired: boolean }>({ action: 'status', id: challenge })
        .then((result) => {
          if (cancelled) return
          if (result.verified) setMode('setPassword')
          else if (result.expired) {
            setError('That link expired before it was opened. Send a new one.')
            setMode('form')
          }
        })
        .catch(() => {
          // A dropped request is not worth a message: the next tick retries.
        })
    }, 2000)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [mode, challenge])

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = window.setTimeout(() => setCooldown((seconds) => seconds - 1), 1000)
    return () => window.clearTimeout(timer)
  }, [cooldown])

  // Not while the set-a-password step is up. The link has already signed them
  // in by then — that is what makes setting one possible — so redirecting a
  // ready session would bounce them off the very screen the link led to.
  if (status === 'ready' && mode !== 'setPassword') return <Navigate to="/browse" replace />

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
    /**
     * The link now carries a challenge id, and that is what makes this work
     * across two devices.
     *
     * A Firebase link signs in whichever browser opens it. Type your address
     * on a phone, open the mail on a laptop, and the laptop is signed in while
     * the phone sits there — which is not what anybody meant by "check your
     * email". So the mail carries an id instead: whoever opens it confirms the
     * address and is told to go back, and THIS device — the one polling below
     * — is the one that finishes and ends up signed in.
     */
    const started = await callVerify<{ id: string }>({ action: 'start', email: address })
    setChallenge(started.id)
    try {
      window.localStorage.setItem(CHALLENGE_KEY, `${started.id}|${address}`)
    } catch {
      // Private mode. The poll below still runs for as long as this tab is
      // open, which covers the case this exists for.
    }
    await sendLink(address, started.id)
    setMode('sent')
    setCooldown(RESEND_COOLDOWN_SECONDS)
  }

  /**
   * The address alone is not enough to know whether an account exists.
   *
   * `fetchSignInMethodsForEmail` used to answer that, and Firebase now returns
   * an empty list for every address when email-enumeration protection is on —
   * which it is by default, and which is a protection worth having: it is what
   * stops a stranger typing addresses into this form to learn who has an
   * account here. So the app does not ask. It shows the password field to
   * everybody, and the people who have not got one take the link underneath
   * it, which is the same door they used the first time.
   */
  const submitEmail = (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!email.trim()) return
    // Confirming an address for a link opened on another device is a different
    // job, and it finishes here rather than asking for a password.
    if (mode === 'needsEmail') {
      void emailLink()
      return
    }
    setMode('password')
  }

  const submitPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await signInWithPassword(email, password)
      navigate('/browse', { replace: true })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const submitNewPassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (challenge) {
        // The cross-device path: the server sets the password against the
        // address it saw confirmed, and hands back a token that signs in THIS
        // device — the one the person is actually holding.
        const done = await callVerify<{ customToken: string }>({
          action: 'finish',
          id: challenge,
          password,
        })
        try {
          window.localStorage.removeItem(CHALLENGE_KEY)
        } catch {
          // Nothing to clean up if storage was never available.
        }
        await signInWithToken(done.customToken)
      } else {
        // Already signed in — this is somebody adding a password to a session
        // that a link opened on this same device.
        await setPassword(password)
      }
      navigate('/browse', { replace: true })
    } catch (cause) {
      setError(errorMessage(cause))
    } finally {
      setBusy(false)
    }
  }

  const emailLink = async () => {
    setError(null)
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
        Open it anywhere you like — your phone, another laptop, it does not matter. This page is
        watching, and the moment the address is confirmed it will carry on right here.
      </EmptyState>
    )
  }

  /**
   * Setting the first password, straight after the link proved the address.
   *
   * This is the screen that ends the round trip for good: from here on, that
   * address and this password sign in anywhere, on any device, with no mail
   * involved. Skippable, because an account that never sets one still works
   * exactly as it did — through the link — and a forced field on the way in is
   * how people bounce.
   */
  /**
   * What the device that opened the mail sees.
   *
   * Not signed in, on purpose, and told so plainly. Somebody who opened the
   * link on a laptop is standing at their phone — signing in the laptop is
   * the behaviour this whole flow exists to stop, and leaving them looking at
   * a signed-in laptop with no explanation is how they conclude it went wrong.
   */
  if (mode === 'confirmed') {
    return (
      <EmptyState icon={MailCheck} title="Address confirmed" className="mx-auto max-w-md">
        Go back to the device you started on — it is waiting for you and will carry on from here.
        You can close this tab.
      </EmptyState>
    )
  }

  if (mode === 'setPassword') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="liquid-glass-panel space-y-5 rounded-3xl p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-brand-400" aria-hidden="true" />
            <div>
              <h2 className="text-[21px] font-extrabold text-white">Address confirmed</h2>
              <p className="mt-1.5 text-[16px] leading-relaxed text-white/50">
                {challenge
                  ? 'That is your address proved. Choose a password and you are in — on this device, and any other, without an email next time.'
                  : 'Set a password and you can sign in from any device without waiting for an email again.'}
              </p>
            </div>
          </div>

          <form onSubmit={submitNewPassword} className="space-y-4">
            <TextField
              id="signin-new-password"
              label="Choose a password"
              hint="At least 8 characters."
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
              error={error ?? undefined}
            />

            <Button
              type="submit"
              variant="primary"
              loading={busy}
              disabled={password.length < 8}
              className="w-full"
            >
              Set password and continue
            </Button>
          </form>

          {/* Only when a session already exists. On the cross-device path the
              password IS the sign-in — there is nothing to skip into, and a
              Skip button would land them back where they started. */}
          {!challenge && (
            <button
              type="button"
              onClick={() => navigate('/browse', { replace: true })}
              className="w-full font-mono text-[13px] font-bold tracking-wider text-white/40 uppercase transition hover:text-white/70"
            >
              Skip for now
            </button>
          )}
        </div>
      </div>
    )
  }

  if (mode === 'password') {
    return (
      <div className="mx-auto max-w-md space-y-4">
        <div className="liquid-glass-panel space-y-5 rounded-3xl p-5 sm:p-6">
          <div>
            <h2 className="text-[21px] font-extrabold text-white">Your password</h2>
            <p className="mt-1.5 text-[16px] leading-relaxed text-white/50">
              Signing in as <span className="text-white/85">{email.trim().toLowerCase()}</span>.
            </p>
          </div>

          <form onSubmit={submitPassword} className="space-y-4">
            <TextField
              id="signin-password"
              label="Password"
              type="password"
              required
              autoFocus
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPasswordValue(event.target.value)}
              error={error ?? undefined}
            />

            <Button type="submit" variant="primary" loading={busy} className="w-full">
              Sign in
            </Button>
          </form>

          {/* The way in for anybody who has not set one — a first-time
              account, or somebody who has forgotten it. The same link either
              way: it proves the address, signs them in, and offers a password
              at the end.

              The explanation is a sentence and the control is three words.
              Both used to be crammed into the button, which wrapped onto two
              lines and read like a paragraph somebody had drawn a border
              around. A button says what it does; the reason it exists goes
              above it. */}
          <div className="border-t border-white/8 pt-4 text-center">
            <p className="text-[14.5px] leading-relaxed text-white/45">
              No password yet, or forgotten it?
            </p>
            <Button variant="secondary" className="mt-2.5" loading={busy} onClick={() => void emailLink()}>
              <Mail size={13} aria-hidden="true" />
              Email me a link
            </Button>
          </div>

          <button
            type="button"
            onClick={() => {
              setError(null)
              setPasswordValue('')
              setMode('form')
            }}
            className="w-full font-mono text-[13px] font-bold tracking-wider text-white/40 uppercase transition hover:text-white/70"
          >
            Use a different address
          </button>
        </div>
      </div>
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
            {mode === 'needsEmail' ? (
              <>
                <Mail size={13} aria-hidden="true" />
                Finish signing in
              </>
            ) : (
              'Continue with email'
            )}
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
