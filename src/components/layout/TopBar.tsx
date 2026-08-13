import { Link } from 'react-router-dom'
import { Plus } from 'lucide-react'
import Avatar from '../ui/Avatar'

type TopBarProps = {
  /** Mono eyebrow above the title. */
  eyebrow: string
  title: string
  /** Null until Step 2 lands sign-in. */
  user: { username: string } | null
}

/**
 * Sits above the routed content, inside the right-hand column, so the sidebar
 * runs full height beside it rather than under it.
 *
 * The wordmark only appears below `md`, where the sidebar that normally carries
 * it is hidden — otherwise it would be on screen twice.
 */
export default function TopBar({ eyebrow, title, user }: TopBarProps) {
  return (
    <header className="liquid-glass-panel flex items-center gap-3 rounded-[1.5rem] px-4 py-3 sm:px-5 sm:py-3.5">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[9px] font-extrabold tracking-[0.22em] text-white/40 uppercase md:hidden">
          VentureAdda
        </p>
        <p className="hidden font-mono text-[9px] font-extrabold tracking-[0.22em] text-brand-400 uppercase md:block">
          {eyebrow}
        </p>
        <h1 className="mt-0.5 truncate text-[17px] font-extrabold text-white sm:text-[19px]">
          {title}
        </h1>
      </div>

      <Link
        to="/add"
        className="hidden items-center gap-2 rounded-full border border-brand-500/30 bg-brand-500/15 px-5 py-2.5 font-mono text-[11px] font-bold tracking-wider text-brand-300 uppercase transition duration-150 hover:bg-brand-500/25 active:scale-[0.97] sm:inline-flex"
      >
        <Plus size={13} aria-hidden="true" />
        Add venture
      </Link>

      {user ? (
        <Link
          to="/profile"
          className="rounded-full transition duration-150 active:scale-[0.94]"
          aria-label={`Profile, signed in as ${user.username}`}
        >
          <Avatar name={user.username} />
        </Link>
      ) : (
        <Link
          to="/signin"
          className="rounded-full border border-white/12 bg-white/5 px-4 py-2.5 font-mono text-[11px] font-bold tracking-wider text-white/80 uppercase transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97]"
        >
          Sign in
        </Link>
      )}
    </header>
  )
}
