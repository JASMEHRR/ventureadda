import { auth } from './firebase'

/**
 * Calls the menu-extraction function.
 *
 * The photo never goes to Cloudinary. It is read straight to a data URL, sent
 * to our own function, and dropped — it is input to a reader, not a picture
 * anyone will look at again, and storing it would mean keeping a copy of
 * somebody's handwritten price list for no reason.
 */

export type ExtractedItem = { name: string; price: number; description: string }

/**
 * Groq's 20MB ceiling is for a hosted image URL. This goes as a base64 data
 * URL instead, which Groq caps at 4MB -- match that here so a normal phone
 * photo gets a clean message instead of sailing past this check only to have
 * Groq reset the connection on the server. See api/extract-menu.ts.
 */
const MAX_BYTES = 4 * 1024 * 1024

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp']
export const SCAN_ACCEPT = ACCEPTED.join(',')

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') resolve(reader.result)
      else reject(new Error('Could not read that file.'))
    }
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.readAsDataURL(file)
  })
}

export async function extractMenu(file: File): Promise<ExtractedItem[]> {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Photos must be JPG, PNG or WebP.')
  }
  if (file.size > MAX_BYTES) {
    throw new Error(`That photo is ${(file.size / 1_000_000).toFixed(1)}MB. The limit is 4MB.`)
  }

  const user = auth.currentUser
  if (!user) throw new Error('Sign in to use menu scanning.')

  // Not cached. getIdToken refreshes it when it is close to expiring, and a
  // stale token is rejected by the function with a message about signing in
  // that would make no sense to somebody who already is.
  const idToken = await user.getIdToken()
  const image = await readAsDataUrl(file)

  let response: Response
  try {
    response = await fetch('/api/extract-menu', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${idToken}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ image }),
    })
  } catch {
    throw new Error('Could not reach the scanner. Check your connection, or type the items in.')
  }

  const payload = (await response.json().catch(() => null)) as
    | { items?: ExtractedItem[]; error?: string }
    | null

  if (!response.ok) {
    // The function writes messages meant to be shown to the person who sent
    // the photo, so prefer its wording to anything invented here.
    throw new Error(payload?.error ?? 'Scanning failed. Type the items in for now.')
  }
  if (!Array.isArray(payload?.items) || payload.items.length === 0) {
    throw new Error('No items found in that photo. Try a closer shot, or type them in.')
  }
  return payload.items
}
