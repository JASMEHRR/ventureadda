/**
 * Cloudinary uploads. Firebase Storage needs the paid Blaze plan, so photos
 * live here instead.
 *
 * The preset is unsigned, which is what lets the browser upload without a
 * server to sign the request. That also means the endpoint is open to anyone
 * who reads the bundle, so the preset itself is the security boundary — it is
 * hardened with disallow_public_id, overwrite=false and unique_filename, and
 * needs allowed_formats and max_file_size set through the Admin API.
 *
 * The checks below are for a clean error message, not enforcement. Anyone can
 * POST straight to the endpoint and skip them.
 */

const CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME
const UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET

if (!CLOUD_NAME || !UPLOAD_PRESET) {
  throw new Error(
    'Missing VITE_CLOUDINARY_CLOUD_NAME or VITE_CLOUDINARY_UPLOAD_PRESET. ' +
      'Copy .env.example to .env and fill them in.',
  )
}

/** Mirrors the allowed_formats the preset should carry. */
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
export const ACCEPT_ATTRIBUTE = ACCEPTED_TYPES.join(',')

/** Mirrors max_file_size on the preset: 5 MB. */
const MAX_BYTES = 5_000_000

export type UploadedImage = {
  /** Cloudinary's canonical URL for the original. */
  url: string
  /** Required to delete the asset later; the URL alone is not enough. */
  publicId: string
  /** See StoredImage.padWhite. Carried here so displayUrl can honour it. */
  padWhite?: boolean
}

export function validateImage(file: File): string | null {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    return 'Photos must be JPG, PNG or WebP.'
  }
  if (file.size > MAX_BYTES) {
    const mb = (file.size / 1_000_000).toFixed(1)
    return `That photo is ${mb}MB. The limit is 5MB — try a smaller one.`
  }
  return null
}

export async function uploadImage(file: File): Promise<UploadedImage> {
  const problem = validateImage(file)
  if (problem) throw new Error(problem)

  const body = new FormData()
  body.append('file', file)
  body.append('upload_preset', UPLOAD_PRESET)
  // The asset folder is set on the preset. Sending one here as well can
  // conflict with it, so it is deliberately omitted.

  let response: Response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body,
    })
  } catch {
    throw new Error('Could not reach Cloudinary. Check your connection and try again.')
  }

  if (!response.ok) {
    // Cloudinary puts a human-readable reason in error.message, and it is the
    // only way to tell "file too large" from "format not allowed".
    let detail = `Upload failed (${response.status}).`
    try {
      const payload = await response.json()
      if (payload?.error?.message) detail = payload.error.message
    } catch {
      // Non-JSON error body; the status code above is all we have.
    }
    throw new Error(detail)
  }

  const payload = await response.json()
  if (typeof payload?.secure_url !== 'string' || typeof payload?.public_id !== 'string') {
    throw new Error('Cloudinary returned an unexpected response.')
  }
  return { url: payload.secure_url, publicId: payload.public_id }
}

/**
 * Display URL for a stored image.
 *
 * Always used instead of the stored original: f_auto picks WebP or AVIF per
 * browser, q_auto trims quality to what the eye will not notice, and the width
 * cap stops a 4MB phone photo being sent to a phone to be drawn 400px wide.
 * On campus wifi that difference is the whole page.
 */
export function imageUrl(publicId: string, width: 400 | 800 | 1200): string {
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width}/${publicId}`
}

/**
 * Renders any stored image, whether it came from Cloudinary or not.
 *
 * The demo ventures point at files in public/seed and have no public id, so
 * they fall through to the plain URL. Everything uploaded through the form has
 * one and gets the transformation treatment.
 */
export function displayUrl(image: UploadedImage, width: 400 | 800 | 1200): string {
  if (!image.publicId) return image.url
  // Product shots are padded onto white instead of cropped — see
  // StoredImage.padWhite for why. Square, because every tile that shows one is.
  if (image.padWhite) {
    return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_${width},h_${width},c_pad,b_white/${image.publicId}`
  }
  return imageUrl(image.publicId, width)
}

/**
 * Uploads a photograph that lives somewhere else, by handing Cloudinary the
 * address rather than the bytes.
 *
 * The browser never fetches the file. It could not, in most cases — the
 * libraries these come from send no CORS headers, so a `fetch` for the image
 * would be refused before a byte arrived. Cloudinary fetching it server-side
 * sidesteps that entirely, and has the better outcome anyway: the photograph
 * ends up on our own account, so a listing does not go blank the day the
 * original moves.
 *
 * `validateImage` cannot run here — there is no File to measure. The preset's
 * own allowed_formats and max_file_size are the enforcement, which is where
 * they always were; see the note at the top of this file.
 */
export async function uploadImageFromUrl(url: string): Promise<UploadedImage> {
  const body = new FormData()
  body.append('file', url)
  body.append('upload_preset', UPLOAD_PRESET)

  let response: Response
  try {
    response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
      method: 'POST',
      body,
    })
  } catch {
    throw new Error('Could not reach Cloudinary. Check your connection and try again.')
  }

  if (!response.ok) {
    let detail = `Could not save that photo (${response.status}).`
    try {
      const payload = await response.json()
      if (payload?.error?.message) detail = payload.error.message
    } catch {
      // Leave the status-code message.
    }
    throw new Error(detail)
  }

  const payload = await response.json()
  return { url: payload.secure_url as string, publicId: payload.public_id as string }
}
