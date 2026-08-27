/**
 * Turning an email address into the name the site files you under.
 *
 * Its own module because it is the one piece of the sign-in path with no
 * Firebase in it and a right answer for every input, which makes it the one
 * piece worth a test — and AuthProvider cannot be imported into one, since
 * pulling it in starts a Firebase app.
 */
/**
 * The name, taken off the front of the address rather than asked for.
 *
 * NOBODY IS ASKED TO PICK ONE ANY MORE. The claim screen sat between signing
 * in and doing the thing you signed in to do, and asked a question most people
 * have no opinion about — on a site where the answer is already known, because
 * everybody here signs in as firstname_lastname@thapar.edu and that is exactly
 * what they would have typed. It cost every new account a decision to buy
 * nothing.
 *
 * Stripped to what the rules accept: letters, numbers and underscores, 3 to 20
 * characters. A short or entirely unusable local part (a two-letter alias, a
 * non-Latin one) falls back to a generic stem, because a name nobody sees
 * being ugly is a smaller problem than an account that cannot be created.
 */
export function usernameFromEmail(email: string): string {
  const local = email.split('@')[0] ?? ''
  const cleaned = local.toLowerCase().replace(/[^a-z0-9_]/g, '')
  const stem = cleaned.slice(0, 20)
  return stem.length >= 3 ? stem : `student${stem}`.slice(0, 20)
}

/**
 * Collision handling, and why it is a suffix rather than a prompt.
 *
 * Two people can genuinely arrive at the same stem — one address with a dot
 * and one without, an alias that matches somebody's surname. Usernames are
 * permanent here (firestore.rules refuses update and delete on the claim, so
 * a released name can never be used to impersonate the person who had it),
 * which means the second arrival cannot simply take it. They get a number,
 * the way every site that has ever done this does it.
 */
export function withSuffix(stem: string, attempt: number): string {
  const suffix = String(attempt)
  return `${stem.slice(0, 20 - suffix.length)}${suffix}`
}

/**
 * 'needsUsername' is gone on purpose.
 *
 * It used to sit between 'signedOut' and 'ready' and gated the entire app: no
 * username, no site. That was defensible when only Thapar students could get
 * an account. Now anyone with a Google address can sign in, and usernames are
 * permanent and can never be released — so an app-wide gate would let every
 * passer-by burn a name a classmate wanted, on the way to reading one page.
 *
 * A signed-in account with no profile is simply 'ready' with `profile: null`.
 * The name is asked for at the first action that attaches one to content —
 * posting in chat, listing a venture, leaving a review — via `needsUsername`
 * below, which is a fact about the session rather than a state of the app.
 */
