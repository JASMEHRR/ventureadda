import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signOut as firebaseSignOut,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, onSnapshot, runTransaction, serverTimestamp } from 'firebase/firestore'
import { ALLOWED_EMAIL_DOMAIN, OWNER_EMAIL, auth, db, isAllowedEmail } from '../lib/firebase'

export type Profile = {
  uid: string
  email: string
  username: string
  isModerator: boolean
}

export type AuthStatus = 'loading' | 'signedOut' | 'needsUsername' | 'ready'

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  status: AuthStatus
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
        setProfile({
          ...stored,
          isModerator: stored.isModerator || stored.email.toLowerCase() === OWNER_EMAIL,
        })
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

  const sendLink = useCallback(async (email: string) => {
    const address = email.trim().toLowerCase()
    if (!isAllowedEmail(address)) {
      throw new Error(`Use your @${ALLOWED_EMAIL_DOMAIN} address.`)
    }
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

      if (!isAllowedEmail(address)) {
        throw new Error(`Use your @${ALLOWED_EMAIL_DOMAIN} address.`)
      }

      const credential = await signInWithEmailLink(auth, address, href)
      window.localStorage.removeItem(EMAIL_KEY)

      // Belt and braces: the check above runs in the browser and the Auth REST
      // API can be called directly, so verify what actually came back before
      // letting the session stand.
      if (!credential.user.email || !isAllowedEmail(credential.user.email)) {
        await firebaseSignOut(auth)
        throw new Error(`Only @${ALLOWED_EMAIL_DOMAIN} accounts can sign in.`)
      }
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
      : !profile
        ? 'needsUsername'
        : 'ready'

  const value = useMemo(
    () => ({ user, profile, status, sendLink, completeSignInFromLink, claimUsername, signOut }),
    [user, profile, status, sendLink, completeSignInFromLink, claimUsername, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
