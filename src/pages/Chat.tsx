import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { MessagesSquare, SendHorizontal, Trash2 } from 'lucide-react'
import Avatar from '../components/ui/Avatar'
import Button from '../components/ui/Button'
import Modal from '../components/ui/Modal'
import LoadingLine from '../components/ui/LoadingLine'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { ALLOWED_EMAIL_DOMAIN } from '../lib/firebase'
import { MAX_MESSAGE_LENGTH, deleteMessage, sendMessage, subscribeToMessages } from '../data/chat'
import type { ChatMessage } from '../data/chat'

/** Client-side spacing between sends. See the note in the composer below. */
const COOLDOWN_MS = 2000

function timeLabel(date: Date | null): string {
  if (!date) return 'sending'
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  return sameDay
    ? date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
    : date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) +
        ' ' +
        date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })
}

export default function Chat() {
  const { profile, status, canPost, needsUsername } = useAuth()
  const [messages, setMessages] = useState<ChatMessage[] | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState<ChatMessage | null>(null)

  const scrollRef = useRef<HTMLDivElement>(null)
  const pinnedToBottom = useRef(true)
  const lastSentAt = useRef(0)

  useEffect(() => {
    return subscribeToMessages(
      (next) => {
        setMessages(next)
        setLoadError(null)
      },
      (error) => setLoadError(error.message),
    )
  }, [])

  // Follow new messages, but only when already at the bottom. Yanking someone
  // back down while they are reading history is the classic chat annoyance.
  useLayoutEffect(() => {
    const container = scrollRef.current
    if (!container || !pinnedToBottom.current) return
    container.scrollTop = container.scrollHeight
  }, [messages])

  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) return
    const distance = container.scrollHeight - container.scrollTop - container.clientHeight
    pinnedToBottom.current = distance < 80
  }

  const send = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!profile) return
    setSendError(null)

    const since = Date.now() - lastSentAt.current
    if (since < COOLDOWN_MS) {
      setSendError('Give it a second between messages.')
      return
    }

    setSending(true)
    try {
      await sendMessage({ uid: profile.uid, username: profile.username }, draft)
      lastSentAt.current = Date.now()
      setDraft('')
      pinnedToBottom.current = true
    } catch (cause) {
      setSendError(cause instanceof Error ? cause.message : 'Could not send that.')
    } finally {
      setSending(false)
    }
  }

  const remaining = MAX_MESSAGE_LENGTH - draft.length

  return (
    <div className="flex h-[calc(100dvh-13rem)] min-h-[24rem] flex-col gap-3 md:h-[calc(100dvh-11rem)]">
      <p className="liquid-glass-panel shrink-0 rounded-2xl px-5 py-3 text-[13.5px] leading-relaxed text-white/50">
        One room, for feedback about the site — bugs, things that are confusing, things you want.
        Everyone can read it. Only Thapar accounts can post.
      </p>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="liquid-glass-panel min-h-0 flex-1 space-y-3 overflow-y-auto rounded-3xl p-4 sm:p-5"
      >
        {loadError && (
          <p role="alert" className="text-[14px] text-red-400">
            Could not load the room: {loadError}
          </p>
        )}

        {messages === null && !loadError && (
          <LoadingLine label="Loading messages…" inset={false} />
        )}

        {messages?.length === 0 && (
          <div className="flex flex-col items-center py-12 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full border border-white/10 bg-white/[0.06] text-white/35">
              <MessagesSquare size={22} aria-hidden="true" />
            </span>
            <p className="mt-5 text-[17px] font-extrabold text-white">Nothing here yet</p>
            <p className="mt-2 max-w-sm text-[14px] text-white/45">
              Be the first. Found a bug, or something that annoyed you? Say so.
            </p>
          </div>
        )}

        {messages?.map((message) => (
          <article key={message.id} className="flex items-start gap-3">
            <Avatar name={message.username} className="mt-0.5" />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <span className="truncate text-[14px] font-bold text-white">
                  {message.username}
                </span>
                <time className="shrink-0 font-mono text-[10px] tracking-wider text-white/30">
                  {timeLabel(message.createdAt)}
                </time>
              </div>
              {message.deleted ? (
                <p className="mt-0.5 text-[14px] text-white/25 italic">
                  Message removed by a moderator
                </p>
              ) : (
                <p className="mt-0.5 text-[14.5px] leading-relaxed break-words text-white/80">
                  {message.text}
                </p>
              )}
            </div>

            {profile?.isModerator && !message.deleted && (
              <button
                type="button"
                onClick={() => setConfirmDelete(message)}
                aria-label={`Remove message from ${message.username}`}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 p-1.5 text-white/30 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            )}
          </article>
        ))}
      </div>

      {status === 'ready' && canPost && needsUsername ? (
        <div className="shrink-0">
          <ChooseUsername reason="This is the name shown next to your messages here." />
        </div>
      ) : status === 'ready' && canPost && profile ? (
        <form onSubmit={send} className="liquid-glass-panel shrink-0 rounded-2xl p-2.5">
          <div className="flex items-end gap-2.5">
            <label htmlFor="chat-input" className="sr-only">
              Message
            </label>
            <textarea
              id="chat-input"
              rows={1}
              value={draft}
              maxLength={MAX_MESSAGE_LENGTH}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                // Enter sends, Shift+Enter makes a new line — what everyone
                // already expects from every other chat box.
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault()
                  void send(event)
                }
              }}
              placeholder="Something broken? Something missing?"
              className="liquid-glass-input max-h-32 min-h-[2.75rem] w-full resize-y rounded-xl px-4 py-2.5 text-[14px] text-white placeholder-white/30"
            />
            <Button
              type="submit"
              variant="primary"
              loading={sending}
              disabled={draft.trim() === ''}
              className="shrink-0"
            >
              <SendHorizontal size={13} aria-hidden="true" />
              Send
            </Button>
          </div>

          {(sendError || remaining < 100) && (
            <p
              role={sendError ? 'alert' : undefined}
              className={`px-2 pt-1.5 text-[12.5px] ${sendError ? 'text-red-400' : 'text-white/35'}`}
            >
              {sendError ?? `${remaining} characters left`}
            </p>
          )}
        </form>
      ) : (
        <div className="liquid-glass-panel flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl px-5 py-3.5">
          <p className="text-[13.5px] text-white/50">
            {status === 'ready'
              ? // Signed in, but not on a Thapar address. Say which account
                // would work rather than only that this one does not.
                `Reading is open to everyone. Posting here needs an @${ALLOWED_EMAIL_DOMAIN} account.`
              : 'Reading is open to everyone. Posting needs a Thapar account.'}
          </p>
          {status !== 'ready' && <Button to="/signin">Sign in</Button>}
        </div>
      )}

      <Modal
        open={confirmDelete !== null}
        onClose={() => setConfirmDelete(null)}
        title="Remove this message?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmDelete(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                const target = confirmDelete
                if (!target) return
                setConfirmDelete(null)
                void deleteMessage(target.id)
              }}
            >
              Remove
            </Button>
          </>
        }
      >
        <p className="text-[14px] leading-relaxed text-white/70">
          The text is erased, not just hidden — it will not be readable from the database either.
          Who posted it and when stays, so a repeat offender is still visible to you.
        </p>
      </Modal>
    </div>
  )
}
