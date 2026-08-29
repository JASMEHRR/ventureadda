import { useState, type ReactNode } from 'react'

/**
 * The real logo of whatever an item is, when the item is a brand.
 *
 * A venture reselling software subscriptions has a hundred and fifty items and
 * no photographs — nobody is going to photograph a Netflix account. But every
 * one of those items IS a company with a logo everybody already recognises,
 * and a page of those reads like a shelf of apps instead of a list of strings.
 *
 * There is no logo API here and no logos in the repo. This asks DuckDuckGo's
 * favicon service for the brand's own site icon, which is the same picture the
 * browser puts in a tab. It answers 404 for a domain it has never seen, and
 * that 404 is the whole design: a name that is not a brand — "Chocolate
 * brownie" — simply fails and falls back to the seller's own mark, so this
 * needs no list of which ventures are allowed to use it.
 *
 * The cost is that item names on a listing page become domain guesses sent to
 * a third party. They are already public listings and no visitor identity goes
 * with them, but it is the reason this asks for at most two guesses per item
 * rather than walking a long list of suffixes.
 */

/**
 * Words that describe the deal rather than the brand.
 *
 * "Netflix Premium 4K 1 Month" is Netflix; everything after it is packaging.
 * Numbers go too, so "Canva Pro 12 Months" does not try 12.com.
 */
const QUALIFIERS = new Set([
  'pro',
  'premium',
  'plus',
  'lite',
  'basic',
  'standard',
  'ultimate',
  'max',
  'account',
  'accounts',
  'subscription',
  'subscriptions',
  'sub',
  'plan',
  'key',
  'keys',
  'licence',
  'license',
  'private',
  'shared',
  'personal',
  'team',
  'family',
  'student',
  'edu',
  'month',
  'months',
  'year',
  'years',
  'yearly',
  'monthly',
  'day',
  'days',
  'week',
  'weeks',
  'lifetime',
  'warranty',
  'renewable',
  'new',
  'stock',
  'offer',
  'and',
  'with',
  'for',
  'the',
])

/**
 * Domains worth asking about for this name, best guess first.
 *
 * Two at most. The first word is the brand in nearly every listing written the
 * way people write them, and `.ai` is the second guess because half of what
 * this venture sells is an AI tool with an AI domain.
 */
export function brandDomains(name: string): string[] {
  // A name that already contains a domain is not a guess: "Customer.io" is
  // customer.io, and splitting it into words would have asked about
  // customer.com, which is a different company with a different logo.
  const written = name.toLowerCase().match(/([a-z0-9][a-z0-9-]*\.(?:com|io|ai|co|app|dev|org|net|so|xyz))/)
  if (written) return [written[1]]

  const words = name
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .filter((word) => !QUALIFIERS.has(word) && !/^\d+$/.test(word))

  const brand = words[0]
  // A single letter is not a brand, and asking about it is a wasted request
  // that would sometimes come back with somebody else's logo.
  if (!brand || brand.length < 3) return []
  return [`${brand}.com`, `${brand}.ai`]
}

export default function BrandIcon({
  name,
  size,
  fallback,
}: {
  name: string
  size: number
  /** Drawn when the name is not a brand, which is the common case off this
   *  one venture — the seller's own mark. */
  fallback: ReactNode
}) {
  const domains = brandDomains(name)
  const [attempt, setAttempt] = useState(0)

  if (attempt >= domains.length) return <>{fallback}</>

  return (
    <img
      // Keyed by domain so a name change restarts the walk rather than leaving
      // the previous brand's picture in place.
      key={domains[attempt]}
      src={`https://icons.duckduckgo.com/ip3/${domains[attempt]}.ico`}
      alt=""
      loading="lazy"
      onError={() => setAttempt((current) => current + 1)}
      style={{ width: size, height: size }}
      // On white, because a favicon is drawn for a browser tab and half of them
      // are dark shapes with transparent backgrounds — on this app's own
      // background those would be invisible. Padding keeps it an app icon
      // rather than a picture cropped to its edges.
      className="shrink-0 rounded-xl bg-white object-contain p-1.5 ring-1 ring-white/10 ring-inset"
    />
  )
}
