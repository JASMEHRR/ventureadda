import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { AlertTriangle } from 'lucide-react'
import Button from './ui/Button'
import { reloadOnce } from '../lib/recover'

/**
 * Catches a crash in a page and says so, instead of leaving a black screen.
 *
 * WRITTEN THE DAY IT WAS NEEDED. A hook was added below an early return in
 * VentureDetail, which changes how many hooks React sees between the first
 * render and the second; React responds by tearing the whole tree down. With
 * nothing to catch that, every venture page on the site went black — no
 * message, no way back, and no reason for anybody looking at it to think the
 * site was anything other than dead.
 *
 * A class component, which is not a style choice: `componentDidCatch` and
 * `getDerivedStateFromError` have no hook equivalent, and React still offers
 * no other way to catch a render error.
 *
 * INSIDE THE SHELL, around the routed page only. The sidebar, the top bar and
 * the bottom bar keep working, so a broken page is one broken page rather than
 * a broken site — and the reader can leave it by tapping something rather than
 * by typing a URL.
 *
 * RESET ON NAVIGATION is why this takes `resetKey`: React keeps a boundary in
 * its error state until something changes it, so without this, one crash would
 * leave every subsequent page showing the same message.
 *
 * IT RELOADS ITSELF FIRST. Most of what lands here is transient — a chunk that
 * failed to arrive, a render that ran while a deploy swapped the files under
 * it — and a reload fixes all of it. Asking a buyer to press a button before
 * trying the one thing that works is asking them to do our job, and most of
 * them will close the tab instead.
 */

type Props = { children: ReactNode; resetKey: string }
type State = { error: Error | null; reloading: boolean }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, reloading: false }

  static getDerivedStateFromError(error: Error): State {
    return { error, reloading: false }
  }

  componentDidUpdate(previous: Props) {
    if (previous.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, reloading: false })
    }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // The console is the only reporting this site has. It is worth having:
    // "which component" is the first question, and the stack alone does not
    // answer it once the build is minified.
    console.error('[ventureadda] page crashed', error, info.componentStack)

    // After the log, so the reason survives in the console of a tab that is
    // about to be replaced.
    if (reloadOnce()) this.setState({ reloading: true })
  }

  render() {
    if (!this.state.error) return this.props.children

    // The reload is already in flight. Anything drawn here flashes for a
    // moment and then goes, and a panel saying the page broke is the worst
    // possible thing to flash at somebody it is about to fix.
    if (this.state.reloading) return null

    return (
      <div className="liquid-glass-panel mx-auto max-w-xl space-y-4 rounded-3xl px-6 py-8 text-center">
        <AlertTriangle size={22} aria-hidden="true" className="mx-auto text-amber-400" />
        <h2 className="text-[20px] font-extrabold tracking-tight text-white">
          This page stopped working
        </h2>
        <p className="text-[16px] leading-relaxed text-white/60">
          Something on it broke — not anything you did. Reloading it did not help, so this one
          needs looking at. The rest of the site still works.
        </p>
        <div className="flex flex-wrap justify-center gap-2.5">
          <Button onClick={() => window.location.reload()}>Reload this page</Button>
          <Button variant="secondary" to="/browse">
            Go to Browse
          </Button>
        </div>
        {/* The message itself, small and last. Useless to most people and the
            entire answer for anyone reporting it in All Chat. */}
        <p className="font-mono text-[12.5px] break-words text-white/40">
          {this.state.error.message}
        </p>
      </div>
    )
  }
}
