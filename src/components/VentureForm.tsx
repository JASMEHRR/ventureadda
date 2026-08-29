import { useState } from 'react'
import { Check, Pencil, Plus, Trash2, X } from 'lucide-react'
import Button from './ui/Button'
import MenuImport from './MenuImport'
import Field from './ui/Field'
import Select from './ui/Select'
import PhotoUploader from './ui/PhotoUploader'
import StockToggle from './ui/StockToggle'
import TextField, { inputClass } from './ui/TextField'
import Textarea from './ui/Textarea'
import type { SelectOption } from './ui/Select'
import { CATEGORIES } from '../data/types'
import type { MenuDensity, MenuItemDraft, StoredImage } from '../data/types'
import type { MenuItemInput, VentureInput } from '../data/ventures'
import { validateMenuDrafts } from '../data/menuDrafts'
import type { ParsedRow } from '../data/menuParse'

const CATEGORY_OPTIONS: SelectOption<string>[] = CATEGORIES.map((category) => ({
  value: category.id,
  label: category.name,
}))

/**
 * How the seller's own menu is laid out by default.
 *
 * A seller setting rather than a fixed grid, because the right answer depends
 * entirely on the stock: four photographed cakes are wasted at six to a row,
 * and a forty-line stationery list read two at a time is a scroll nobody
 * finishes. Buyers can still override it on their own device, so this is the
 * starting point, not a rule.
 */
const DENSITY_OPTIONS: SelectOption<MenuDensity>[] = [
  { value: 'roomy', label: 'Large — big photos, few per row' },
  { value: 'default', label: 'Medium — the usual balance' },
  { value: 'dense', label: 'Small — fit the most on screen' },
]

/** A venture may publish at most this many collection windows. Mirrors firestore.rules. */
const MAX_SLOTS = 12

let draftKeySeed = 0
const newDraft = (): MenuItemDraft => ({
  key: `draft-${(draftKeySeed += 1)}`,
  name: '',
  description: '',
  price: '',
  category: '',
  stock: '',
  // A new item is for sale. The other default would mean every item added in a
  // hurry is invisible to buyers for reasons its owner never sees.
  inStock: true,
})

export type VentureFormValues = {
  venture: VentureInput
  items: MenuItemInput[]
}

type VentureFormProps = {
  initial?: Partial<VentureInput> & { items?: MenuItemDraft[] }
  submitLabel: string
  onSubmit: (values: VentureFormValues) => Promise<void>
}

/**
 * The section a menu item belongs to, picked rather than typed.
 *
 * REPLACES a plain input backed by `<datalist>`. That control was the one
 * thing on this page rendered by the browser rather than by us: an unstyled
 * white system dropdown in the middle of a dark glass form, with no indication
 * it was even there until you clicked. Worse, it was still a free-text field,
 * so "Snacks" and "snacks" made two sections out of one and the seller found
 * out by looking at their own live menu.
 *
 * Existing sections are now chips — one tap, spelled identically every time —
 * and the input is only for a section that does not exist yet.
 */
function SectionPicker({
  value,
  known,
  onChange,
  label,
}: {
  value: string
  /** Every section name already used elsewhere in this menu. */
  known: string[]
  onChange: (next: string) => void
  label: string
}) {
  return (
    <div>
      <span className="mb-1.5 block font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/40 uppercase">
        Section
      </span>

      {known.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {known.map((section) => {
            const active = value === section
            return (
              <button
                key={section}
                type="button"
                aria-pressed={active}
                // Tapping the active chip clears it, which is the only way back
                // to "no section" once one is chosen without hunting for the
                // text field and deleting it by hand.
                onClick={() => onChange(active ? '' : section)}
                className={`rounded-full border px-3 py-1.5 text-[15px] font-bold transition duration-150 active:scale-[0.96] ${
                  active
                    ? 'border-brand-400/50 bg-brand-500/20 text-brand-300'
                    : 'border-white/10 bg-white/[0.04] text-white/55 hover:border-white/25 hover:text-white'
                }`}
              >
                {section}
              </button>
            )
          })}
        </div>
      )}

      <input
        aria-label={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={known.length > 0 ? 'Or type a new section' : 'Optional, e.g. Snacks'}
        className={inputClass}
      />
    </div>
  )
}

/**
 * The menu's own sections, managed in one place instead of item by item.
 *
 * The per-item picker below can only ever *apply* a section that already
 * exists on some other item, which left no way to do the three things a seller
 * actually wants: create a section before there is anything in it, fix a typo
 * in one they already used, or get rid of one entirely. Renaming meant editing
 * every item that carried the old spelling and hoping you matched it exactly,
 * and deleting meant clearing the field on each of them by hand — on a
 * thirty-item menu that is thirty edits to fix one word.
 *
 * A rename here rewrites every item holding the old name in the same keystroke,
 * which is the whole reason this lives above the list rather than inside it.
 * Nothing here writes to Firestore: sections are still just a string on each
 * item, so this edits form state and Save publishes it like everything else.
 */
function SectionsEditor({
  sections,
  counts,
  onAdd,
  onRename,
  onRemove,
}: {
  sections: string[]
  /** How many items carry each section, so a delete can say what it will empty. */
  counts: Record<string, number>
  onAdd: (name: string) => void
  onRename: (from: string, to: string) => void
  onRemove: (name: string) => void
}) {
  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState<string | null>(null)
  const [rename, setRename] = useState('')

  const clash = (name: string, except?: string) =>
    sections.some((other) => other.toLowerCase() === name.toLowerCase() && other !== except)

  const add = () => {
    const value = draft.trim()
    // Case-insensitive, for the same reason the picker uses chips: "Snacks"
    // and "snacks" published as two headings is the bug this whole panel is
    // here to stop.
    if (!value || clash(value)) {
      setDraft('')
      return
    }
    onAdd(value)
    setDraft('')
  }

  const commitRename = () => {
    if (editing === null) return
    const value = rename.trim()
    if (value && value !== editing && !clash(value, editing)) onRename(editing, value)
    setEditing(null)
  }

  return (
    <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
          Menu sections
        </h2>
        <span className="font-mono text-[13px] text-white/30">
          {sections.length} {sections.length === 1 ? 'section' : 'sections'}
        </span>
      </div>

      <p className="text-[15.5px] leading-relaxed text-white/45">
        The headings your menu is grouped under, like Snacks or Drinks. Rename one here and every
        item under it follows. Optional — a menu with no sections is one plain list.
      </p>

      {sections.length > 0 && (
        <ul className="space-y-2">
          {sections.map((section) => {
            const used = counts[section] ?? 0
            return (
              <li
                key={section}
                className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/8 bg-white/[0.03] px-3 py-2.5"
              >
                {editing === section ? (
                  <>
                    <input
                      autoFocus
                      aria-label={`New name for the ${section} section`}
                      value={rename}
                      onChange={(event) => setRename(event.target.value)}
                      // Enter here would otherwise submit the whole venture,
                      // the same trap the slots field guards against.
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                          event.preventDefault()
                          commitRename()
                        }
                        if (event.key === 'Escape') setEditing(null)
                      }}
                      maxLength={40}
                      className={`${inputClass} min-w-0 flex-1`}
                    />
                    <Button type="button" variant="secondary" onClick={commitRename}>
                      <Check size={13} aria-hidden="true" />
                      Save
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="min-w-0 flex-1 truncate text-[16px] font-bold text-white/85">
                      {section}
                    </span>
                    <span className="font-mono text-[13px] text-white/30">
                      {used} {used === 1 ? 'item' : 'items'}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing(section)
                        setRename(section)
                      }}
                      aria-label={`Rename the ${section} section`}
                      className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/45 transition duration-150 hover:text-white active:scale-[0.94]"
                    >
                      <Pencil size={13} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onRemove(section)}
                      // Says what it costs, because the items are not deleted
                      // with it — they come back as ungrouped, which is not
                      // obvious from a bin icon alone.
                      title={
                        used === 0
                          ? 'Remove this section'
                          : `Remove this section. Its ${used} ${used === 1 ? 'item stays' : 'items stay'} on the menu, ungrouped.`
                      }
                      aria-label={`Remove the ${section} section`}
                      className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/45 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          id="venture-section-input"
          aria-label="New section name"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
          maxLength={40}
          placeholder="Snacks"
          className={inputClass}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={draft.trim() === ''}
          className="shrink-0"
        >
          <Plus size={13} aria-hidden="true" />
          Add
        </Button>
      </div>
    </section>
  )
}

/**
 * The collection windows a buyer may choose from at checkout.
 *
 * Free text on purpose. "After 9pm" and "Between classes, Tuesday" are both
 * real answers on this campus, and a time picker would refuse them both.
 */
function SlotsEditor({
  slots,
  onChange,
}: {
  slots: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = useState('')

  const add = () => {
    const value = draft.trim()
    if (!value) return
    // Case-insensitive, because "6pm - 8pm" and "6PM - 8PM" offered as two
    // choices is a checkout that looks broken.
    if (slots.some((slot) => slot.toLowerCase() === value.toLowerCase())) {
      setDraft('')
      return
    }
    if (slots.length >= MAX_SLOTS) return
    onChange([...slots, value])
    setDraft('')
  }

  return (
    <Field
      id="venture-slot-input"
      label="Collection or delivery times"
      hint={
        slots.length >= MAX_SLOTS
          ? `That is the maximum of ${MAX_SLOTS} windows.`
          : 'Optional. Buyers pick one of these when they order. Leave it empty and you agree a time in the conversation instead.'
      }
    >
      {slots.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1.5">
          {slots.map((slot) => (
            <span
              key={slot}
              className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] py-1.5 pr-1.5 pl-3 text-[15px] font-bold text-white/80"
            >
              {slot}
              <button
                type="button"
                onClick={() => onChange(slots.filter((other) => other !== slot))}
                aria-label={`Remove the ${slot} window`}
                className="rounded-full p-1 text-white/40 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.9]"
              >
                <X size={11} aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          id="venture-slot-input"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // Enter would otherwise submit the whole venture, which on a form
          // this long is a genuinely destructive surprise.
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return
            event.preventDefault()
            add()
          }}
          maxLength={60}
          disabled={slots.length >= MAX_SLOTS}
          placeholder="6pm – 8pm"
          className={`${inputClass} disabled:opacity-40`}
        />
        <Button
          type="button"
          variant="secondary"
          onClick={add}
          disabled={draft.trim() === '' || slots.length >= MAX_SLOTS}
          className="shrink-0"
        >
          Add
        </Button>
      </div>
    </Field>
  )
}

export default function VentureForm({ initial, submitLabel, onSubmit }: VentureFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'food')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [hours, setHours] = useState(initial?.hours ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [photos, setPhotos] = useState<StoredImage[]>(initial?.photos ?? [])
  const [logo, setLogo] = useState<StoredImage | undefined>(initial?.logo)
  const [deliverySlots, setDeliverySlots] = useState<string[]>(initial?.deliverySlots ?? [])
  const [menuDensity, setMenuDensity] = useState<MenuDensity>(initial?.menuDensity ?? 'default')
  const [items, setItems] = useState<MenuItemDraft[]>(
    initial?.items?.length ? initial.items : [newDraft()],
  )

  /**
   * Sections created in the panel above that nothing has been filed under yet.
   *
   * They cannot live on the items — being able to make one first is the point —
   * and they are not persisted either: a section is a string on a menu item, so
   * an empty one has nothing to save and is gone on reload. It exists for the
   * length of this edit, which is exactly as long as it is useful.
   */
  const [emptySections, setEmptySections] = useState<string[]>([])

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  /**
   * Imported items — scanned, pasted or dictated — land as ordinary drafts, so
   * they are edited, validated and submitted through exactly the same path as
   * typed ones. Nothing here writes to Firestore.
   *
   * A row whose price could not be read arrives with an empty price rather
   * than a zero, and the submit validation refuses it until the owner fills it
   * in. That is the point: a guessed price is the failure this whole feature
   * has to avoid.
   *
   * Appended rather than replacing, so a second scan of page two of a menu
   * adds to the first. The one exception is a single untouched empty row,
   * which is the form's own starting state and would otherwise leave a blank
   * item sitting above the results.
   */
  const addExtracted = (extracted: ParsedRow[]) =>
    setItems((prev) => {
      const blank = prev.length === 1 && prev[0].name.trim() === '' && prev[0].price.trim() === ''
      return [
        ...(blank ? [] : prev),
        ...extracted.map((item) => ({
          ...newDraft(),
          name: item.name,
          description: item.description,
          price: item.price,
          // A pasted list that had headings keeps them: the seller already
          // grouped their menu once, on whatever page they copied it from.
          category: item.category ?? '',
        })),
      ]
    })

  const patchItem = (key: string, patch: Partial<MenuItemDraft>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))

  /** Every section on this menu — in use or just created — for the per-item
   *  chips and for the manager panel. */
  const knownSections = [
    ...new Set([...items.map((item) => item.category.trim()).filter(Boolean), ...emptySections]),
  ]

  const sectionCounts: Record<string, number> = {}
  for (const section of knownSections) sectionCounts[section] = 0
  for (const item of items) {
    const section = item.category.trim()
    if (section) sectionCounts[section] += 1
  }

  /** One rename, applied to every item carrying the old name. Doing this from
   *  the item rows themselves is what was impossible before. */
  const renameSection = (from: string, to: string) => {
    setItems((prev) =>
      prev.map((item) => (item.category.trim() === from ? { ...item, category: to } : item)),
    )
    setEmptySections((prev) => prev.map((name) => (name === from ? to : name)))
  }

  /** Removing a section ungroups its items rather than deleting them. Deleting
   *  a heading must never delete stock. */
  const removeSection = (name: string) => {
    setItems((prev) =>
      prev.map((item) => (item.category.trim() === name ? { ...item, category: '' } : item)),
    )
    setEmptySections((prev) => prev.filter((other) => other !== name))
  }

  const soldOutCount = items.filter((item) => !item.inStock && item.name.trim() !== '').length

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    const menu = validateMenuDrafts(items)
    if (!menu.ok) {
      setError(menu.error)
      return
    }
    const filled = menu.items

    // No photo check. A listing without one is worse than a listing with one,
    // but it is far better than the venture nobody lists because they have not
    // photographed their stock yet. VentureCard and the venture page both
    // render the no-photo case already.
    // wa.me needs digits only; anything shorter is a typo, not a number.
    const digits = phone.replace(/\D/g, '')
    if (digits.length < 10) {
      setError('Enter a WhatsApp number with country code, for example 919876543210.')
      return
    }

    setBusy(true)
    try {
      await onSubmit({
        venture: {
          name: name.trim(),
          categoryId,
          description: description.trim(),
          hours: hours.trim(),
          phone: digits,
          photos,
          deliverySlots,
          menuDensity,
          logo,
        },
        items: filled.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          description: item.description.trim(),
          // Blank is a decision, not an omission — see validateMenuDrafts.
          price: item.price.trim() === '' ? undefined : Math.round(Number(item.price)),
          category: item.category.trim() || undefined,
          inStock: item.inStock,
          // Blank means the seller is not counting. Number('') is 0, which
          // would silently publish every uncounted item as "none left".
          stock: item.stock.trim() === '' ? undefined : Math.round(Number(item.stock)),
          photo: item.photo,
        })),
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    /**
     * Two columns from `lg`, with the save panel in the right-hand one.
     *
     * A single Save at the foot of the page is fine for a form you can see all
     * of. This one holds a whole catalogue — thirty items is a realistic menu,
     * and each item is six fields and a photo — so saving meant scrolling past
     * everything you had just typed to reach the only button that keeps it.
     * Below `lg` there is no room for a rail, so the same panel sticks to the
     * bottom of the viewport instead.
     */
    <form onSubmit={submit} className="lg:grid lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start lg:gap-4">
      <div className="space-y-4">
        <section className="liquid-glass-panel space-y-4 rounded-3xl p-5">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            The basics
          </h2>

          <TextField
            id="venture-name"
            label="Venture name"
            required
            maxLength={60}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Hostel Bakes"
          />

          <Select
            label="Category"
            value={categoryId}
            options={CATEGORY_OPTIONS}
            onChange={setCategoryId}
          />

          <Textarea
            id="venture-description"
            label="Description"
            hint="Two lines is plenty."
            required
            maxLength={600}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What you make, and how people collect it."
          />

          <TextField
            id="venture-hours"
            label="Opening hours"
            required
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            placeholder="4pm – 11pm, daily"
          />

          <SlotsEditor slots={deliverySlots} onChange={setDeliverySlots} />

          <TextField
            id="venture-phone"
            label="WhatsApp number"
            hint="With country code. This is where item enquiries land, and it is shown to buyers who order."
            required
            inputMode="tel"
            value={phone}
            onChange={(event) => setPhone(event.target.value)}
            placeholder="919876543210"
          />

          <PhotoUploader
            label="Logo"
            hint="Optional. A square image shown next to your name. Without one, your initial is used."
            photos={logo ? [logo] : []}
            onChange={(next) => setLogo(next[0])}
            max={1}
          />

          <PhotoUploader
            label="Photos"
            hint="Up to four. Buyers swipe through them on your card, and the first one is the cover — use the arrows to choose which leads. Every photo is cropped square-ish, so pick one that survives it."
            photos={photos}
            onChange={setPhotos}
          />
        </section>

        <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
          <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Menu layout
          </h2>
          <p className="text-[15.5px] leading-relaxed text-white/45">
            Where your menu starts for everyone who opens it. Buyers can resize it on their own
            device if they prefer, so this is your default rather than a lock.
          </p>
          <Select
            label="Item size on your page"
            value={menuDensity}
            options={DENSITY_OPTIONS}
            onChange={setMenuDensity}
          />
        </section>

        <SectionsEditor
          sections={knownSections}
          counts={sectionCounts}
          onAdd={(name) => setEmptySections((prev) => [...prev, name])}
          onRename={renameSection}
          onRemove={removeSection}
        />

        {/* TWO SEGMENTS, NOT ONE PANEL.

            Importing and editing are different jobs with different rhythms.
            The import tools are three buttons you use once, at the start, and
            never look at again; the item list is the long grind you scroll
            through for the rest of the session. Sharing a panel parked a
            paragraph about photographing a menu permanently above the first
            field anyone has to fill in, and left the item count sitting beside
            a heading that covered both and described neither. */}
        <MenuImport onAdd={addExtracted} />

        <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="font-mono text-[13px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
              Menu
            </h2>
            <span className="font-mono text-[13px] text-white/30">
              {items.length} {items.length === 1 ? 'item' : 'items'}
            </span>
          </div>

          {items.map((item, index) => (
            <div key={item.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <span className="font-mono text-[12.5px] font-extrabold tracking-[0.18em] text-white/30 uppercase">
                  Item {index + 1}
                </span>
                <div className="flex items-center gap-2">
                  <StockToggle
                    value={item.inStock}
                    onChange={(next) => patchItem(item.key, { inStock: next })}
                    label={`Item ${index + 1} availability`}
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setItems((prev) => prev.filter((row) => row.key !== item.key))}
                      aria-label={`Remove item ${index + 1}`}
                      className="rounded-full border border-white/10 bg-white/5 p-1.5 text-white/45 transition duration-150 hover:bg-red-500/20 hover:text-red-300 active:scale-[0.94]"
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
                <input
                  aria-label={`Item ${index + 1} name`}
                  value={item.name}
                  onChange={(event) => patchItem(item.key, { name: event.target.value })}
                  placeholder="Chocolate Fudge Cake"
                  className={inputClass}
                />
                <input
                  aria-label={`Item ${index + 1} price in rupees`}
                  inputMode="numeric"
                  value={item.price}
                  onChange={(event) => patchItem(item.key, { price: event.target.value })}
                  placeholder="₹ 450, or leave blank"
                  className={`${inputClass} sm:w-28`}
                />
                <input
                  aria-label={`Item ${index + 1} units in stock, optional`}
                  inputMode="numeric"
                  value={item.stock}
                  onChange={(event) => patchItem(item.key, { stock: event.target.value })}
                  placeholder="Qty"
                  title="How many you have. Leave empty if you are not counting."
                  className={`${inputClass} sm:w-24`}
                />
              </div>

              <input
                aria-label={`Item ${index + 1} description`}
                value={item.description}
                onChange={(event) => patchItem(item.key, { description: event.target.value })}
                placeholder="Dark chocolate, 500g, serves four"
                className={`${inputClass} mt-3`}
              />

              <div className="mt-3">
                <SectionPicker
                  value={item.category}
                  known={knownSections}
                  onChange={(next) => patchItem(item.key, { category: next })}
                  label={`Item ${index + 1} section`}
                />
              </div>

              <div className="mt-3">
                <PhotoUploader
                  label="Item photo"
                  photos={item.photo ? [item.photo] : []}
                  onChange={(next) => patchItem(item.key, { photo: next[0] })}
                  max={1}
                />
              </div>
            </div>
          ))}

          <Button
            type="button"
            variant="secondary"
            onClick={() => setItems((prev) => [...prev, newDraft()])}
          >
            <Plus size={13} aria-hidden="true" />
            Add another item
          </Button>
        </section>
      </div>

      {/* Sticks to the top of the rail on desktop, to the bottom of the
          viewport on a phone. `bottom-24` clears MobileNav, which is fixed at
          bottom-3 below md. */}
      <div className="sticky bottom-24 z-30 mt-4 md:bottom-4 lg:top-6 lg:bottom-auto lg:mt-0">
        <div className="liquid-glass-panel space-y-3 rounded-3xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
          {error && (
            <p role="alert" className="text-[15.5px] leading-relaxed text-red-400">
              {error}
            </p>
          )}

          <Button type="submit" variant="primary" loading={busy} className="w-full">
            {submitLabel}
          </Button>

          {/* Desktop only. On a phone the panel is a bar over the content and
              every extra line of it is a line of the form you cannot see. */}
          <dl className="hidden gap-1 lg:grid">
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-mono text-[12.5px] tracking-[0.18em] text-white/30 uppercase">
                Items
              </dt>
              <dd className="font-mono text-[15px] font-bold text-white/70">{items.length}</dd>
            </div>
            {soldOutCount > 0 && (
              <div className="flex items-baseline justify-between gap-2">
                <dt className="font-mono text-[12.5px] tracking-[0.18em] text-white/30 uppercase">
                  Sold out
                </dt>
                <dd className="font-mono text-[15px] font-bold text-red-400">{soldOutCount}</dd>
              </div>
            )}
            <div className="flex items-baseline justify-between gap-2">
              <dt className="font-mono text-[12.5px] tracking-[0.18em] text-white/30 uppercase">
                Windows
              </dt>
              <dd className="font-mono text-[15px] font-bold text-white/70">
                {deliverySlots.length}
              </dd>
            </div>
          </dl>
        </div>
      </div>
    </form>
  )
}
