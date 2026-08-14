import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  GoogleAuthProvider,
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { OWNER_EMAIL, auth, db, isThaparEmail } from '../lib/firebase'

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
  signInWithGoogle: () => Promise<void>
  sendLink: (email: string) => Promise<void>
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

export const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,20}$/

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authResolved, setAuthResolved] = useState(false)
  const [profileResolved, setProfileResolved] = useState(false)

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

      const trimmed = username.trim()
      if (!USERNAME_PATTERN.test(trimmed)) {
        throw new Error('3 to 20 characters, letters, numbers and underscores only.')
      }

      const key = trimmed.toLowerCase()
      await runTransaction(db, async (tx) => {
        const usernameRef = doc(db, 'usernames', key)
        const existing = await tx.get(usernameRef)
        if (existing.exists()) throw new Error('That username is taken.')

        tx.set(usernameRef, { uid: current.uid })
        tx.set(doc(db, 'users', current.uid), {
          uid: current.uid,
          email: current.email,
          username: trimmed,
          // Never set from the client. Flip it by hand in the Firebase console;
          // the rules forbid a user changing their own.
          isModerator: false,
          createdAt: serverTimestamp(),
        })
      })
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
  const canPost = status === 'ready' && isThaparEmail(user?.email)

  const value = useMemo(
    () => ({
      user,
      profile,
      status,
      needsUsername,
      canPost,
      signInWithGoogle,
      sendLink,
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
      signInWithGoogle,
      sendLink,
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
