import { useState } from 'react'
import { AtSign } from 'lucide-react'
import Button from '../components/ui/Button'
import { USERNAME_PATTERN, useAuth } from '../auth/AuthProvider'

/**
 * First-run gate. Shown instead of page content while a signed-in account has
 * no profile yet, rather than letting someone browse half-registered — a chat
 * message or a venture owned by an account with no username is a mess to
 * untangle afterwards.
 */
export default function ChooseUsername() {
  const { user, claimUsername, signOut } = useAuth()
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
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save that username.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <form onSubmit={submit} className="liquid-glass-panel space-y-4 rounded-3xl p-5 sm:p-6">
        <div className="flex items-center gap-2 text-brand-400">
          <AtSign size={13} aria-hidden="true" />
          <span className="font-mono text-[9px] font-extrabold tracking-[0.22em] uppercase">
            One last step
          </span>
        </div>

        <div>
          <h2 className="text-[19px] font-extrabold text-white">Pick a username</h2>
          <p className="mt-1.5 text-[14px] leading-relaxed text-white/50">
            This is what everyone sees in chat and on your venture. Signed in as{' '}
            <span className="text-white/80">{user?.email}</span>.
          </p>
        </div>

        <div>
          <label
            htmlFor="username"
            className="mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
          >
            Username
          </label>
          <input
            id="username"
            required
            autoFocus
            autoComplete="username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            placeholder="ananya_bakes"
            aria-describedby="username-hint"
            aria-invalid={error ? true : undefined}
            className="liquid-glass-input w-full rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-white/30"
          />
          <p id="username-hint" className="mt-1.5 text-[12.5px] text-white/35">
            3 to 20 characters. Letters, numbers and underscores.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-[13.5px] leading-relaxed text-red-400">
            {error}
          </p>
        )}

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
