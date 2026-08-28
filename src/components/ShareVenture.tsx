import { useEffect, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import WhatsAppIcon from './ui/WhatsAppIcon'
import { ventureShareMessage, ventureUrl, whatsappShareLink } from '../lib/share'
import type { ShareableVenture } from '../lib/share'
import { displayUrl } from '../lib/cloudinary'
import type { StoredImage } from '../data/types'

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
 */
export default function ShareVenture({
  venture,
  ventureId,
  photo,
}: {
  venture: ShareableVenture
  ventureId: string
  /** The cover photo, when there is one. Sent with the message on the
   *  platforms that can carry a file. */
  photo?: StoredImage
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

  /**
   * The photo, when the platform can actually carry one.
   *
   * A wa.me link is text and only text — no URL parameter attaches an image,
   * and no amount of wanting changes that. What can send a picture is the Web
   * Share API with a file, which on Android and iOS opens the same system
   * sheet WhatsApp sits in, and arrives as a real photo with the message under
   * it. So: try that first when the browser says it can, and fall through to
   * the wa.me link everywhere else rather than pretending.
   *
   * `canShare({ files })` is asked rather than assumed. Desktop Chrome has
   * `navigator.share` and refuses files; testing for `share` alone would open
   * a sheet that then throws.
   *
   * A slow or failed image fetch must not cost the share: any error falls
   * straight through to the link, which is the behaviour someone who tapped a
   * share button expects either way.
   */
  const shareWithPhoto = async (event: React.MouseEvent<HTMLAnchorElement>) => {
    if (!photo || sharing) return

    /**
     * ONLY ON A TOUCH DEVICE, and that restriction is the whole lesson here.
     *
     * Windows' share sheet accepts `{ files, text }` — canShare says yes — and
     * then sends the file ALONE. The photograph arrives in the chat with no
     * name, no description and, fatally, no link: the one thing the share
     * exists to deliver. Reported from a desktop where the sheet opened
     * showing glood.jpg and nothing else.
     *
     * Phones do not do this; WhatsApp on Android and iOS keeps the text as the
     * image's caption, which is exactly the message with a picture on top.
     * So the file path is for coarse pointers only, and every mouse falls
     * through to the wa.me link, where the text is the entire payload and
     * cannot be dropped.
     *
     * A link with no picture beats a picture with no link, every time.
     */
    const touchDevice = window.matchMedia?.('(pointer: coarse)').matches ?? false
    const canShareFiles =
      touchDevice &&
      typeof navigator.canShare === 'function' &&
      typeof navigator.share === 'function'
    if (!canShareFiles) return

    event.preventDefault()
    setSharing(true)
    try {
      const response = await fetch(displayUrl(photo, 1200))
      const blob = await response.blob()
      const file = new File([blob], `${venture.name.replace(/\W+/g, '-').toLowerCase()}.jpg`, {
        type: blob.type || 'image/jpeg',
      })
      if (!navigator.canShare({ files: [file], text: ventureShareMessage(venture, ventureId, origin) })) {
        window.open(whatsappShareLink(venture, ventureId, origin), '_blank', 'noopener')
        return
      }
      await navigator.share({
        files: [file],
        text: ventureShareMessage(venture, ventureId, origin),
      })
    } catch (cause) {
      // AbortError is the person closing the sheet — not a failure, and
      // reopening WhatsApp behind them would be the wrong answer.
      if ((cause as { name?: string })?.name !== 'AbortError') {
        window.open(whatsappShareLink(venture, ventureId, origin), '_blank', 'noopener')
      }
    } finally {
      setSharing(false)
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

        <a
          href={whatsappShareLink(venture, ventureId, origin)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(event) => void shareWithPhoto(event)}
          aria-label={`Share ${venture.name} on WhatsApp`}
          title="Share on WhatsApp"
          className="flex h-11 w-11 items-center justify-center rounded-full border border-whatsapp/40 bg-whatsapp/15 text-whatsapp transition duration-150 hover:bg-whatsapp/25 active:scale-[0.94]"
        >
          <WhatsAppIcon size={18} />
        </a>
      </div>

      {/* Announced, not just shown: the button's own label does not change
          enough to tell a screen reader anything happened. */}
      <span role="status" className="sr-only">
        {copied ? 'Link copied to your clipboard.' : ''}
      </span>

      {failed && (
        <p className="mt-2 max-w-56 text-[13px] leading-relaxed break-all text-white/45">
          Copy it by hand: <span className="text-white/70">{url}</span>
        </p>
      )}
    </div>
  )
}
