import { useState } from 'react'
import { AtSign } from 'lucide-react'
import Button from '../components/ui/Button'
import TextField from '../components/ui/TextField'
import { USERNAME_PATTERN, useAuth } from '../auth/AuthProvider'

/**
 * Claims the name that will appear next to whatever you are about to post.
 *
 * No longer a first-run gate over the whole app. Usernames are permanent and
 * can never be released, and with Google Sign-In anybody can hold an account —
 * so asking at sign-up would let a passer-by burn the name a classmate wanted
 * on the way to reading one page. It is asked for at the first action that
 * attaches a name to content, and nowhere else.
 *
 * `reason` is what that action was. Someone who came here by pressing "post" is
 * owed a sentence explaining why they are suddenly being asked for a name.
 */
export default function ChooseUsername({
  reason = 'This is what everyone sees next to anything you post.',
  onDone,
}: {
  reason?: string
  onDone?: () => void
} = {}) {
  const { user, claimUsername, signOut, provisionError } = useAuth()
  const [username, setUsername] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const valid = USERNAME_PATTERN.test(username.trim())

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await claimUsername(username)
      onDone?.()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that username.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-4">
      <form onSubmit={submit} className="liquid-glass-panel space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-brand-400">
          <AtSign size={13} aria-hidden="true" />
          <span className="font-mono text-[12.5px] font-extrabold tracking-[0.22em] uppercase">
            Pick a name first
          </span>
        </div>

        {/* Only when the automatic one actually failed. Reaching this screen
            is supposed to be rare now, and rare failures that say nothing are
            the ones that never get reported and never get fixed. */}
        {provisionError && (
          <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-3 text-[14px] leading-relaxed text-amber-300">
            We normally take your name from your email address, and that did not work this time:{' '}
            {provisionError}
          </p>
        )}

        <div>
          <h2 className="text-[21px] font-extrabold text-white">Choose a username</h2>
          <p className="mt-1.5 text-[16px] leading-relaxed text-white/50">
            {reason} Signed in as <span className="text-white/80">{user?.email}</span>.
          </p>
          {/* Said before the choice, not after. It cannot be changed later and
              nobody reads a warning that arrives with the confirmation. */}
          <p className="mt-1.5 text-[15.5px] leading-relaxed text-white/40">
            Usernames are permanent — they cannot be changed or released later.
          </p>
        </div>

        <TextField
          id="username"
          label="Username"
          required
          autoFocus
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
          placeholder="ananya_bakes"
          hint="3 to 20 characters. Letters, numbers and underscores."
          error={error ?? undefined}
        />

        <Button type="submit" variant="primary" loading={busy} disabled={!valid} className="w-full">
          Save and continue
        </Button>
      </form>

      <div className="text-center">
        <Button variant="ghost" onClick={() => void signOut()}>
          Sign out instead
        </Button>
      </div>
    </div>
  )
}
