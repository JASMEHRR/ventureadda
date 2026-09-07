import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowLeft,
  ChevronDown,
  Clock,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  List,
  Check,
  Link2,
  Minus,
  Pencil,
  Plus,
  SearchX,
  ShoppingCart,
} from 'lucide-react'
import Button from '../components/ui/Button'
import EmptyState from '../components/ui/EmptyState'
import ReviewSection from '../components/ReviewSection'
import LoadingLine from '../components/ui/LoadingLine'
import VentureLogo from '../components/ui/VentureLogo'
import BrandIcon from '../components/ui/BrandIcon'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import {
  categoryName,
  getVenture,
  listMenuItems,
  recordInquiry,
  recordVentureView,
  venturePath,
} from '../data/ventures'
import type { ImageCredit, MenuItem, StoredImage } from '../data/types'
import { MENU_GRID_CLASS } from '../data/types'
import type { MenuDensity } from '../data/types'
import { resolveMenuDensity, useAppearance } from '../lib/appearance'
import { cartQuantity, cartTotal, setCartQuantity, useCart } from '../data/cart'
import { displayUrl } from '../lib/cloudinary'
import PhotoCarousel from '../components/ui/PhotoCarousel'
import { formatRuns, tidyBreaks } from '../lib/richText'
import ShareVenture from '../components/ShareVenture'
import WhatsAppIcon from '../components/ui/WhatsAppIcon'
import { useDeclareSearchScope, useMenuQuery } from '../components/layout/useShellSearch'

/**
 * The reader's grid size for this menu, three buttons wide.
 *
 * The seller's choice is the starting point and stays the starting point —
 * 'store' is what everybody arrives on. These overrule it for this device
 * only, because a grid that is right on the seller's phone is not necessarily
 * right on a laptop, and somebody scanning forty items for one price wants
 * them packed however the seller feels about it.
 *
 * Written straight to the same per-device store the theme and glass knobs use,
 * so the choice holds across every venture and survives a reload. There is no
 * "back to the seller's" button: switching back is picking whichever of the
 * three matches, and a fourth control to undo the other three is more UI than
 * the decision is worth.
 */
function DensityPicker({
  value,
  onChange,
}: {
  value: MenuDensity
  onChange: (next: MenuDensity) => void
}) {
  const choices: { density: MenuDensity; label: string; Icon: typeof LayoutGrid }[] = [
    { density: 'roomy', label: 'Large items', Icon: LayoutGrid },
    { density: 'default', label: 'Medium items', Icon: Grid2x2 },
    { density: 'dense', label: 'Small items', Icon: Grid3x3 },
    // A long menu with no photographs reads as a list, not as a wall of empty
    // tiles — see MENU_GRID_CLASS in data/types.
    { density: 'list', label: 'Plain list', Icon: List },
  ]
  return (
    <div
      role="group"
      aria-label="Item size"
      className="flex shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] p-1"
    >
      {choices.map(({ density, label, Icon }) => {
        const active = value === density
        return (
          <button
            key={density}
            type="button"
            aria-pressed={active}
            title={label}
            aria-label={label}
            onClick={() => onChange(density)}
            className={`rounded-full p-2.5 transition duration-150 active:scale-[0.94] ${
              active
                ? 'bg-brand-500/20 text-brand-300'
                : 'text-white/60 hover:bg-white/8 hover:text-white'
            }`}
          >
            <Icon size={14} aria-hidden="true" />
          </button>
        )
      })}
    </div>
  )
}

/**
 * How many more of this item may be added.
 *
 * `stock` absent means the seller is not counting, so there is no ceiling.
 * Zero stock is a real answer and caps at zero.
 */
function remaining(item: MenuItem, quantity: number): number {
  if (item.stock === undefined) return Infinity
  return Math.max(0, item.stock - quantity)
}

/**
 * One menu item, with the add control that turns into a counter in place.
 *
 * The whole card used to be one big <button>, which was a nice tap target and
 * is why the counter could not live here — a stepper is two buttons, and
 * nesting buttons is invalid HTML that browsers resolve by throwing the inner
 * ones away. So the card is a plain container now and the strip along its foot
 * is the control: full width for Add, split into − n + once there is one in
 * the order. Adjusting quantity no longer means opening the checkout dialog to
 * find the only steppers in the app.
 */
/**
 * Where "ask the seller" actually goes.
 *
 * Half the catalogue on this site has no price, by the seller's own choice —
 * a subscription, a custom cake, anything quoted in conversation. Those items
 * said "Message the seller for a price" and then did nothing, which is the
 * worst kind of dead end: it names the next step and refuses to take it.
 *
 * The message is written out so the seller does not have to ask which item
 * this is about. Same shape as the cart's link, and the same reason: the
 * whole product is a WhatsApp conversation with the boring part filled in.
 */
/**
 * A link that opens this venture with one item already open.
 *
 * WHY AN ITEM NEEDS ITS OWN LINK. Everything on this site is passed around in
 * WhatsApp, and until now the smallest thing anybody could send was a whole
 * venture — so "get me one of these" arrived as a shop with a hundred and
 * fifty items and a sentence describing one of them. The query parameter is
 * read on load, and the item it names is expanded and scrolled to.
 *
 * A query parameter rather than a fragment because the fragment never reaches
 * the server, and api/venture-preview needs to see this to caption the link
 * with the item rather than the shop.
 *
 * `open`, NOT `item`. That name is already taken: `?item=` is what the shell's
 * search box writes when somebody filters this venture's own menu — see
 * useMenuQuery. Shipping a share link on that parameter meant every shared
 * item arrived as a menu filtered to a document id, which matches nothing, so
 * the page read "Nothing on this menu matches OfTGX6rw…" and showed an empty
 * shop. Found by opening one.
 */
export function itemLink(path: string, itemId: string, origin: string): string {
  return `${origin.replace(/\/$/, '')}${path}?open=${encodeURIComponent(itemId)}`
}

function askLink(venture: { name: string; phone: string }, itemName: string): string {
  const text = `Hi ${venture.name}, how much is "${itemName}"? (from VentureAdda)`
  return `https://wa.me/${venture.phone}?text=${encodeURIComponent(text)}`
}

function ItemCard({
  item,
  quantity,
  askedCount,
  showAsked,
  onSetQuantity,
  asRow,
  brandIcon,
  onAsk,
  venture,
  path,
  openInitially,
}: {
  item: MenuItem
  quantity: number
  askedCount: number
  showAsked: boolean
  onSetQuantity: (quantity: number) => void
  /** The list layout: a row with the name first, no space kept for a picture. */
  asRow?: boolean
  /** Whether this menu is a catalogue of brands worth looking a logo up for.
   *  See catalogueVentures — a bakery's unphotographed drink is not, and was
   *  being drawn with a jobs board's logo. */
  brandIcon?: boolean
  /** Counted when somebody taps through to ask — see countInterest. Adding to
   *  a cart already counts; asking a price is the same signal for an item that
   *  has no cart to be added to. */
  onAsk?: () => void
  /** For the fallback tile, and for the number an unpriced item messages. */
  venture: { name: string; phone: string; logo?: StoredImage }
  /** This venture's own path, for building a link to this one item. */
  path: string
  /** Arrived from a link that named this item — see itemLink. */
  openInitially?: boolean
}) {
  const left = remaining(item, quantity)
  const sellable = item.inStock && (item.stock === undefined || item.stock > 0)
  const [open, setOpen] = useState(openInitially ?? false)
  const [copied, setCopied] = useState(false)

  const shareUrl =
    typeof window === 'undefined' ? '' : itemLink(path, item.id, window.location.origin)

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Refused in some in-app browsers, the WhatsApp one included, which is
      // where a lot of this traffic comes from. The WhatsApp button beside it
      // carries the same link and does not need the clipboard.
      setCopied(false)
    }
  }

  /**
   * THE VENTURE'S OWN MARK, not the site's, when an item has no photograph.
   *
   * A menu of a hundred and fifty subscriptions has no product photographs and
   * never will, so every tile fell back to the VentureAdda logo — a page of
   * identical marks belonging to the site rather than to the seller, which
   * says nothing about whose shop this is. Their own logo, or the initial
   * VentureLogo draws when they have not set one, at least belongs to them.
   */
  const placeholder = (size: number) =>
    // ...unless the item is itself a brand, in which case that brand's own
    // logo says far more than either. See BrandIcon: a name that is not a
    // brand falls straight through to the seller's mark.
    brandIcon ? (
      <BrandIcon
        name={item.name}
        size={size}
        fallback={<VentureLogo name={venture.name} logo={venture.logo} size={size} />}
      />
    ) : (
      <VentureLogo name={venture.name} logo={venture.logo} size={size} />
    )

  /**
   * What opening an item shows: the things a row has no width for.
   *
   * The description in full rather than truncated, the photograph at a size
   * worth looking at, and the two ways to pass it on. Rendered by both layouts
   * from one definition so the row and the tile can never disagree about what
   * an item is.
   */
  const expanded = (
    <div className="space-y-3 border-t border-white/8 px-3 pt-3 pb-3">
      {item.photo && (
        <img
          src={displayUrl(item.photo, 800)}
          alt={item.name}
          loading="lazy"
          className="max-h-64 w-full rounded-xl object-cover"
        />
      )}

      {item.description ? (
        <p className="text-[15.5px] leading-relaxed whitespace-pre-line text-white/70">
          {tidyBreaks(item.description)}
        </p>
      ) : (
        <p className="text-[15.5px] text-white/45">No description for this one.</p>
      )}

      {typeof item.stock === 'number' && sellable && (
        <p className="font-mono text-[13px] tracking-wider text-white/55 uppercase">
          {item.stock} left
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {/* SHARING ONE ITEM, which is the thing people were doing by hand:
            sending a shop and then describing which bit of it they meant. */}
        <a
          href={`https://wa.me/?text=${encodeURIComponent(
            `${item.name}${typeof item.price === 'number' ? ` — ₹${item.price}` : ''} from ${venture.name} on VentureAdda:\n${shareUrl}`,
          )}`}
          target="_blank"
          rel="noreferrer noopener"
          className="flex items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-2 text-[14px] font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/25 active:scale-[0.96]"
        >
          <WhatsAppIcon size={13} />
          Send this
        </a>

        <button
          type="button"
          onClick={() => void copyLink()}
          className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[14px] font-bold transition duration-150 active:scale-[0.96] ${
            copied
              ? 'bg-brand-500/20 text-brand-300'
              : 'bg-white/8 text-white/60 hover:bg-white/12 hover:text-white/80'
          }`}
        >
          {copied ? <Check size={13} aria-hidden="true" /> : <Link2 size={13} aria-hidden="true" />}
          {copied ? 'Copied' : 'Copy link'}
        </button>

        {typeof item.price !== 'number' && sellable && (
          <a
            href={askLink(venture, item.name)}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onAsk?.()}
            className="ml-auto font-mono text-[13px] font-bold tracking-wider text-white/55 uppercase transition hover:text-brand-300"
          >
            Negotiate
          </a>
        )}
      </div>

      <span role="status" className="sr-only">
        {copied ? 'Link copied to your clipboard.' : ''}
      </span>
    </div>
  )

  if (asRow) {
    return (
      /**
       * THE ROW OPENS. It used to be one big link to WhatsApp when the item had
       * no price, which was right about the target being too small and wrong
       * about what most people want from a row: a row that can only message a
       * seller cannot show them a photograph, a full description, or a way to
       * send that one item to a friend. Tapping opens it; the green chip on the
       * right is still one tap to WhatsApp, so nothing that worked before takes
       * an extra step now.
       *
       * The toggle is a button around the left of the row rather than around
       * all of it, because the chip and the stepper live on the right and a
       * button cannot legally contain them.
       */
      <div
        id={`item-${item.id}`}
        className={`liquid-glass-panel rounded-2xl transition duration-150 ${
          sellable ? '' : 'opacity-60'
        } ${open ? 'ring-1 ring-white/12' : ''}`}
      >
        <div className="flex items-center gap-3 p-2.5">
          <button
            type="button"
            aria-expanded={open}
            onClick={() => setOpen((was: boolean) => !was)}
            className="flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left transition duration-150 hover:bg-white/[0.05] active:scale-[0.995]"
          >
            {item.photo ? (
              <img
                src={displayUrl(item.photo, 400)}
                alt=""
                loading="lazy"
                className={`h-12 w-12 shrink-0 rounded-xl object-cover ${sellable ? '' : 'grayscale'}`}
              />
            ) : (
              <span aria-hidden="true" className="shrink-0">
                {placeholder(48)}
              </span>
            )}

            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] font-bold text-white">{item.name}</span>
              {item.description && !open && (
                <span className="block truncate text-[14.5px] text-white/60">
                  {item.description}
                </span>
              )}
              <span className="block font-mono text-[14px] font-bold text-white/70">
                {typeof item.price === 'number' ? `₹${item.price}` : 'Ask'}
                {!sellable && <span className="ml-2 text-red-300">Sold out</span>}
                {showAsked && <span className="ml-2 text-brand-400/70">{askedCount} asked</span>}
              </span>
            </span>

            <ChevronDown
              size={16}
              aria-hidden="true"
              className={`mr-1 shrink-0 text-white/40 transition-transform duration-150 ${
                open ? 'rotate-180' : ''
              }`}
            />
          </button>

        {typeof item.price !== 'number' ? (
          /* A real link again, now that it is a sibling of the toggle rather
             than nested inside it. One tap to WhatsApp, in the words a buyer
             uses: nobody reads "Ask" as "opens WhatsApp". */
          <a
            href={askLink(venture, item.name)}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onAsk?.()}
            className="flex shrink-0 items-center gap-1.5 rounded-xl bg-[#25D366]/15 px-3 py-2 text-[13px] font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/25 active:scale-[0.96]"
          >
            <WhatsAppIcon size={13} />
            Negotiate
            <span className="sr-only"> the price of {item.name} on WhatsApp</span>
          </a>
        ) : !sellable ? null : quantity === 0 ? (
          <button
            type="button"
            onClick={() => onSetQuantity(1)}
            className="shrink-0 rounded-xl bg-white/10 px-4 py-2 text-[14px] font-bold tracking-wide text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.96]"
          >
            Add
            <span className="sr-only"> {item.name} to your order</span>
          </button>
        ) : (
          <div className="flex shrink-0 items-center gap-1 rounded-xl bg-brand-500/15 p-1">
            <button
              type="button"
              onClick={() => onSetQuantity(quantity - 1)}
              aria-label={`Remove one ${item.name}`}
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9]"
            >
              <Minus size={13} aria-hidden="true" />
            </button>
            <span
              aria-live="polite"
              aria-atomic="true"
              className="min-w-6 text-center font-mono text-[15.5px] font-extrabold text-brand-300"
            >
              <span className="sr-only">{item.name}, </span>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onSetQuantity(quantity + 1)}
              disabled={left <= 0}
              aria-label={`Add one more ${item.name}`}
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9] disabled:opacity-30"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
        )}
        </div>

        {open && expanded}
      </div>
    )
  }

  return (
    <div
      id={`item-${item.id}`}
      className={`liquid-glass-panel flex flex-col overflow-hidden rounded-2xl text-left transition duration-150 ${
        sellable ? '' : 'opacity-60'
      }`}
    >
      {/* Picture and name open the item, the same as the row. Everything the
          tile has no room for is in there: the description in full, the
          photograph at a size worth looking at, and the two ways to send it to
          somebody. */}
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((was: boolean) => !was)}
        className="relative block w-full text-left"
      >
        {item.photo ? (
          <img
            src={displayUrl(item.photo, 400)}
            alt=""
            loading="lazy"
            className={`aspect-square w-full object-cover ${sellable ? '' : 'grayscale'}`}
          />
        ) : (
          <span
            aria-hidden="true"
            className="flex aspect-square w-full items-center justify-center bg-white/[0.04]"
          >
            {placeholder(44)}
          </span>
        )}
        {!sellable && (
          <span className="absolute top-2 left-2 rounded-full border border-red-500/40 bg-black/75 px-2.5 py-1 font-mono text-[12.5px] font-bold tracking-wider text-red-300 uppercase">
            Sold out
          </span>
        )}
        <span
          aria-hidden="true"
          className={`absolute right-2 bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/65 text-white/70 transition-transform duration-150 ${
            open ? 'rotate-180' : ''
          }`}
        >
          <ChevronDown size={15} />
        </span>
      </button>

      {open && expanded}

      <div className="flex min-w-0 flex-1 flex-col gap-2 p-3">
        <p className="line-clamp-2 text-[16px] font-bold text-white">{item.name}</p>
        {typeof item.price === 'number' ? (
          <p className="mt-auto font-mono text-[15.5px] font-bold text-white/90">₹{item.price}</p>
        ) : (
          /* No price set: the seller quotes it in the conversation. Said as
             "Ask" rather than shown as ₹0, which would be a claim they never
             made — and the Add button goes with it, because a cart total with
             a guess in it is wrong for every line under it too. */
          <p className="mt-auto font-mono text-[14px] font-bold tracking-wide text-white/60 uppercase">
            Ask
          </p>
        )}

        {typeof item.price !== 'number' ? (
          <a
            href={askLink(venture, item.name)}
            target="_blank"
            rel="noreferrer noopener"
            onClick={() => onAsk?.()}
            className="flex items-center justify-center gap-2 rounded-xl bg-[#25D366]/15 py-2 text-center text-[13.5px] leading-snug font-bold text-[#4ade80] transition duration-150 hover:bg-[#25D366]/25 active:scale-[0.97]"
          >
            <WhatsAppIcon size={14} />
            Negotiate on WhatsApp
            <span className="sr-only"> for {item.name}</span>
          </a>
        ) : !sellable ? (
          <p className="rounded-xl bg-white/[0.06] py-1.5 text-center font-mono text-[13px] font-bold tracking-wide text-white/60 uppercase">
            Unavailable
          </p>
        ) : quantity === 0 ? (
          <button
            type="button"
            onClick={() => onSetQuantity(1)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-white/10 py-1.5 text-[14px] font-bold tracking-wide text-white/70 uppercase transition duration-150 hover:bg-brand-500/25 hover:text-brand-300 active:scale-[0.96]"
          >
            <Plus size={12} aria-hidden="true" />
            Add
            <span className="sr-only">{item.name} to your order</span>
          </button>
        ) : (
          <div className="flex items-center justify-between gap-1 rounded-xl bg-brand-500/15 p-1">
            <button
              type="button"
              onClick={() => onSetQuantity(quantity - 1)}
              aria-label={`Remove one ${item.name}`}
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9]"
            >
              <Minus size={13} aria-hidden="true" />
            </button>
            {/* Announced as a live region so a screen-reader user pressing +
                hears the new count without moving focus off the button. */}
            <span
              aria-live="polite"
              aria-atomic="true"
              className="font-mono text-[15.5px] font-extrabold text-brand-300"
            >
              <span className="sr-only">{item.name}, </span>
              {quantity}
            </span>
            <button
              type="button"
              onClick={() => onSetQuantity(quantity + 1)}
              disabled={left === 0}
              aria-label={
                left === 0
                  ? `No more ${item.name} in stock`
                  : `Add one more ${item.name}`
              }
              className="rounded-lg p-1.5 text-brand-300 transition duration-150 hover:bg-white/10 active:scale-[0.9] disabled:opacity-30"
            >
              <Plus size={13} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Only once the ceiling is close enough to matter. "37 left" on a
            sticker sheet is noise; "2 left" is why you order now. */}
        {sellable && item.stock !== undefined && left <= 5 && (
          <p className="font-mono text-[12.5px] font-bold text-amber-400">
            {left === 0 ? 'That is all of them' : `${left} left`}
          </p>
        )}
        {showAsked && (
          <p className="font-mono text-[12.5px] font-bold text-brand-400">
            {askedCount.toLocaleString('en-IN')} asked
          </p>
        )}
      </div>
    </div>
  )
}

export default function VentureDetail() {
  const { ventureId = '' } = useParams()
  const { profile, user } = useAuth()
  /**
   * The cart is no longer page-local.
   *
   * It used to be a `useState` here, which meant leaving this page — to look
   * at another seller, or by tapping a link in a group chat — silently threw
   * away whatever had been added. It now lives in localStorage, spans
   * ventures, and is checked out from /cart.
   */
  const cart = useCart()
  const [appearance, updateAppearance] = useAppearance()
  const [localCounts, setLocalCounts] = useState<Record<string, number>>({})
  /** Category name -> collapsed. Absent means expanded — the default, so a
   *  venture with one section never opens on a page that looks empty. */
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({})
  /** Category name -> its heading element, so the chip row can jump to it. */
  const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({})

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])

  /**
   * THE DOCUMENT ID, WHICH IS NOT WHAT IS IN THE URL ANY MORE.
   *
   * /venture/glood resolves through the slug claim to a venture whose id is
   * 3KHid4o2sqQ4J49cE2dV, and every other read on this page keys off that id:
   * menu items store `ventureId`, so filtering them by "glood" matched nothing
   * and the page rendered "Nothing on the menu yet" for a seller with fifteen
   * items. Everything below therefore waits for the venture and uses its id —
   * never the URL segment, which is a name, not a key.
   */
  const resolvedId = venture.data?.id
  const menu = useAsyncData(
    () => (resolvedId ? listMenuItems(resolvedId) : Promise.resolve([])),
    [resolvedId],
  )

  /**
   * Point the shell's search box at this menu while the page is open, and let
   * it go on the way out. Declared up here with the other hooks because the
   * early returns below are unreachable to hooks — and passing the name only
   * once it has loaded is why the argument is nullable.
   */
  useDeclareSearchScope(venture.data?.name ?? null)
  const menuQuery = useMenuQuery()
  const [searchParams] = useSearchParams()

  // One venture-level open per visit. Deliberately not in the same effect as
  // the data load, which re-runs whenever the id changes for other reasons.
  useEffect(() => {
    if (!resolvedId) return
    void recordVentureView(resolvedId)
  }, [resolvedId])

  /**
   * Brings a shared item into view once the menu it lives in has rendered.
   *
   * KEYED ON THE MENU, not on the parameter alone. The parameter is known on
   * the first render and the row it names does not exist until the items come
   * back, so scrolling straight away scrolls to nothing at all — which is what
   * makes a shared link land on the top of a hundred-and-fifty-item menu and
   * look broken.
   *
   * `menu.data` is in the dependencies rather than a length, because a menu
   * that reloads with the same number of items still replaces the nodes. The
   * row opens itself; this only moves the page to it.
   */
  useEffect(() => {
    const wanted = searchParams.get('open')
    if (!wanted || !menu.data) return
    const node = document.getElementById(`item-${wanted}`)
    if (!node) return
    node.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }, [searchParams, menu.data])

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: !prev[category] }))
  }, [])

  // Expands the section too, in case the chip was tapped while it was
  // folded — landing on a heading with nothing under it defeats the point.
  const jumpToCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => ({ ...prev, [category]: false }))
    sectionRefs.current[category]?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [])

  /**
   * Items this visit has already counted an enquiry for.
   *
   * A ref, not state: nothing renders from it, and making it state would
   * re-render the whole menu on every first add for no visible change.
   */
  const counted = useRef<Set<string>>(new Set())

  /**
   * The interest counter, bumped when an item first enters the cart.
   *
   * It used to fire when the checkout was confirmed, which is no longer a
   * moment this page sees — ordering happens on /cart now. Adding is the
   * honest signal anyway: it is the point somebody decided they wanted the
   * thing, and it still counts for signed-out visitors, who are most of the
   * traffic.
   *
   * Once per item per visit, enforced by `counted`. The rules cap a write at
   * exactly plus one, so this measures interest in an item, not units ordered.
   */
  const countInterest = useCallback((item: MenuItem) => {
    if (counted.current.has(item.id)) return
    counted.current.add(item.id)
    setLocalCounts((prev) => ({ ...prev, [item.id]: (prev[item.id] ?? item.inquiryCount) + 1 }))
    void recordInquiry(item.id)
  }, [])

  /**
   * Every distinct credit on this page, item photographs and venture ones
   * alike. Deduplicated by creator and source, because a seller who found six
   * photographs from the same photographer owes one credit, not six.
   *
   * ABOVE THE EARLY RETURNS, and that placement is the whole of a bug this
   * page shipped with for an hour. It was written next to the code that uses
   * it, which is below `if (venture.loading) return …` — so the first render
   * of every venture page skipped the hook and the second one called it.
   * React counts hooks per render and tears the tree down when the number
   * changes, which on a site with no error boundary is a black screen.
   *
   * It reads `venture.data` rather than `v` for the same reason: `v` does not
   * exist yet this far up.
   */
  const credits = useMemo(() => {
    const seen = new Map<string, ImageCredit>()
    const collect = (image?: StoredImage) => {
      if (!image?.credit) return
      seen.set(`${image.credit.creator}|${image.credit.source}`, image.credit)
    }
    for (const photo of venture.data?.photos ?? []) collect(photo)
    collect(venture.data?.logo)
    for (const item of menu.data ?? []) collect(item.photo)
    return [...seen.values()]
  }, [venture.data, menu.data])

  if (venture.error || menu.error) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-red-400">
        Could not load this listing: {(venture.error ?? menu.error)?.message}
      </p>
    )
  }

  if (venture.loading) {
    return (
      <LoadingLine label="Loading venture…" />
    )
  }

  if (!venture.data) {
    return (
      <EmptyState
        icon={SearchX}
        title="No such venture"
        action={
          <Button variant="secondary" to="/browse">
            Back to browse
          </Button>
        }
      >
        It was removed, or the link is wrong.
      </EmptyState>
    )
  }

  const v = venture.data

  // The seller's layout unless this reader has asked for another one, which is
  // the whole contract: the store sets the default, the visitor overrules it.
  const density = resolveMenuDensity(appearance.menuDensity, v.menuDensity)

  /**
   * The item a shared link named, opened on arrival.
   *
   * Read straight off the URL rather than copied into state, so it survives a
   * refresh and a link pasted back into the address bar. Closing the item again
   * is a tap on the row; the parameter staying in the URL afterwards is
   * harmless, being the same link still pointing at the same item.
   */
  const sharedItemId = searchParams.get('open') ?? ''

  // Per-item enquiry counts are the seller's own evidence of what sells, so
  // they belong to the owner and the moderator, not to every passing browser.
  const showItemStats = Boolean(profile && (profile.uid === v.ownerId || profile.isModerator))

  /**
   * Whether the person reading this is one of the people who can change it.
   *
   * THE ROUTE TO EDITING WAS HIDDEN and sellers said so: the only way in was
   * My ventures, then find your own listing, then Edit — three steps from a
   * page that was already the listing itself. People open their own shop from
   * a shared link or from Browse like everybody else, and there was nothing on
   * it to press.
   *
   * Co-owners are matched on the verified address, the same comparison the
   * rules make — see Venture.managerEmails. A moderator sees it too, since
   * fixing a listing on a seller's behalf is most of what they do.
   */
  const mayEdit = Boolean(
    profile &&
      (profile.uid === v.ownerId ||
        profile.isModerator ||
        (user?.email && v.managerEmails.includes(user.email.toLowerCase()))),
  )

  /**
   * The menu, filtered by whatever is in the shell's search box.
   *
   * The box searches this venture's items while this page is open — see
   * useShellSearch. Name, description and section are all matched, because
   * somebody typing "gloves" and somebody typing "winter" are both describing
   * the same thing to a seller who wrote one of those words in each field.
   *
   * Case-insensitive substring, not fuzzy matching: a menu is at most a few
   * dozen items on one screen, and a scoring function nobody can predict is
   * worse than a rule everybody already understands.
   */
  const needle = menuQuery.trim().toLowerCase()
  const matching = (menu.data ?? []).filter((item) => {
    if (needle === '') return true
    return (
      item.name.toLowerCase().includes(needle) ||
      (item.description ?? '').toLowerCase().includes(needle) ||
      (item.category ?? '').toLowerCase().includes(needle)
    )
  })

  // listMenuItems returns items already sorted category-then-name, with
  // uncategorised items last — grouping here just has to walk that order
  // once, not re-sort it. The uncategorised group (key '') renders with no
  // heading and is never collapsible.
  const menuGroups: { category: string; items: MenuItem[] }[] = []
  for (const item of matching) {
    const category = item.category ?? ''
    const last = menuGroups[menuGroups.length - 1]
    if (last && last.category === category) last.items.push(item)
    else menuGroups.push({ category, items: [item] })
  }

  /**
   * The single write path for quantities on this page. Not a useCallback:
   * it closes over `v`, which does not exist until the venture has loaded and
   * the early returns above are past — and a hook cannot be declared here.
   * It is passed to a handful of cards, so the identity costs nothing.
   */
  const setQuantity = (item: MenuItem, quantity: number) => {
    if (quantity > 0 && cartQuantity(cart, item.id) === 0) countInterest(item)
    setCartQuantity(item, { id: v.id, name: v.name }, quantity)
  }

  // This venture's slice of the cart, which may also hold other sellers' items.
  const mine = cart.filter((entry) => entry.ventureId === v.id)
  const mineTotal = cartTotal(mine)

  return (
    <div className="space-y-4">
      <Link
        to="/browse"
        className="inline-flex items-center gap-2 rounded-full px-1 py-1 font-mono text-[13px] font-bold tracking-[0.18em] text-white/60 uppercase transition-colors hover:text-white"
      >
        <ArrowLeft size={13} aria-hidden="true" />
        All ventures
      </Link>

      {/* Said before the menu, not after it. Someone who reads this only once
          they have tapped an item has already tried to message a business that
          does not exist. */}
      {v.isDemo && (
        <p className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3.5 text-[16px] leading-relaxed text-amber-300">
          <span className="font-bold">Demo listing.</span> This one is here to show what a
          finished entry looks like. The business is not real and the number does not reach
          anyone.
        </p>
      )}

      {/* Side by side from lg. Stacked, the photo pushed the menu below the
          fold on the one page whose purpose is tapping a menu item; this seats
          the details in the width the layout change reclaimed. */}
      <div
        className={
          v.photos.length > 0
            ? 'grid gap-4 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:items-start'
            : ''
        }
      >
        {/* max-h wins over the aspect ratio once the container is wide.
            Without it, removing the page's max-width turned this into a
            1140px-tall photo you had to scroll past to reach the menu — on a
            page whose whole purpose is tapping a menu item. */}
        {v.photos.length > 0 && (
          <div className="liquid-glass-panel rounded-3xl p-3">
            <PhotoCarousel
              photos={v.photos}
              alt={v.name}
              width={1200}
              autoAdvanceMs={5000}
              className="aspect-4/3 max-h-[60vh]"
            />
          </div>
        )}

        <section className="liquid-glass-panel rounded-3xl p-5">
        {/* The name, which this page did not show anywhere before — the only
            h1 is the shell's visually-hidden one, so a visitor arriving from a
            shared link had to infer whose menu they were reading. The logo sits
            with it, which is the one place a venture's own mark belongs. */}
        <div className="mb-3.5 flex items-center gap-3">
          <VentureLogo name={v.name} logo={v.logo} size={44} />
          {/* A heading, not a paragraph: the shell's only h1 is the static
              "Venture", so navigating this page by headings would otherwise
              never reach the name of the venture it is about. */}
          <h2 className="min-w-0 flex-1 text-[23px] leading-tight font-extrabold text-white">
            {v.name}
          </h2>

          {/* Beside the name, which is the one place on the page that is
              unambiguously about this venture as a whole rather than about one
              item on its menu. */}
          <div className="flex shrink-0 items-center gap-2">
            {/* Beside Share, not buried in a menu. It is only rendered for the
                handful of people who can actually use it, so it costs everyone
                else nothing. */}
            {mayEdit && (
              <Link
                to={`${venturePath(v)}/edit`}
                className="flex h-11 items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-500/15 px-4 font-mono text-[13px] font-bold tracking-wider text-brand-300 uppercase transition duration-150 hover:bg-brand-500/25 active:scale-[0.96]"
              >
                <Pencil size={14} aria-hidden="true" />
                Edit
                <span className="sr-only"> {v.name}</span>
              </Link>
            )}
            <ShareVenture
              venture={{
                ...v,
                categoryName: categoryName(v.categoryId),
                itemCount: menu.data?.length,
              }}
              // The readable one when it has it, so what gets pasted into a
              // group chat says the venture's name rather than its document id.
              ventureId={v.slug ?? v.id}
            />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex items-center gap-1.5 text-white/60">
            <Clock size={12} aria-hidden="true" />
            <span className="font-mono text-[13px] tracking-wider uppercase">{v.hours}</span>
          </span>
        </div>

        {/* whitespace-pre-line, because HTML throws away the line breaks a
            seller typed and they had no way to know that. Their paragraphs and
            lists came out as one run-on block on the page they were writing
            for. Runs of blank lines still collapse, so nothing can be pushed
            off screen with fifty returns. */}
        <p className="mt-3 text-[16.5px] leading-relaxed whitespace-pre-line text-white/70">
          {formatRuns(tidyBreaks(v.description)).map((run, index) =>
            run.bold ? (
              <strong key={index} className="font-bold text-white">
                {run.text}
              </strong>
            ) : run.italic ? (
              <em key={index}>{run.text}</em>
            ) : (
              <span key={index}>{run.text}</span>
            ),
          )}
        </p>
        <p className="mt-3 font-mono text-[13px] tracking-[0.18em] text-white/55 uppercase">
          Run by {v.ownerUsername}
        </p>
        </section>
      </div>

      <section className="space-y-3">
        <header className="flex flex-wrap items-center justify-between gap-3 px-1">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Menu
          </h2>
          <div className="flex min-w-0 items-center gap-3">
            <span className="truncate font-mono text-[13px] font-bold text-white/55">
              {needle
                ? `${matching.length} of ${menu.data?.length ?? 0} items`
                : 'Add what you want, then open your cart'}
            </span>
            <DensityPicker
              value={density}
              onChange={(menuDensity) => updateAppearance({ menuDensity })}
            />
          </div>
        </header>

        {menu.data?.length === 0 && (
          <p className="liquid-glass-panel rounded-2xl px-5 py-6 text-center text-[16px] text-white/60">
            Nothing on the menu yet.
          </p>
        )}

        {/* A filtered menu that matches nothing has to say so. Without this it
            renders as a venture with an empty menu, which is a different and
            much worse thing to tell somebody about a seller. The link clears
            the filter rather than the whole URL, so a search someone arrived
            with from a shared link does not take the page with it. */}
        {needle !== '' && matching.length === 0 && (menu.data?.length ?? 0) > 0 && (
          <div className="liquid-glass-panel rounded-2xl px-5 py-6 text-center">
            <p className="text-[16px] text-white/60">
              Nothing on this menu matches &ldquo;{menuQuery.trim()}&rdquo;.
            </p>
            <Link
              to={venturePath(v)}
              className="mt-2 inline-block font-mono text-[14px] font-bold tracking-wider text-brand-400 uppercase transition hover:text-brand-300"
            >
              Show the whole menu
            </Link>
          </div>
        )}

        {/* Only when there is more than one named section — a single section
            has nowhere else to jump to. Horizontally scrollable rather than
            wrapped, so six categories stay one reachable row instead of
            pushing the grid down before a visitor has seen any items. */}
        {menuGroups.filter((group) => group.category !== '').length > 1 && (
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {menuGroups
              .filter((group) => group.category !== '')
              .map((group) => (
                <button
                  key={group.category}
                  type="button"
                  onClick={() => jumpToCategory(group.category)}
                  className="shrink-0 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-[15.5px] font-bold whitespace-nowrap text-white/80 transition duration-150 hover:border-brand-400/40 hover:bg-brand-500/15 hover:text-brand-300 active:scale-[0.96]"
                >
                  {group.category}
                </button>
              ))}
          </div>
        )}

        <div className="space-y-6">
          {menuGroups.map((group) => {
            const collapsed = group.category !== '' && collapsedCategories[group.category]
            return (
              <div
                key={group.category || ' uncategorised'}
                ref={(el) => {
                  sectionRefs.current[group.category] = el
                }}
              >
                {group.category !== '' && (
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.category)}
                    aria-expanded={!collapsed}
                    className="mb-3 flex w-full items-center gap-2 px-1 text-left"
                  >
                    <ChevronDown
                      size={18}
                      aria-hidden="true"
                      className={`shrink-0 text-brand-400 transition-transform duration-150 ${collapsed ? '-rotate-90' : ''}`}
                    />
                    <span className="text-[19px] font-extrabold text-white">{group.category}</span>
                    <span className="font-mono text-[14px] font-bold text-white/55">
                      {group.items.length}
                    </span>
                  </button>
                )}
                {!collapsed && (
                  <div className={`grid gap-2.5 ${MENU_GRID_CLASS[density]}`}>
                    {group.items.map((item) => (
                      <ItemCard
                        key={item.id}
                        item={item}
                        asRow={density === 'list'}
                        brandIcon={v.brandLogos}
                        onAsk={() => countInterest(item)}
                        venture={{ name: v.name, phone: v.phone, logo: v.logo }}
                        path={venturePath(v)}
                        openInitially={item.id === sharedItemId}
                        quantity={cartQuantity(cart, item.id)}
                        askedCount={localCounts[item.id] ?? item.inquiryCount}
                        showAsked={showItemStats}
                        onSetQuantity={(quantity) => setQuantity(item, quantity)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </section>

      {/* THE CONDITION THE PICTURES ARE HERE UNDER, not a footnote.
          Photographs found through the photo finder are used under Creative
          Commons licences that require the creator to be named. One list at
          the foot of the page rather than a caption under every tile: the
          obligation is to credit them, not to interrupt a menu forty times. */}
      {credits.length > 0 && (
        <section className="liquid-glass-panel rounded-3xl px-5 py-4">
          <h2 className="font-mono text-[12.5px] font-extrabold tracking-[0.22em] text-white/60 uppercase">
            Photo credits
          </h2>
          <ul className="mt-2 space-y-1">
            {credits.map((credit) => (
              <li key={credit.source + credit.creator} className="text-[15px] text-white/60">
                {credit.source ? (
                  <a
                    href={credit.source}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="underline decoration-white/25 underline-offset-2 hover:text-white"
                  >
                    {credit.creator}
                  </a>
                ) : (
                  credit.creator
                )}
                <span className="text-white/50"> · {credit.license}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ReviewSection ventureId={v.id} ownerId={v.ownerId} />

      {/* Also on bare backdrop, and smaller again — see the note in SignIn. */}
      <p className="px-1 pb-2 text-center font-mono text-[12.5px] tracking-[0.18em] text-white/50 uppercase">
        You pay the seller directly
      </p>

      {/* Fixed rather than sticky-in-flow: the review section below the menu
          would otherwise scroll the bar out of reach on a long page, right
          when someone has finally decided what they want. */}
      {mine.length > 0 && (
        // bottom-24 clears MobileNav, which is fixed at bottom-3 below md;
        // above md there is no bottom nav, so it sits flush with the edge.
        <div className="fixed inset-x-0 bottom-24 z-40 flex justify-center p-3 sm:p-4 md:bottom-0">
          {/* OPAQUE, not .liquid-glass-panel. Glass takes its contrast from
              whatever is behind it, and what is behind this bar is a grid of
              product photos — a sticker shop's white-background PNGs turned it
              into unreadable grey-on-white. A checkout bar is the one element
              on the page that must be legible over every possible backdrop, so
              it brings its own. The blur stays for the edges.

              A LINK NOW, NOT A BUTTON THAT OPENED A DIALOG. Checkout moved to
              /cart when the cart went global, and this has to be a real
              navigation so the back button returns to the menu. */}
          <Link
            to="/cart"
            className="flex w-full max-w-md items-center gap-3 rounded-2xl border border-white/15 bg-surface/95 px-5 py-3.5 text-left shadow-[0_20px_50px_rgba(0,0,0,0.75)] backdrop-blur-xl transition duration-150 hover:border-white/25 active:scale-[0.98]"
          >
            <ShoppingCart size={18} className="shrink-0 text-brand-400" aria-hidden="true" />
            <span className="min-w-0 flex-1">
              <span className="block text-[15.5px] font-bold text-white">
                {mine.length} {mine.length === 1 ? 'item' : 'items'} from {v.name}
              </span>
              <span className="block text-[14px] text-white/50">Go to cart to order</span>
            </span>
            <span className="shrink-0 font-mono text-[17px] font-extrabold text-brand-400">
              ₹{mineTotal}
            </span>
          </Link>
        </div>
      )}
    </div>
  )
}
