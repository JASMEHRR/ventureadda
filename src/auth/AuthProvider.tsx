import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import {
  EmailAuthProvider,
  GoogleAuthProvider,
  isSignInWithEmailLink,
  linkWithCredential,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  updatePassword,
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
import { usernameFromEmail, withSuffix } from './username'
import { isAvatarStyle } from '../components/ui/Avatar'
import type { AvatarStyle } from '../components/ui/Avatar'
import { reportError } from '../lib/errors'
import { renameVentureOwner } from '../data/ventures'

export type Profile = {
  uid: string
  email: string
  username: string
  isModerator: boolean
  /** Which tile stands in for them. Absent on every account written before
   *  this existed, which is what the initial has always been. */
  avatar: AvatarStyle
}

export type AuthStatus = 'loading' | 'signedOut' | 'ready'

type AuthContextValue = {
  user: User | null
  profile: Profile | null
  status: AuthStatus
  /** Signed in, but has not claimed a name yet. Prompt at the point of action. */
  needsUsername: boolean
  /**
   * Why the automatic name failed, when it did.
   *
   * The claim screen is a fallback now rather than a step, so reaching it
   * means something went wrong that the person cannot see: a write refused, a
   * name that would not derive, a connection that dropped. Showing them the
   * screen with no explanation makes an unexplained failure look like the
   * design — and leaves whoever is debugging it asking them to time a
   * spinner, which is not a question anybody can answer.
   */
  provisionError: string | null
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
  /** `challenge` rides in the link's continue URL, so whichever device opens
   *  the mail can confirm the address for the device that asked. */
  sendLink: (email: string, challenge?: string) => Promise<void>
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
  /** The tile that stands in for this account. Per account, not per device. */
  setAvatar: (avatar: AvatarStyle) => Promise<void>
  /** Renames the account. The old name stays reserved to them — see below. */
  changeUsername: (username: string) => Promise<void>
  /** True once this account can sign in with a password. */
  hasPassword: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  /** Signs in with a token minted by api/email-verify — see SignIn. */
  signInWithToken: (customToken: string) => Promise<void>
  /** Sets one, or replaces the existing one. Requires a live session. */
  setPassword: (password: string) => Promise<void>
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
  /**
   * Bumped when something grants an approval mid-session, to re-run the read
   * below.
   *
   * That read is a one-off per account, which was right while approvals only
   * ever appeared before somebody signed in. Verifying a Thapar address now
   * creates one while they are sitting on the page — and without this, the
   * verification would visibly succeed and posting stay switched off until
   * they thought to reload, which is exactly the "it says it worked but it
   * did not" the whole feature exists to avoid.
   */
  const [approvalNonce, setApprovalNonce] = useState(0)

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
        const data = snapshot.data()
        const stored = {
          ...(data as Profile),
          // Absent on every account created before the picker existed, and the
          // initial is what those have always rendered as.
          avatar: isAvatarStyle(data.avatar) ? data.avatar : 'initial',
        }
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
  }, [user, approvalNonce])

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

  const sendLink = useCallback(async (email: string, challenge?: string) => {
    const address = email.trim().toLowerCase()
    await sendSignInLinkToEmail(auth, address, {
      // Must be listed under Authentication → Settings → Authorized domains,
      // or Firebase rejects the request.
      //
      // The challenge id travels here, in the continue URL, which is the only
      // channel between the device that asked for the link and the device that
      // opens it. Without it the mail signs in whoever opened it and the
      // original device learns nothing — see api/email-verify.
      url: challenge
        ? `${window.location.origin}/signin?challenge=${encodeURIComponent(challenge)}`
        : `${window.location.origin}/signin`,
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

  /**
   * Finishes adding a Thapar address, by asking the server to check the proof.
   *
   * WHY THE SERVER. Linking the credential here, in the browser, proved the
   * address to the *user* and to nobody else — the rules cannot see the
   * difference between an address whose inbox was opened and one typed into
   * `EmailAuthProvider.credential()` with a made-up password. That is why the
   * rule reading linked identities had to be removed: with the Email/Password
   * provider enabled, it was a self-service grant of posting rights.
   *
   * So the oobCode goes to api/verify-thapar instead, which spends it against
   * Google's identity toolkit. A 200 there means the code was genuine,
   * unexpired, unspent and minted for that exact address — proof established
   * by someone other than the person claiming it. The server then writes the
   * approval the rules already trust.
   *
   * The credential is deliberately NOT linked to the account any more. It
   * bought nothing once the rule was gone, and linking a password provider for
   * an address the account does not sign in with is a second way in that
   * nobody asked for.
   */
  const completeThaparLink = useCallback(async (href: string): Promise<'linked' | 'none'> => {
    const address = window.localStorage.getItem(LINK_KEY)
    if (!address || !isSignInWithEmailLink(auth, href)) return 'none'

    const current = auth.currentUser
    // The link only works in the browser that asked for it: the grant attaches
    // to the session it was requested from, and there is no session here to
    // attach it to. The pending address is kept, so the same link still works
    // when they come back to the right browser.
    if (!current) {
      throw new Error('Open this link in the browser where you are signed in.')
    }

    // Straight out of the URL rather than from the SDK: the endpoint needs the
    // raw code, and this is the same parameter signInWithEmailLink reads.
    const oobCode = new URL(href).searchParams.get('oobCode')
    if (!oobCode) throw new Error('That link is missing its code. Send a new one.')

    const response = await fetch('/api/verify-thapar', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        idToken: await current.getIdToken(),
        email: address,
        oobCode,
      }),
    })

    window.localStorage.removeItem(LINK_KEY)

    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: string; code?: string }
      if (body.code === 'not-configured') {
        throw new Error(
          'Address checking is not switched on for this site yet. Ask a moderator to approve you instead.',
        )
      }
      throw new Error(body.error ?? 'That link could not be checked. Send a new one.')
    }

    // The grant is a document the rules read on every write, not a claim in
    // the token, so there is no token to refresh. The client's own copy of it
    // does need re-reading, though, or the page keeps saying you cannot post.
    setApprovalNonce((value) => value + 1)
    return 'linked'
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
            avatar: 'initial',
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

  /**
   * Creates the profile the first time a session turns out not to have one.
   *
   * This is what replaced the claim screen. It runs once per signed-in
   * account, off the back of the profile subscription resolving empty, and
   * takes the name from the address — see usernameFromEmail above.
   *
   * The ref is not a micro-optimisation. Without it, a create that loses the
   * race for a name re-fires the snapshot, which re-runs this, which tries
   * again: a loop that would sit there burning writes. One attempt per
   * session, and a failure leaves `needsUsername` true, which is what still
   * puts the manual claim screen in front of them.
   */
  const provisioned = useRef<string | null>(null)
  /**
   * True while the profile is being created, which is a form of loading and
   * has to be treated as one.
   *
   * Without this the session is 'ready' with no profile for the second or two
   * the write takes, and every page that asks for a name — Add venture,
   * chat, reviews — renders the claim screen in that window. Which is the one
   * screen this whole change exists to stop showing people: they tap Add
   * venture, get asked to pick a username, and the fact that one was about to
   * be picked for them is invisible.
   */
  const [provisioning, setProvisioning] = useState(false)
  const [provisionError, setProvisionError] = useState<string | null>(null)

  useEffect(() => {
    if (!user?.email || profile || !profileResolved) return
    if (provisioned.current === user.uid) return
    provisioned.current = user.uid

    const stem = usernameFromEmail(user.email)
    setProvisioning(true)
    void (async () => {
      // Four goes: the plain name, then numbered. Beyond that something is
      // wrong that another attempt will not fix, and the claim screen is the
      // honest place to end up.
      try {
        for (let attempt = 0; attempt < 4; attempt += 1) {
          try {
            await claimUsername(attempt === 0 ? stem : withSuffix(stem, attempt + 1))
            return
          } catch (cause) {
            if (cause instanceof Error && cause.message === TAKEN) continue
            const message = cause instanceof Error ? cause.message : String(cause)
            // Logged as well as surfaced. The message shown to a student is
            // written for a student; the console is where the whole error,
            // Firebase code and all, stays available.
            console.error('[ventureadda] automatic username failed', cause)
            setProvisionError(message)
            return
          }
        }
        setProvisionError(`Every name based on "${stem}" is already taken.`)
      } finally {
        // Always, including every failure path. Leaving this true would hang
        // the whole app on a spinner; false puts the claim screen back in
        // front of them, which is the fallback working as intended.
        setProvisioning(false)
      }
    })()
  }, [user, profile, profileResolved, claimUsername])

  /**
   * Changing the name the site gave you.
   *
   * WITHOUT RELEASING THE OLD ONE, which is the whole design. firestore.rules
   * refuses update and delete on a username claim, and the note there says
   * why: a released name lets the next person to take it be mistaken for
   * whoever had it before, next to reviews and ventures that are still on the
   * site under it. That rule does not have to move for a rename — it only
   * means the old claim stays where it is, still pointing at the same account.
   * You stop using a name; nobody else starts.
   *
   * The cost is a row per rename that nothing reads, and someone who has
   * cycled through five names holding all five. That is a few hundred bytes
   * against the impersonation the rule exists to stop, which is not a close
   * call.
   *
   * Re-taking a name this account already owns is allowed and is the reason
   * the transaction checks the uid rather than mere existence: changing your
   * mind back should not be the one move that is refused.
   */
  const changeUsername = useCallback(async (username: string) => {
    const current = auth.currentUser
    if (!current) throw new Error('You are not signed in.')

    const trimmed = username.trim()
    if (!USERNAME_PATTERN.test(trimmed)) {
      throw new Error('3 to 20 characters, letters, numbers and underscores only.')
    }

    const key = trimmed.toLowerCase()
    try {
      await runTransaction(db, async (tx) => {
        const usernameRef = doc(db, 'usernames', key)
        const existing = await tx.get(usernameRef)
        if (existing.exists() && existing.data().uid !== current.uid) throw new Error(TAKEN)

        if (!existing.exists()) tx.set(usernameRef, { uid: current.uid })
        tx.update(doc(db, 'users', current.uid), { username: trimmed })
      })
    } catch (cause) {
      if (cause instanceof Error && cause.message === TAKEN) throw cause
      throw new Error(reportError('changeUsername', cause))
    }

    // Their listings carry the name so a directory card needs no extra read.
    // After the transaction, and not awaited into the failure path: the rename
    // is already done, and a shopfront showing yesterday's name for a moment
    // is not worth telling somebody their rename failed.
    void renameVentureOwner(current.uid, trimmed).catch(() => {})
  }, [])

  const setAvatar = useCallback(async (avatar: AvatarStyle) => {
    const current = auth.currentUser
    if (!current) throw new Error('You are not signed in.')
    try {
      await updateDoc(doc(db, 'users', current.uid), { avatar })
    } catch (cause) {
      throw new Error(reportError('setAvatar', cause))
    }
  }, [])

  /**
   * PASSWORDS, AND WHY THEY ARRIVE SECOND.
   *
   * The email link proves the address belongs to whoever clicked it. That is
   * the part a password cannot do, which is why the order is link first,
   * password after: the password is set by somebody already holding a session
   * that was earned by reading the inbox, so it can never be used to claim an
   * address its owner has not seen.
   *
   * It also fixes the thing that prompted this. A link signs you in *in the
   * browser that opened it* — so sending one to a friend signs THEM in on
   * THEIR phone and does nothing on the sender's screen, which reads as the
   * site being broken. With a password they can sign in anywhere, on any
   * device, without waiting for mail at all.
   *
   * `linkWithCredential` for the first one and `updatePassword` after, because
   * the two are different operations to Firebase: the first attaches a new
   * provider, the second changes an existing one, and calling the wrong one
   * fails with `auth/provider-already-linked` or `auth/no-such-provider`.
   */
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password)
  }, [])

  /**
   * Signs this device in with a token the server minted.
   *
   * The last step of the cross-device sign-in: the address was confirmed on
   * whatever device opened the mail, and the device that STARTED the sign-in
   * is the one that should end up signed in. A custom token is how a server
   * says "this uid, on this device" without the password ever having been sent
   * anywhere the browser could not already send it.
   */
  const signInWithToken = useCallback(async (customToken: string) => {
    await signInWithCustomToken(auth, customToken)
  }, [])

  const setPassword = useCallback(async (password: string) => {
    const current = auth.currentUser
    if (!current?.email) throw new Error('You are not signed in.')
    if (password.length < 8) throw new Error('Use at least 8 characters.')

    const already = current.providerData.some((entry) => entry.providerId === 'password')
    try {
      if (already) {
        await updatePassword(current, password)
      } else {
        // The account's own address, never one typed into a form: this links a
        // password to the identity the session already proved.
        await linkWithCredential(current, EmailAuthProvider.credential(current.email, password))
      }
    } catch (cause) {
      const code = (cause as { code?: string })?.code
      if (code === 'auth/requires-recent-login') {
        throw new Error('For safety, sign in again before changing your password.')
      }
      if (code === 'auth/weak-password') throw new Error('That password is too easy to guess.')
      throw new Error(reportError('setPassword', cause))
    }
  }, [])

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth)
  }, [])

  const status: AuthStatus = !authResolved || (user && !profileResolved) || provisioning
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
  const hasPassword = (user?.providerData ?? []).some((entry) => entry.providerId === 'password')
  const canPost = status === 'ready' && (thaparEmail !== null || preApproved !== null)
  const isOwner = status === 'ready' && (user?.email ?? '').toLowerCase() === OWNER_EMAIL

  const value = useMemo(
    () => ({
      user,
      profile,
      status,
      needsUsername,
      provisionError,
      canPost,
      thaparEmail,
      isOwner,
      signInWithGoogle,
      sendLink,
      sendThaparLink,
      completeThaparLink,
      completeSignInFromLink,
      claimUsername,
      setAvatar,
      changeUsername,
      hasPassword,
      signInWithPassword,
      signInWithToken,
      setPassword,
      signOut,
    }),
    [
      user,
      profile,
      status,
      needsUsername,
      provisionError,
      canPost,
      thaparEmail,
      isOwner,
      signInWithGoogle,
      sendLink,
      sendThaparLink,
      completeThaparLink,
      completeSignInFromLink,
      claimUsername,
      setAvatar,
      changeUsername,
      hasPassword,
      signInWithPassword,
      signInWithToken,
      setPassword,
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
