import { useEffect, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import WhatsAppIcon from './ui/WhatsAppIcon'
import ShareDialog from './ShareDialog'
import { ventureShareMessage, ventureUrl } from '../lib/share'
import type { ShareableVenture } from '../lib/share'

/**
 * Two ways to pass a venture on: copy the link, or hand the whole message to
 * WhatsApp.
 *
 * TWO BUTTONS RATHER THAN ONE SHEET. `navigator.share` would collapse these
 * into a single tap and is genuinely nicer on a phone — but it does not exist
 * on desktop Chrome or Firefox, which is where sellers manage their listings,
 * and a button that silently does nothing for half the people who press it is
 * worse than a button that says what it does. WhatsApp is named outright
 * because on this campus it is not one option among many; it is where the
 * link is going.
 *
 * The WhatsApp button is an anchor, not a button with an onClick. Middle-click,
 * long-press and "open in new tab" all work on an anchor and none of them work
 * on a scripted navigation — and on a phone the anchor is what lets the OS
 * hand off to the installed app rather than the web client.
 *
 * THE PICTURE COMES FROM THE LINK, not from an attached file. This used to try
 * `navigator.share({ files, text })` first, on the theory that a real photo in
 * the chat beats a preview card. What it actually did, on a phone, was hand
 * WhatsApp a file and a caption and watch WhatsApp keep the caption and drop
 * the file — a message with no picture, and no preview card either, because a
 * message composed through the share sheet is never scraped for one. Loopberry
 * went out that way with nothing on it while Glood, shared through the plain
 * link, arrived with its sticker sheet on top.
 *
 * So the link is the only path now, and the picture is api/venture-preview's
 * job: it puts og:image in the HTML before the crawler sees it, which works on
 * WhatsApp, Instagram, Telegram, Slack and every desktop, and cannot be
 * silently discarded by a share sheet on the way.
 */
export default function ShareVenture({
  venture,
  ventureId,
}: {
  venture: ShareableVenture
  ventureId: string
}) {
  const [copied, setCopied] = useState(false)
  const [failed, setFailed] = useState(false)
  const [sharing, setSharing] = useState(false)

  // The origin is read at click time rather than at module load so this is
  // correct on any deployment without being told which one it is on.
  const origin = typeof window === 'undefined' ? '' : window.location.origin
  const url = ventureUrl(ventureId, origin)

  useEffect(() => {
    if (!copied) return
    const timer = window.setTimeout(() => setCopied(false), 2000)
    return () => window.clearTimeout(timer)
  }, [copied])

  const copy = async () => {
    setFailed(false)
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Clipboard access is refused outright in some in-app browsers — the
      // WhatsApp one included, which is exactly where a lot of this traffic
      // comes from. Rather than a dead button, show the link so it can be
      // selected by hand.
      setFailed(true)
    }
  }

  return (
    <div className="shrink-0">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => void copy()}
          aria-label={copied ? 'Link copied' : 'Copy link to this venture'}
          title="Copy link"
          className={`flex h-11 w-11 items-center justify-center rounded-full border transition duration-150 active:scale-[0.94] ${
            copied
              ? 'border-brand-400/50 bg-brand-500/20 text-brand-300'
              : 'border-white/12 bg-white/5 text-white/55 hover:bg-white/10 hover:text-white'
          }`}
        >
          {copied ? (
            <Check size={17} aria-hidden="true" />
          ) : (
            <Link2 size={17} aria-hidden="true" />
          )}
        </button>

        {/* Opens the dialog rather than WhatsApp directly, so the message can
            be read and changed before it goes to forty people. See
            ShareDialog. */}
        <button
          type="button"
          onClick={() => setSharing(true)}
          aria-label={`Share ${venture.name} on WhatsApp`}
          title="Share on WhatsApp"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-whatsapp/40 bg-whatsapp/15 text-whatsapp transition duration-150 hover:bg-whatsapp/25 active:scale-[0.94]"
        >
          <WhatsAppIcon size={18} />
        </button>
      </div>

      {/* Announced, not just shown: the button's own label does not change
          enough to tell a screen reader anything happened. */}
      <span role="status" className="sr-only">
        {copied ? 'Link copied to your clipboard.' : ''}
      </span>

      <ShareDialog
        open={sharing}
        onClose={() => setSharing(false)}
        title={`Send ${venture.name}`}
        // A shop is not on offer and has no last one, so there is one way to
        // introduce it and the preset row would be a row of one button.
        pitches={['plain']}
        build={(pitch, custom) =>
          pitch === 'custom' && custom.trim()
            ? `${custom.trim()}

${url}`
            : ventureShareMessage(venture, ventureId, origin)
        }
      />

      {failed && (
        <p className="mt-2 max-w-56 text-[13px] leading-relaxed break-all text-white/60">
          Copy it by hand: <span className="text-white/70">{url}</span>
        </p>
      )}
    </div>
  )
}
