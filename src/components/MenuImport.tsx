import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ClipboardList, Loader2, Mic, Square } from 'lucide-react'
import Button from './ui/Button'
import { SCAN_ACCEPT, extractMenu } from '../lib/extractMenu'
import { parseMenuList, parseMenuSpeech } from '../data/menuParse'
import type { ParsedRow } from '../data/menuParse'

/**
 * Three ways to fill the menu without typing it: photograph it, paste it, say
 * it. Plus typing, which is always available and never blocked by anything
 * here.
 *
 * All three end at the same place — draft rows in the builder below, edited and
 * validated exactly like a row typed by hand. None of them writes to Firestore.
 * That is the rule the Groq extractor was built to, and it holds for these too:
 * extraction of any kind gets prices wrong, and a wrong price is worse than no
 * price because a buyer turns up expecting it.
 */

/**
 * The Web Speech API is not in TypeScript's DOM library, so the shape used here
 * is declared rather than imported. Deliberately minimal: only the four members
 * this component touches.
 */
type SpeechResult = { 0: { transcript: string }; isFinal: boolean; length: number }
type SpeechEvent = { resultIndex: number; results: { length: number } & Record<number, SpeechResult> }
type SpeechRecognitionLike = {
  lang: string
  continuous: boolean
  interimResults: boolean
  start: () => void
  stop: () => void
  onresult: ((event: SpeechEvent) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
}

function speechRecognition(): SpeechRecognitionLike | null {
  const w = window as unknown as {
    SpeechRecognition?: new () => SpeechRecognitionLike
    webkitSpeechRecognition?: new () => SpeechRecognitionLike
  }
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition
  return Ctor ? new Ctor() : null
}

type Mode = 'none' | 'paste' | 'voice'

/**
 * What to send an AI, along with a messy list, to get one this parser reads
 * perfectly.
 *
 * WHY THIS EXISTS. The parser has been taught a lot of real shapes — bullets,
 * emoji headings, commas inside names, prices with thousands separators — and
 * it still guesses. It has to: "Railway Hobby" and "Design & Creative" are the
 * same shape, and only a reader who knows what the shop sells can say which is
 * a product and which is a section. Every one of those guesses is a row
 * somebody has to check.
 *
 * Sellers already have something that reads a list the way a person does, on
 * the phone in their hand. So rather than guessing better, hand them the exact
 * spec and let their own assistant do the conversion once. The output needs no
 * guessing at all: headings are explicit, one item per line, price after a
 * comma or left out entirely.
 *
 * Written as instructions to the AI rather than to the seller, because that is
 * who reads it — the seller only has to paste it and their list underneath.
 */
const AI_PROMPT = `Rewrite my menu below into this exact plain-text format, and reply with nothing but the finished list.

Rules:
1. Sections: put each section heading on its own line ending with a colon. Example: "Drinks:"
2. Items: one per line, no bullets, no emoji, no numbering.
3. Price: put it after a comma. Example: "Cold coffee, 40"
4. No price: leave the line as just the name. Example: "Custom cake"
5. Optional description: put it after the price in a second comma. Example: "Cake, 450, serves four"
6. Never put a comma inside an item's name — replace it with a space or use brackets.
7. Keep every item. Do not invent prices, do not merge items, do not reorder them.
8. Drop banners, greetings, phone numbers and anything that is not a section or an item.

My list:
`

export default function MenuImport({ onAdd }: { onAdd: (rows: ParsedRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const [mode, setMode] = useState<Mode>('none')
  const [scanning, setScanning] = useState(false)
  const [listening, setListening] = useState(false)
  const [pasted, setPasted] = useState('')
  const [promptCopied, setPromptCopied] = useState(false)
  const [heard, setHeard] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [note, setNote] = useState<string | null>(null)

  /**
   * Decided once, on mount. Firefox and iOS Safari have no SpeechRecognition
   * at all, and a button that only reports its own unavailability is worse than
   * no button.
   */
  const [voiceSupported, setVoiceSupported] = useState(false)
  useEffect(() => {
    setVoiceSupported(
      typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window),
    )
  }, [])

  // Recognition holds the microphone until it is told to stop. Leaving the page
  // mid-dictation must not leave it running.
  useEffect(() => () => recognitionRef.current?.stop(), [])

  const added = (rows: ParsedRow[]) => {
    const missing = rows.filter((row) => row.price === '').length
    setNote(
      `Added ${rows.length} ${rows.length === 1 ? 'item' : 'items'}.` +
        (missing > 0
          ? ` ${missing} had no price I could read — fill those in.`
          : ' Check every price before you submit.'),
    )
  }

  const scan = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    setNote(null)
    setScanning(true)
    try {
      const items = await extractMenu(file)
      const rows = items.map((item) => ({
        name: item.name,
        price: String(item.price),
        description: item.description,
      }))
      onAdd(rows)
      added(rows)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Scanning failed. Type the items in.')
    } finally {
      setScanning(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const applyPaste = () => {
    setError(null)
    setNote(null)
    const rows = parseMenuList(pasted)
    if (rows.length === 0) {
      setError('Could not read any items from that. One item per line: name, price, description.')
      return
    }
    onAdd(rows)
    added(rows)
    setPasted('')
    setMode('none')
  }

  const startListening = () => {
    const recognition = speechRecognition()
    if (!recognition) {
      setVoiceSupported(false)
      return
    }
    setError(null)
    setNote(null)
    setHeard('')

    recognition.lang = 'en-IN'
    recognition.continuous = true
    recognition.interimResults = true

    let transcript = ''
    recognition.onresult = (event) => {
      let live = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        if (result.isFinal) transcript += `${result[0].transcript} `
        else live += result[0].transcript
      }
      setHeard(`${transcript}${live}`.trim())
    }
    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed'
          ? 'Microphone permission was refused. Type the items in, or allow the microphone and try again.'
          : 'Could not hear that. Try again, or type the items in.',
      )
      setListening(false)
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setListening(false)
  }

  const applySpeech = () => {
    setError(null)
    setNote(null)
    const rows = parseMenuSpeech(heard)
    if (rows.length === 0) {
      setError('Nothing to add from that. Try again, or type the items in.')
      return
    }
    onAdd(rows)
    added(rows)
    setHeard('')
    setMode('none')
  }

  return (
    /* Its own segment on the form now rather than a card nested inside the
       Menu panel, so it takes the panel treatment every other segment has.
       The heading rises to the brand colour and the section type scale for
       the same reason: it is a peer of "The basics" and "Menu", not a note
       inside one of them. */
    <section className="liquid-glass-panel rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Add items faster
          </p>
          <p className="mt-1 text-[15px] text-white/45">
            Photograph your menu, paste a list, or say the items out loud. You can always type
            them instead.
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap gap-2">
          <Button
            variant="secondary"
            loading={scanning}
            onClick={() => inputRef.current?.click()}
          >
            {scanning ? (
              <Loader2 size={13} aria-hidden="true" className="animate-spin" />
            ) : (
              <Camera size={13} aria-hidden="true" />
            )}
            {scanning ? 'Reading' : 'Scan photo'}
          </Button>

          <Button
            variant="secondary"
            aria-expanded={mode === 'paste'}
            onClick={() => setMode(mode === 'paste' ? 'none' : 'paste')}
          >
            <ClipboardList size={13} aria-hidden="true" />
            Paste list
          </Button>

          {/* Hidden where unsupported rather than shown and broken. */}
          {voiceSupported && (
            <Button
              variant="secondary"
              aria-expanded={mode === 'voice'}
              onClick={() => setMode(mode === 'voice' ? 'none' : 'voice')}
            >
              <Mic size={13} aria-hidden="true" />
              Speak
            </Button>
          )}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={SCAN_ACCEPT}
        className="sr-only"
        onChange={(event) => void scan(event.target.files?.[0])}
      />

      {mode === 'paste' && (
        <div className="mt-3.5">
          <label
            htmlFor="menu-paste"
            className="mb-1.5 block font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
          >
            One item per line
          </label>
          <textarea
            id="menu-paste"
            rows={5}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={'Chocolate Fudge Cake, 450, Dark chocolate, serves four\nWalnut Brownie Box, 280, Six pieces\nMasala Chai, 20'}
            className="liquid-glass-input w-full resize-y rounded-xl px-4 py-2.5 font-mono text-[15.5px] text-white placeholder-white/25"
          />
          <p className="mt-1.5 text-[15px] text-white/35">
            Name, price, description. Pasting straight from a spreadsheet works — the header row
            is ignored. Sections work too: put a heading on its own line ending with a colon.
          </p>

          {/* THE ESCAPE HATCH FOR A MESSY LIST. A WhatsApp broadcast full of
              emoji and bullets parses well now and still guesses — it has to,
              because a product and a section are the same shape on the page.
              A seller's own assistant can read it the way a person does, so
              this hands over the exact spec and lets them do the conversion
              once, at which point nothing is left to guess. */}
          <div className="mt-3 rounded-2xl border border-white/8 bg-white/[0.03] p-3.5">
            <p className="text-[15px] leading-relaxed text-white/55">
              Messy list — emoji, bullets, WhatsApp forward? Copy this prompt, send it to
              ChatGPT or Gemini with your list underneath, and paste back what it gives you.
            </p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  navigator.clipboard
                    .writeText(AI_PROMPT)
                    .then(() => setPromptCopied(true))
                    .catch(() => {
                      // Clipboard refused — WhatsApp's in-app browser does
                      // this. Drop the prompt into the box itself so it can be
                      // selected by hand; their list goes underneath it, which
                      // is where it was going anyway.
                      setPasted(AI_PROMPT)
                    })
                }}
              >
                {promptCopied ? (
                  <>
                    <Check size={13} aria-hidden="true" />
                    Prompt copied
                  </>
                ) : (
                  <>
                    <ClipboardList size={13} aria-hidden="true" />
                    Copy the prompt
                  </>
                )}
              </Button>
            </div>
          </div>
          <div className="mt-2.5 flex gap-2">
            <Button onClick={applyPaste} disabled={pasted.trim() === ''}>
              Add these items
            </Button>
            <Button variant="ghost" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {mode === 'voice' && (
        <div className="mt-3.5">
          <p className="text-[15px] leading-relaxed text-white/45">
            Say the item then its price — “chocolate cake two hundred rupees, brownie eighty”.
            Pause between items or say “next”.
          </p>

          <div
            aria-live="polite"
            className="liquid-glass-input mt-2.5 min-h-[4.5rem] rounded-xl px-4 py-2.5 text-[16px] text-white/80"
          >
            {heard || (
              <span className="text-white/30">
                {listening ? 'Listening…' : 'Nothing heard yet.'}
              </span>
            )}
          </div>

          <div className="mt-2.5 flex flex-wrap gap-2">
            {listening ? (
              <Button variant="danger" onClick={stopListening}>
                <Square size={13} aria-hidden="true" />
                Stop
              </Button>
            ) : (
              <Button variant="secondary" onClick={startListening}>
                <Mic size={13} aria-hidden="true" />
                {heard ? 'Listen again' : 'Start listening'}
              </Button>
            )}
            <Button onClick={applySpeech} disabled={heard.trim() === '' || listening}>
              Add these items
            </Button>
            <Button variant="ghost" onClick={() => setMode('none')}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2.5 text-[15px] text-red-400">
          {error}
        </p>
      )}
      {note && !error && (
        <p role="status" className="mt-2.5 text-[15px] text-brand-300">
          {note}
        </p>
      )}
    </section>
  )
}
