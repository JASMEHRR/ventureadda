import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc, onSnapshot, runTransaction, serverTimestamp, updateDoc } from 'firebase/firestore'
import { ALLOWED_EMAIL_DOMAIN, OWNER_EMAIL, auth, db, isThaparEmail } from '../lib/firebase'
import { reportError } from '../lib/errors'

export type Profile = {
  uid: string
  email: string
  username: string
  isModerator: boolean
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
export type AuthStatus = 'loading' | 'signedOut' | 'ready'

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  status: AuthStatus
  /** Signed in, but has not claimed a name yet. Prompt at the point of action. */
  needsUsername: boolean
  /**
   * May post in chat and list a venture — @thapar.edu or the owner. Mirrors
   * isThaparUser() in firestore.rules, for hiding an action rather than
   * letting someone fill in a form and eat a permission-denied.
   */
  canPost: boolean
  /**
   * The Thapar address on this account, whether it signed in or was added
   * afterwards. Null when there is not one.
   */
  thaparEmail: string | null
  /**
   * The site owner, by address, mirroring isOwner() in firestore.rules.
   *
   * Used for chrome that exists for whoever is building this and nobody else —
   * the design-system reference. It hides a link, it does not protect
   * anything: the route is still reachable by typing it, and the page shows
   * component samples, not data. Anything that actually needs protecting is
   * guarded by the rules, not by this.
   */
  isOwner: boolean
  signInWithGoogle: () => Promise<void>
  sendLink: (email: string) => Promise<void>
  /** Mails a verification link that adds a Thapar address to this account. */
  sendThaparLink: (email: string) => Promise<void>
  /**
   * Completes that: call it with the current URL on the page the link lands
   * on. 'none' means this URL is not one of those links, which is the usual
   * case and is not an error.
   */
  completeThaparLink: (href: string) => Promise<'linked' | 'none'>
  /** Returns 'needsEmail' when the link was opened in a different browser. */
  completeSignInFromLink: (href: string, fallbackEmail?: string) => Promise<'done' | 'needsEmail'>
  claimUsername: (username: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

/**
 * Where the address is stashed between requesting the link and clicking it.
 * Firebase needs the original address to complete sign-in, and the link itself
 * does not carry it — that is what stops someone forwarding their link to you
 * and signing in as themselves on your machine.
 */
const EMAIL_KEY = 'ventureadda.signInEmail'

/**
 * The address waiting to be added to an already-signed-in account.
 *
 * Separate from EMAIL_KEY on purpose. That one means "finish signing in as
 * this person"; this one means "prove this second address belongs to the
 * person already here". The two links look identical to Firebase, and putting
 * both intents in one key would leave the app guessing which of the two a
 * returning click meant.
 */
const LINK_KEY = 'ventureadda.linkThaparEmail'

/** Every address this account has proved it owns: the one it signed in with,
 *  plus any linked afterwards. */
function accountEmails(user: User | null): string[] {
  if (!user) return []
  return [user.email, ...user.providerData.map((entry) => entry.email)].filter(
    (email): email is string => typeof email === 'string' && email !== '',
  )
}

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

/** Sentinel so the "taken" case survives the error wrapper below unrelabelled. */
const TAKEN = 'That username is taken.'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)
  /**
   * The signed-in address's own pre-approval entry, or null if there isn't
   * one. Read once per session rather than exposed as a hook elsewhere,
   * because the two things it decides — posting rights and an automatic
   * moderator grant below — both live here already.
   */
  const [preApproved, setPreApproved] = useState<{ moderator: boolean } | null>(null)

  useEffect(() => {
    return onAuthStateChanged(auth, (next) => {
      setUser(next)
      setAuthResolved(true)
      if (!next) {
        setProfile(null)
        setProfileResolved(true)
      }
    })
  }, [])

  // Live subscription rather than a one-off read, so flipping isModerator in
  // the Firebase console takes effect without the user signing out and in.
  useEffect(() => {
    if (!user) return
    setProfileResolved(false)
    return onSnapshot(
      doc(db, 'users', user.uid),
      (snapshot) => {
        if (!snapshot.exists()) {
          setProfile(null)
          setProfileResolved(true)
          return
        }
        const stored = snapshot.data() as Profile
        // Mirrors isModerator() in firestore.rules, which grants the owner
        // moderator rights by address. The stored flag cannot carry it: the
        // users create rule forces isModerator to false for everyone, so the
        // owner's own document says false while the rules say true. Without
        // this line the owner is refused the moderator page by the client
        // while Firestore would happily serve them every query on it.
        //
        // Read from the auth token rather than the document, because that is
        // what the rules read — request.auth.token.email. A document field
        // could be absent or stale; the token cannot, and the two agreeing is
        // the whole point of mirroring.
        const isOwner = (user.email ?? '').toLowerCase() === OWNER_EMAIL
        setProfile({ ...stored, isModerator: stored.isModerator || isOwner })
        setProfileResolved(true)
      },
      () => {
        // A rules rejection or a dropped connection. Treat as "no profile"
        // rather than hanging on a spinner forever.
        setProfile(null)
        setProfileResolved(true)
      },
    )
  }, [user])

  // A one-off read, not a subscription: this only has to catch the moment
  // someone signs in for the first time after being pre-approved. The rules
  // let anyone read their own entry here — see firestore.rules on
  // approvedEmails/{emailId} — so this never touches another account's.
  useEffect(() => {
    if (!user?.email) {
      setPreApproved(null)
      return
    }
    let cancelled = false
    getDoc(doc(db, 'approvedEmails', user.email.toLowerCase()))
      .then((snapshot) => {
        if (cancelled) return
        setPreApproved(snapshot.exists() ? { moderator: snapshot.data().moderator === true } : null)
      })
      .catch(() => {
        if (!cancelled) setPreApproved(null)
      })
    return () => {
      cancelled = true
    }
  }, [user])

  // Applies a moderator pre-approval the moment both pieces are in: the
  // profile document exists (claimUsername has run) and the pre-approval
  // read above has resolved. Stops itself once profile.isModerator flips to
  // true, because the write that does that re-fires the onSnapshot above and
  // this effect re-runs with a profile that no longer needs it.
  useEffect(() => {
    if (!user || !profile || profile.isModerator || !preApproved?.moderator) return
    void updateDoc(doc(db, 'users', user.uid), { isModerator: true }).catch(() => {
      // Pre-approval is a convenience, not a promise. If this fails, the
      // owner's existing username-lookup panel is still there as a fallback.
    })
  }, [user, profile, preApproved])

  /**
   * The primary way in. Thapar runs on Google Workspace, so a student is
   * already signed into Google as their @thapar.edu address — this is one tap,
   * sends no mail, and sidesteps the spam folder and the cross-device problem
   * that the email link has.
   *
   * No domain check anywhere in here. Anyone with a verified Google address
   * may hold an account now; what they may *do* is gated at the action.
   */
  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider()
    // Always show the chooser. Without this, anyone signed into a personal
    // Google account is silently signed in with it, which on a shared campus
    // machine is both wrong and confusing.
    provider.setCustomParameters({ prompt: 'select_account' })
    try {
      await signInWithPopup(auth, provider)
    } catch (cause) {
      const code = (cause as { code?: string })?.code
      // A blocked popup is the normal case in an in-app browser (opening the
      // site from WhatsApp does exactly this), so fall back rather than
      // reporting a failure the person cannot act on.
      if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
        await signInWithRedirect(auth, provider)
        return
      }
      // Closing the popup yourself is not an error worth showing.
      if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return
      throw cause
    }
  }, [])

  const sendLink = useCallback(async (email: string) => {
    const address = email.trim().toLowerCase()
    await sendSignInLinkToEmail(auth, address, {
      // Must be listed under Authentication → Settings → Authorized domains,
      // or Firebase rejects the request.
      url: `${window.location.origin}/signin`,
      handleCodeInApp: true,
    })
    window.localStorage.setItem(EMAIL_KEY, address)
  }, [])

  /**
   * ADDING A THAPAR ADDRESS TO AN ACCOUNT THAT DID NOT SIGN IN WITH ONE.
   *
   * The problem this solves: someone taps Sign in on a phone that is signed
   * into a personal Gmail, gets an account, and then finds out that listing a
   * venture needs an @thapar.edu address. Their only route was to sign out and
   * start again as somebody else — losing their username, their orders and
   * their cart — for what is the same person with a second address.
   *
   * The proof is the same one the site already uses for a first sign-in: a
   * link mailed to the address, which nobody who cannot read that inbox can
   * click. What differs is what happens on the way back — the credential is
   * *linked* to the session that is already open rather than exchanged for a
   * new one, so the account, the username and everything filed under it stay
   * exactly where they were.
   *
   * The domain is checked here to keep the mail from being sent at all, but
   * that check is a courtesy: firestore.rules re-derives posting rights from
   * the identities on the token, and a client that skipped this would still
   * be refused there.
   */
  const sendThaparLink = useCallback(async (email: string) => {
    const address = email.trim().toLowerCase()
    if (!isThaparEmail(address)) {
      throw new Error(`Enter your @${ALLOWED_EMAIL_DOMAIN} address.`)
    }
    if (!auth.currentUser) throw new Error('You are not signed in.')
    await sendSignInLinkToEmail(auth, address, {
      // Back to the profile rather than to /signin: this person is signed in
      // already, and the page that asked for the address is the page that
      // should show the result.
      url: `${window.location.origin}/profile`,
      handleCodeInApp: true,
    })
    window.localStorage.setItem(LINK_KEY, address)
  }, [])

  const completeThaparLink = useCallback(async (href: string): Promise<'linked' | 'none'> => {
    const address = window.localStorage.getItem(LINK_KEY)
    if (!address || !isSignInWithEmailLink(auth, href)) return 'none'

    const current = auth.currentUser
    // The link only works in the browser that asked for it, because linking
    // needs the open session to link *to*. Said plainly rather than silently
    // doing nothing, and the pending address is kept so the same link still
    // works when they come back to the right browser.
    if (!current) {
      throw new Error('Open this link in the browser where you are signed in.')
    }

    try {
      await linkWithCredential(current, EmailAuthProvider.credentialWithLink(address, href))
      // The identities that firestore.rules reads live in the ID token, and
      // the one in hand was minted before the link existed. Without this
      // refresh the next write is refused for a good half hour and the app
      // looks broken at the exact moment it was supposed to start working.
      await current.getIdToken(true)
      window.localStorage.removeItem(LINK_KEY)
      return 'linked'
    } catch (cause) {
      const code = (cause as { code?: string })?.code
      window.localStorage.removeItem(LINK_KEY)
      if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
        throw new Error(
          'That address already has its own account here. Sign out and sign in with it instead.',
        )
      }
      if (code === 'auth/invalid-action-code' || code === 'auth/expired-action-code') {
        throw new Error('That link has expired or has already been used. Send a new one.')
      }
      throw new Error(reportError('completeThaparLink', cause))
    }
  }, [])

  const completeSignInFromLink = useCallback(
    async (href: string, fallbackEmail?: string): Promise<'done' | 'needsEmail'> => {
      if (!isSignInWithEmailLink(auth, href)) return 'done'

      const stored = window.localStorage.getItem(EMAIL_KEY)
      const address = (fallbackEmail ?? stored ?? '').trim().toLowerCase()
      // Opening the link on a different device or browser leaves nothing in
      // storage, so the address has to be asked for again.
      if (!address) return 'needsEmail'

      // No domain check, on either side of this call. It used to reject here
      // and then sign the session back out if the returned address was not a
      // Thapar one; both would now lock out precisely the accounts the rules
      // have started allowing.
      await signInWithEmailLink(auth, address, href)
      window.localStorage.removeItem(EMAIL_KEY)
      return 'done'
    },
    [],
  )

  /**
   * Claims a username and creates the profile in one transaction.
   *
   * The usernames collection exists purely so uniqueness can be enforced: a
   * document id is unique by definition, and the rules only allow creating one
   * that does not already exist. Checking with a query first would leave a race
   * where two people picking the same name at once both see it free.
   */
  const claimUsername = useCallback(
    async (username: string) => {
      const current = auth.currentUser
      if (!current?.email) throw new Error('You are not signed in.')
      const email = current.email

      const trimmed = username.trim()
      if (!USERNAME_PATTERN.test(trimmed)) {
        throw new Error('3 to 20 characters, letters, numbers and underscores only.')
      }

      const key = trimmed.toLowerCase()
      try {
        await runTransaction(db, async (tx) => {
          const usernameRef = doc(db, 'usernames', key)
          const existing = await tx.get(usernameRef)
          if (existing.exists()) throw new Error(TAKEN)

          tx.set(usernameRef, { uid: current.uid })
          tx.set(doc(db, 'users', current.uid), {
            uid: current.uid,
            email,
            username: trimmed,
            // Never set from the client. Flip it by hand in the Firebase
            // console; the rules forbid a user changing their own.
            isModerator: false,
            createdAt: serverTimestamp(),
          })
        })
      } catch (cause) {
        // A taken name is a legitimate answer, not a fault, so it keeps its own
        // wording instead of being relabelled as a database error.
        if (cause instanceof Error && cause.message === TAKEN) throw cause
        throw new Error(reportError('claimUsername', cause))
      }
    },
    [],
  )

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const status: AuthStatus = !authResolved || (user && !profileResolved)
    ? 'loading'
    : !user
      ? 'signedOut'
      : 'ready'

  const needsUsername = status === 'ready' && !profile
  // A pre-approved outside address gets the same posting rights a Thapar
  // address has by default — that is the entire point of approving one.
  /**
   * Any address on the account, not only the one that signed in — that is the
   * whole point of linking one. Mirrors isThaparUser() in firestore.rules,
   * which reads the same set off the token.
   */
  const thaparEmail = accountEmails(user).find((email) => isThaparEmail(email)) ?? null
  const canPost = status === 'ready' && (thaparEmail !== null || preApproved !== null)
  const isOwner = status === 'ready' && (user?.email ?? '').toLowerCase() === OWNER_EMAIL

  const value = useMemo(
    () => ({
      user,
      profile,
      status,
      needsUsername,
      canPost,
      thaparEmail,
      isOwner,
      signInWithGoogle,
      sendLink,
      sendThaparLink,
      completeThaparLink,
      completeSignInFromLink,
      claimUsername,
      signOut,
    }),
    [
      user,
      profile,
      status,
      needsUsername,
      canPost,
      thaparEmail,
      isOwner,
      signInWithGoogle,
      sendLink,
      sendThaparLink,
      completeThaparLink,
      completeSignInFromLink,
      claimUsername,
      signOut,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
