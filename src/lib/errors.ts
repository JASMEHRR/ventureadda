/**
 * Turns a thrown value into something both a person and a developer can act on.
 *
 * This exists because of a real cost. A `permission-denied` surfaced as
 * Firestore's bare "Missing or insufficient permissions" told us nothing about
 * which of eight writes failed or which rule refused it, and finding out took
 * an investigation across the console, the deployed bundle and the build log.
 * The message a user sees should say what to do; the console should say enough
 * to skip that investigation next time.
 */

type FirebaseLike = { code?: unknown; message?: unknown; name?: unknown }

function codeOf(cause: unknown): string | null {
  if (!cause || typeof cause !== 'object') return null
  const code = (cause as FirebaseLike).code
  return typeof code === 'string' ? code : null
}

/**
 * Plain-language message per Firestore error code.
 *
 * Only codes that can actually reach a user here are translated. Anything else
 * keeps its original message rather than being flattened into "something went
 * wrong", which is the failure mode this whole module exists to avoid.
 */
const MESSAGES: Record<string, string> = {
  'permission-denied':
    'The database refused that write. If you just signed in, try again — otherwise this is a bug, and the details are in the browser console.',
  unauthenticated: 'You are signed out. Sign in and try again.',
  unavailable: 'Could not reach the database. Check your connection and try again.',
  'deadline-exceeded': 'That took too long. Check your connection and try again.',
  'failed-precondition': 'The database needs an index for that query. The details are in the console.',
  'resource-exhausted': 'The daily database quota is used up. Try again tomorrow.',
  'already-exists': 'That already exists.',
  'not-found': 'That no longer exists. It may have been removed.',
}

/**
 * Logs the full error against a named call site and returns a message fit to
 * show someone.
 *
 * `context` is the thing that failed in the app's own terms — "createVenture:
 * venture document" — because "permission-denied" on its own does not say
 * which write, and that was exactly the question that cost us a round.
 */
export function reportError(context: string, cause: unknown): string {
  const code = codeOf(cause)
  const message = cause instanceof Error ? cause.message : String(cause)

  console.error(
    `[ventureadda] ${context} failed`,
    { code: code ?? '(no code)', message, error: cause },
  )

  if (code && MESSAGES[code]) return MESSAGES[code]
  return message || 'Something went wrong. Try again.'
}
