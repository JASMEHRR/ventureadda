/**
 * The link preview: the card WhatsApp draws when somebody pastes a venture.
 *
 * WHY THIS CANNOT BE DONE IN THE APP. WhatsApp, Instagram, Telegram and Slack
 * all fetch a pasted URL with a crawler that does not run JavaScript. This is
 * a single-page app: to that crawler every venture is the same empty
 * index.html with the site's generic title and no image, which is why a shared
 * venture arrives as a bare blue link. Meta tags added by React never exist as
 * far as the crawler is concerned, because React never runs.
 *
 * So the tags have to be in the HTML before it leaves the server, which means
 * a server, which is this function. It fetches the venture the same way the
 * browser would — Firestore's REST API, the same public read the rules already
 * allow for a live venture — and rewrites the <head> of the real index.html.
 *
 * IT SERVES THE APP, NOT A PREVIEW PAGE. The response is the site's own
 * index.html with four tags swapped in, so a person following the link gets
 * the full app exactly as before. A separate preview page would mean a crawler
 * and a person seeing two different things, which is cloaking, and search
 * engines are right to punish it.
 *
 * ONLY CRAWLERS ARE ROUTED HERE — see the `has` condition in vercel.json. A
 * real visitor still gets the static file straight from the CDN with no
 * function in the way, because adding a serverless hop to every venture page
 * to serve a picture to a robot would be a poor trade.
 *
 * RUNTIME. Edge, matching the other two functions here: the Fetch signature
 * `(request: Request) => Response`. See the note in extract-menu.ts.
 */
export const config = { runtime: 'edge' }

const PROJECT = 'ventureadda'
const FIRESTORE = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents`

type FirestoreValue = {
  stringValue?: string
  integerValue?: string
  mapValue?: { fields?: Record<string, FirestoreValue> }
  arrayValue?: { values?: FirestoreValue[] }
}

const text = (value: FirestoreValue | undefined): string => value?.stringValue ?? ''

/** Cloudinary can hand back a resized copy, which keeps the preview well under
 *  the ~600KB most chat clients will bother to fetch. */
function previewImage(photo: FirestoreValue | undefined, cloud: string | undefined): string {
  const url = text(photo?.mapValue?.fields?.url)
  if (!url) return ''
  if (!cloud || !url.includes('/upload/')) return url
  return url.replace('/upload/', '/upload/w_1200,c_limit,q_auto,f_jpg/')
}

/** The crawler reads this, so anything that could close a tag or open a script
 *  has to stop being that character first. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export default async function handler(request: Request): Promise<Response> {
  const url = new URL(request.url)
  const segment = url.pathname.replace(/^\/venture\//, '').split('/')[0]

  // The app's own HTML, fetched from this same deployment. `/index.html` is
  // not rewritten — the rewrite matches /venture/* — so this cannot recurse.
  const shell = await fetch(`${url.origin}/index.html`, {
    headers: { 'user-agent': 'ventureadda-preview' },
  })
  const html = await shell.text()

  const fail = () =>
    new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8' } })

  if (!segment) return fail()

  try {
    // A slug claim first, then the id, mirroring how the client resolves a
    // link. Both are public reads.
    let ventureId = segment
    const claim = await fetch(`${FIRESTORE}/slugs/${encodeURIComponent(segment)}`)
    if (claim.ok) {
      const data = (await claim.json()) as { fields?: Record<string, FirestoreValue> }
      ventureId = text(data.fields?.ventureId) || segment
    }

    const response = await fetch(`${FIRESTORE}/ventures/${encodeURIComponent(ventureId)}`)
    if (!response.ok) return fail()
    const document = (await response.json()) as { fields?: Record<string, FirestoreValue> }
    const fields = document.fields
    if (!fields) return fail()

    // A pending or rejected listing has no business having a preview card:
    // the page itself refuses to show it to anyone but its owner.
    if (text(fields.status) !== 'live') return fail()

    const name = text(fields.name)
    const description = text(fields.description)
    const photos = fields.photos?.arrayValue?.values ?? []
    const image = previewImage(photos[0], process.env.VITE_CLOUDINARY_CLOUD_NAME)

    const title = name ? `${name} on VentureAdda` : 'VentureAdda'
    const summary = description || 'A student venture on the Thapar campus.'

    const tags = [
      `<meta property="og:type" content="website" />`,
      `<meta property="og:title" content="${escapeHtml(title)}" />`,
      `<meta property="og:description" content="${escapeHtml(summary)}" />`,
      `<meta property="og:url" content="${escapeHtml(url.href)}" />`,
      // summary_large_image is what turns a thumbnail into the wide card
      // people actually notice in a chat.
      `<meta name="twitter:card" content="summary_large_image" />`,
      `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:description" content="${escapeHtml(summary)}" />`,
      ...(image
        ? [
            `<meta property="og:image" content="${escapeHtml(image)}" />`,
            `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
          ]
        : []),
      `<title>${escapeHtml(title)}</title>`,
    ].join('\n    ')

    // The existing <title> goes, or the page ends up with two and the crawler
    // picks whichever it likes.
    const withoutTitle = html.replace(/<title>[\s\S]*?<\/title>/i, '')
    const withTags = withoutTitle.replace('</head>', `    ${tags}\n  </head>`)

    return new Response(withTags, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        // Crawlers re-fetch on every paste; a few minutes of cache spares
        // Firestore a read per share without making an edit take long to
        // show up in a new preview.
        'cache-control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    })
  } catch {
    // Any failure serves the app unchanged: a link with a plain preview is a
    // working link, and a 500 is not.
    return fail()
  }
}
