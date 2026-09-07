import { useEffect, useRef, useState } from 'react'
import { Check, Link2 } from 'lucide-react'
import Modal from './ui/Modal'
import Button from './ui/Button'
import WhatsAppIcon from './ui/WhatsAppIcon'
import { SHARE_PITCH_LABEL } from '../lib/share'
import type { SharePitch } from '../lib/share'

/**
 * Choose how a thing is introduced, then send it.
 *
 * A SHARE BUTTON THAT JUST OPENS WHATSAPP hands over whatever the code wrote
 * and hopes. What actually goes into a group is a link under whatever the
 * sender could be bothered to type, which is usually nothing — so the message
 * does an advert's job with none of the words. The presets are the three
 * things people mean when they send a product: look at this, hurry, and there
 * is one left.
 *
 * IT SHOWS THE MESSAGE. The box below the presets is the real text, editable,
 * and it is what gets sent — not a summary of it. Nobody trusts a share button
 * that will not say what it is about to put in front of forty people, and the
 * first thing anyone wants to change is the wording.
 *
 * Nothing here is a claim the SITE makes. "Limited time" is a sentence a
 * person chose and a person sends, which is exactly why it is a preset here
 * and not something inferred from a stock count.
 */
export default function ShareDialog({
  open,
  onClose,
  title,
  /** Builds the message for a chosen angle. Custom passes the typed text. */
  build,
  /** Hide the pitch buttons when there is only one way to say it. */
  pitches = ['plain', 'limited', 'lastOne'],
}: {
  open: boolean
  onClose: () => void
  title: string
  build: (pitch: SharePitch, custom: string) => string
  pitches?: Exclude<SharePitch, 'custom'>[]
}) {
  const [pitch, setPitch] = useState<SharePitch>(pitches[0] ?? 'plain')
  const [text, setText] = useState('')
  const [copied, setCopied] = useState(false)

  /**
   * `build` is held in a ref because callers pass an inline arrow, which is a
   * new function on every render. Depending on it would rebuild the message
   * after every keystroke.
   */
  const builder = useRef(build)
  builder.current = build

  /**
   * Fills the box on opening, and NOT at any other time.
   *
   * THE PITCH IS NOT A DEPENDENCY HERE, and that is the whole of a bug this
   * dialog shipped with for one deploy. Typing set the pitch to 'custom', the
   * effect saw the pitch change, and it rewrote the box from the preset —
   * deleting the sentence that had just been typed. Choosing a preset now
   * rewrites the box itself, in the click handler, which is the only moment a
   * rewrite is ever wanted.
   *
   * Keyed on `open` so reopening after sending does not present the last
   * message still edited: somebody sharing again is sharing something else.
   */
  useEffect(() => {
    if (!open) return
    setPitch(pitches[0] ?? 'plain')
    setText(builder.current(pitches[0] ?? 'plain', ''))
    setCopied(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const choose = (option: SharePitch) => {
    setPitch(option)
    setText(builder.current(option, ''))
  }

  const send = `https://wa.me/?text=${encodeURIComponent(text)}`

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Refused in some in-app browsers, the WhatsApp one included. The text
      // is on screen and selectable, which is the fallback.
      setCopied(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="secondary"
            onClick={() => void copy()}
            disabled={text.trim() === ''}
          >
            {copied ? <Check size={14} aria-hidden="true" /> : <Link2 size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </Button>
          {/* An anchor, not a scripted navigation: on a phone this is what
              lets the OS hand off to the installed app rather than the web
              client, and long-press and open-in-new-tab keep working. */}
          <a
            href={send}
            target="_blank"
            rel="noreferrer noopener"
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl bg-[#25D366]/20 px-4 py-2.5 text-[15px] font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/30 active:scale-[0.97]"
          >
            <WhatsAppIcon size={15} />
            Send on WhatsApp
          </a>
        </>
      }
    >
      <div className="space-y-3">
        {pitches.length > 1 && (
          <div role="radiogroup" aria-label="How to introduce it" className="flex flex-wrap gap-2">
            {pitches.map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={pitch === option}
                onClick={() => choose(option)}
                className={`rounded-xl px-3.5 py-2 text-[14.5px] font-bold transition duration-150 active:scale-[0.96] ${
                  pitch === option
                    ? 'bg-brand-500/20 text-brand-300'
                    : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80'
                }`}
              >
                {SHARE_PITCH_LABEL[option]}
              </button>
            ))}
          </div>
        )}

        <label htmlFor="share-text" className="sr-only">
          The message
        </label>
        <textarea
          id="share-text"
          value={text}
          onChange={(event) => {
            setText(event.target.value)
            setPitch('custom')
          }}
          rows={8}
          className="w-full resize-y rounded-2xl border border-white/10 bg-white/[0.04] px-3.5 py-3 text-[15.5px] leading-relaxed text-white/85"
        />

        <p className="text-[14px] leading-relaxed text-white/45">
          Edit it however you like &mdash; this is exactly what gets sent. WhatsApp draws the
          picture from the link, so there is nothing to attach.
        </p>
      </div>
    </Modal>
  )
}
