import { useState } from 'react'
import { Megaphone } from 'lucide-react'
import ShareDialog from './ShareDialog'
import { inviteMessage } from '../lib/share'

/**
 * The button that asks somebody to open a shop.
 *
 * THE SITE'S ONE GROWTH LEVER, and until now it was a thing people typed out
 * by hand. Every venture on here arrived because somebody in a group chat said
 * "you should put that on VentureAdda" — and whether that sentence lands
 * depends entirely on whether it answers the two objections, which are "what
 * is this" and "what does it cost me". The default message answers both and
 * then gets out of the way, because the person sending it knows their group
 * far better than this file does.
 *
 * It goes to /add rather than the front page. Somebody being asked to list
 * something should arrive at the form, not at a pitch they have already been
 * given by the friend who sent it.
 */
export default function InviteSellers({
  /** A quieter treatment for placing it beside other controls. */
  subtle = false,
  className = '',
}: {
  subtle?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const origin = typeof window === 'undefined' ? '' : window.location.origin

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          className ||
          (subtle
            ? 'flex items-center gap-1.5 font-mono text-[13px] font-bold tracking-wider text-white/55 uppercase transition hover:text-brand-300'
            : 'flex items-center gap-2 rounded-2xl border border-white/12 bg-white/[0.05] px-4 py-2.5 text-[15px] font-bold text-white/75 transition duration-150 hover:bg-white/10 hover:text-white active:scale-[0.97]')
        }
      >
        <Megaphone size={subtle ? 13 : 15} aria-hidden="true" />
        Invite a seller
      </button>

      <ShareDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Ask someone to list their venture"
        // One angle: this is an invitation, and "limited time" or "last one"
        // mean nothing about a sign-up form.
        pitches={['plain']}
        build={(pitch, custom) => inviteMessage(origin, pitch === 'custom' ? custom : '')}
      />
    </>
  )
}
