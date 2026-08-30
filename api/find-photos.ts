/**
 * Finds a photograph for an item the seller has described.
 *
 * WHAT THIS IS FOR. Most sellers here photograph nothing. They are running a
 * shop out of a hostel room between classes, and a listing of forty items with
 * forty blank tiles is the normal outcome — which is most of why the products
 * page needed a fallback ladder of brand logos and initial tiles at all.
 * Letting somebody type "chocolate brownie" and pick from a handful of real
 * photographs is the difference between a price list and a shop.
 *
 * WHY NOT A WEB IMAGE SEARCH. Because "go and find a Monster photo" means
 * taking a photograph somebody owns and putting it on a listing that sells
 * something. That is the whole of copyright infringement, and it does not stop
 * being that because a search engine was in the middle.
 *
 * So this searches Wikimedia Commons, which is the largest library of openly
 * licensed photographs there is and is built to be queried by software. Every
 * file there carries its licence and its author in metadata, both of which
 * come back with the result, get stored on the image, and are printed at the
 * foot of the venture page. The credit is not decoration — it is the condition
 * the photograph is being used under.
 *
 * OPENVERSE WAS THE FIRST CHOICE and is not reachable from here: its API
 * accepted the same query from a laptop and never answered it from Vercel's
 * edge network, twice, until the function was killed at 25 seconds. Worth
 * revisiting if it ever becomes reachable, because its index is broader.
 *
 * WHAT IT WILL AND WILL NOT FIND. Generic things, well: brownies, cold coffee,
 * potato chips, earrings. Specific branded products, badly — there is no
 * openly licensed photograph of a particular energy drink, because that
 * photograph belongs to the company selling it. The dialog says so rather than
 * letting somebody search four times and conclude the feature is broken.
 *
 * RUNTIME. Edge, matching the other functions here.
 */
export const config = { runtime: 'edge' }

const ENDPOINT = 'https://commons.wikimedia.org/w/api.php'

/** Enough to choose from, few enough to look at. */
const RESULTS = 12

/** The longest description worth sending. Anything more is a paragraph. */
const MAX_QUERY = 80

/**
 * Long enough for a slow answer, short enough to fail as an error rather than
 * as a hung request. Vercel kills an edge function that has not responded in
 * 25 seconds, and "it did not return an initial response" is not something a
 * seller can act on.
 */
const UPSTREAM_TIMEOUT_MS = 9000

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      // A search for "brownie" returns the same thing all day, and somebody
      // typing into the box sends several near-identical queries.
      'cache-control': 'public, max-age=600',
    },
  })
}

type CommonsPage = {
  title?: string
  imageinfo?: {
    url?: string
    thumburl?: string
    descriptionurl?: string
    extmetadata?: Record<string, { value?: string }>
  }[]
}

/** Commons stores author as an HTML fragment — a link, usually. */
function plainText(html: string | undefined): string {
  if (!html) return ''
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Licences that allow commercial use with credit.
 *
 * Everything on Commons is meant to be free, but "free" there includes a
 * handful of things this cannot use — fair-use logos on the English Wikipedia
 * side, and the occasional non-commercial upload that slipped through. Rather
 * than enumerate what is forbidden, this only accepts what is recognised.
 */
function usable(licence: string): boolean {
  const value = licence.toLowerCase()
  if (!value) return false
  if (value.includes('nc') || value.includes('noncommercial')) return false
  if (value.includes('nd') && !value.includes('and')) return false
  if (value.includes('fair use')) return false
  return (
    value.startsWith('cc') ||
    value.includes('public domain') ||
    value.includes('pd') ||
    value.includes('gfdl')
  )
}

export default async function handler(request: Request): Promise<Response> {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY)
  if (query.length < 2) return json({ results: [] }, 200)

  const search = new URL(ENDPOINT)
  search.searchParams.set('action', 'query')
  search.searchParams.set('generator', 'search')
  // Bitmaps only, in the File namespace: no SVG diagrams, no PDFs, no audio.
  search.searchParams.set('gsrsearch', `filetype:bitmap ${query}`)
  search.searchParams.set('gsrnamespace', '6')
  search.searchParams.set('gsrlimit', String(RESULTS))
  search.searchParams.set('prop', 'imageinfo')
  search.searchParams.set('iiprop', 'url|extmetadata')
  // A 1200px rendition rather than the original, which on Commons is
  // routinely a 12MB museum scan. This is the file that actually gets saved,
  // and 1200 is comfortably more than any card draws it at.
  search.searchParams.set('iiurlwidth', '1200')
  search.searchParams.set('format', 'json')
  search.searchParams.set('origin', '*')

  let response: Response
  try {
    response = await fetch(search, {
      headers: {
        // Wikimedia asks every client to identify itself and rate-limits the
        // ones that do not.
        'user-agent': 'VentureAdda/1.0 (https://ventureadda.vercel.app; campus marketplace)',
        accept: 'application/json',
      },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return json(
      { error: 'The photo library did not answer. Try again in a moment.', code: 'unreachable' },
      502,
    )
  }

  if (!response.ok) {
    return json({ error: 'The photo library refused that search.', code: 'upstream' }, 502)
  }

  const payload = (await response.json().catch(() => null)) as {
    query?: { pages?: Record<string, CommonsPage> }
  } | null

  const pages = Object.values(payload?.query?.pages ?? {})

  const results = pages
    .flatMap((page) => {
      const info = page.imageinfo?.[0]
      const meta = info?.extmetadata ?? {}
      const license = plainText(meta.LicenseShortName?.value)
      if (!info?.url || !info.thumburl || !usable(license)) return []
      return [
        {
          id: info.descriptionurl ?? info.url,
          // The rendition, never the original: see iiurlwidth above.
          url: info.thumburl,
          // And a smaller one again for the picker's grid. Wikimedia spells
          // the width into the path, so asking for another size is a string
          // away — twelve 1200px files to fill twelve 120px tiles is most of a
          // phone's data budget for nothing.
          thumbnail: info.thumburl.replace('/1200px-', '/320px-'),
          title: (page.title ?? '').replace(/^File:/, '').replace(/\.[a-z]+$/i, '').slice(0, 120),
          creator: (plainText(meta.Artist?.value) || 'Wikimedia Commons').slice(0, 80),
          license: license.slice(0, 40),
          source: info.descriptionurl ?? '',
        },
      ]
    })
    .slice(0, RESULTS)

  return json({ results }, 200)
}
