import { useEffect, useRef, useState } from 'react'
import { Camera, ClipboardList, Loader2, Mic, Square } from 'lucide-react'
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

export default function MenuImport({ onAdd }: { onAdd: (rows: ParsedRow[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null)
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)

  const [mode, setMode] = useState<Mode>('none')
  const [scanning, setScanning] = useState(false)
  const [listening, setListening] = useState(false)
  const [pasted, setPasted] = useState('')
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
    <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
            Add items faster
          </p>
          <p className="mt-1 text-[12.5px] text-white/45">
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
            className="mb-1.5 block font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/40 uppercase"
          >
            One item per line
          </label>
          <textarea
            id="menu-paste"
            rows={5}
            value={pasted}
            onChange={(event) => setPasted(event.target.value)}
            placeholder={'Chocolate Fudge Cake, 450, Dark chocolate, serves four\nWalnut Brownie Box, 280, Six pieces\nMasala Chai, 20'}
            className="liquid-glass-input w-full resize-y rounded-xl px-4 py-2.5 font-mono text-[13px] text-white placeholder-white/25"
          />
          <p className="mt-1.5 text-[12.5px] text-white/35">
            Name, price, description. Pasting straight from a spreadsheet works — the header row
            is ignored.
          </p>
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
          <p className="text-[12.5px] leading-relaxed text-white/45">
            Say the item then its price — “chocolate cake two hundred rupees, brownie eighty”.
            Pause between items or say “next”.
          </p>

          <div
            aria-live="polite"
            className="liquid-glass-input mt-2.5 min-h-[4.5rem] rounded-xl px-4 py-2.5 text-[13.5px] text-white/80"
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
        <p role="alert" className="mt-2.5 text-[12.5px] text-red-400">
          {error}
        </p>
      )}
      {note && !error && (
        <p role="status" className="mt-2.5 text-[12.5px] text-brand-300">
          {note}
        </p>
      )}
    </div>
  )
}
