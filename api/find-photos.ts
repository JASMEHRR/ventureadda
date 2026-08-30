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
 * TWO LIBRARIES, and the first one is the reason this is useful for the shops
 * on this site at all.
 *
 * Open Food Facts is a co-operative product database: packaged food and drink,
 * photographed front-on against a plain background, by barcode. That is
 * exactly what a hostel snack shop sells — Kurkure, Lay's, Maggi, Dairy Milk,
 * Monster Ultra White — and it is the one source where searching a brand name
 * returns that brand's actual product rather than something adjacent. Its
 * photographs are contributed under CC BY-SA, so they can be used here with a
 * credit, which is what the credit line is for.
 *
 * Wikimedia Commons is the fallback and covers everything that is not a
 * packaged product: brownies, cold coffee, earrings, crochet.
 *
 * Every result from either carries its licence and its author, both of which
 * get stored on the image and printed at the foot of the venture page. The
 * credit is not decoration — it is the condition the photograph is being used
 * under.
 *
 * WHAT THIS IS NOT, and was asked for: Amazon's product images. Reselling a
 * thing you bought is lawful and has nothing to do with it — the photograph is
 * a separate work with its own copyright, held by whoever shot it, and
 * Amazon's terms forbid reuse besides. Open Food Facts is the version of that
 * idea which does not depend on nobody minding.
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

const COMMONS = 'https://commons.wikimedia.org/w/api.php'
const OFF = 'https://world.openfoodfacts.org/cgi/search.pl'

/**
 * Both libraries ask callers to identify themselves and rate-limit the ones
 * that do not. Open Food Facts asks for a contact address specifically.
 */
const AGENT = 'VentureAdda/1.0 (https://ventureadda.vercel.app; jasmehr2005@gmail.com)'

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

type Found = {
  id: string
  url: string
  thumbnail: string
  title: string
  creator: string
  license: string
  source: string
  /** A front-on product shot on a plain ground, rather than a photograph of a
   *  thing in a place. The client pads these onto white. */
  product: boolean
}

/**
 * Packaged products, by brand or name.
 *
 * Photographs on Open Food Facts are contributed under CC BY-SA, credited to
 * the project rather than to individual photographers — which is how the
 * project itself asks to be credited.
 */
async function searchProducts(query: string): Promise<Found[]> {
  const search = new URL(OFF)
  search.searchParams.set('search_terms', query)
  search.searchParams.set('search_simple', '1')
  search.searchParams.set('action', 'process')
  search.searchParams.set('json', '1')
  search.searchParams.set('page_size', '8')
  search.searchParams.set('fields', 'product_name,brands,image_front_url,image_front_small_url,code')

  let response: Response
  try {
    response = await fetch(search, {
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return []
  }
  // 503 here means their search is busy, which it often is. The Commons half
  // still answers, so this is a thinner result rather than a failed one.
  if (!response.ok) return []

  const payload = (await response.json().catch(() => null)) as {
    products?: {
      product_name?: string
      brands?: string
      image_front_url?: string
      image_front_small_url?: string
      code?: string
    }[]
  } | null

  return (payload?.products ?? []).flatMap((item) => {
    if (!item.image_front_url) return []
    const name = [item.brands?.split(',')[0], item.product_name].filter(Boolean).join(' ').trim()
    return [
      {
        id: item.code ? `off-${item.code}` : item.image_front_url,
        url: item.image_front_url,
        thumbnail: item.image_front_small_url ?? item.image_front_url,
        title: (name || 'Product').slice(0, 120),
        creator: 'Open Food Facts contributors',
        license: 'CC BY-SA 3.0',
        source: item.code ? `https://world.openfoodfacts.org/product/${item.code}` : '',
        product: true,
      },
    ]
  })
}

/** Everything that is not a packaged product. */
async function searchCommons(query: string): Promise<Found[]> {
  const search = new URL(COMMONS)
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
      headers: { 'user-agent': AGENT, accept: 'application/json' },
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    })
  } catch {
    return []
  }

  if (!response.ok) return []

  const payload = (await response.json().catch(() => null)) as {
    query?: { pages?: Record<string, CommonsPage> }
  } | null

  const pages = Object.values(payload?.query?.pages ?? {})

  return pages
    .flatMap((page) => {
      const info = page.imageinfo?.[0]
      const meta = info?.extmetadata ?? {}
      const license = plainText(meta.LicenseShortName?.value)
      if (!info?.url || !info.thumburl || !usable(license)) return []
      return [
        {
          product: false,
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
}

export default async function handler(request: Request): Promise<Response> {
  const query = (new URL(request.url).searchParams.get('q') ?? '').trim().slice(0, MAX_QUERY)
  if (query.length < 2) return json({ results: [] }, 200)

  // Both at once: one slow library should not hold up the other, and either
  // failing on its own leaves a shorter list rather than an error.
  const [products, photos] = await Promise.all([searchProducts(query), searchCommons(query)])

  // Product shots first. Somebody typing "kurkure" wants the packet, and a
  // photograph of a bowl of snacks is the second-best answer, not the first.
  const results = [...products, ...photos].slice(0, RESULTS)

  return json({ results }, 200)
}
