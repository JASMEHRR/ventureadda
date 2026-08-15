import { useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import Button from './ui/Button'
import MenuImport from './MenuImport'
import Select from './ui/Select'
import PhotoUploader from './ui/PhotoUploader'
import TextField, { inputClass } from './ui/TextField'
import Textarea from './ui/Textarea'
import type { SelectOption } from './ui/Select'
import { CATEGORIES } from '../data/types'
import type { MenuItemDraft, StoredImage } from '../data/types'
import type { MenuItemInput, VentureInput } from '../data/ventures'
import { validateMenuDrafts } from '../data/menuDrafts'
import type { ParsedRow } from '../data/menuParse'

const CATEGORY_OPTIONS: SelectOption<string>[] = CATEGORIES.map((category) => ({
  value: category.id,
  label: category.name,
}))

let draftKeySeed = 0
const newDraft = (): MenuItemDraft => ({
  key: `draft-${(draftKeySeed += 1)}`,
  name: '',
  description: '',
  price: '',
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

export default function VentureForm({ initial, submitLabel, onSubmit }: VentureFormProps) {
  const [name, setName] = useState(initial?.name ?? '')
  const [categoryId, setCategoryId] = useState(initial?.categoryId ?? 'food')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [hours, setHours] = useState(initial?.hours ?? '')
  const [phone, setPhone] = useState(initial?.phone ?? '')
  const [photos, setPhotos] = useState<StoredImage[]>(initial?.photos ?? [])
  const [logo, setLogo] = useState<StoredImage | undefined>(initial?.logo)
  const [items, setItems] = useState<MenuItemDraft[]>(
    initial?.items?.length ? initial.items : [newDraft()],
  )

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
        })),
      ]
    })

  const patchItem = (key: string, patch: Partial<MenuItemDraft>) =>
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, ...patch } : item)))

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
          logo,
        },
        items: filled.map((item) => ({
          id: item.id,
          name: item.name.trim(),
          description: item.description.trim(),
          price: Math.round(Number(item.price)),
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
    <form onSubmit={submit} className="space-y-4">
      <section className="liquid-glass-panel space-y-4 rounded-3xl p-5">
        <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
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

        <TextField
          id="venture-phone"
          label="WhatsApp number"
          hint="With country code. This is where item enquiries land."
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
          hint="Optional, but a listing with photos gets opened far more. Up to four, JPG, PNG or WebP, 5MB each."
          photos={photos}
          onChange={setPhotos}
        />
      </section>

      <section className="liquid-glass-panel space-y-3 rounded-3xl p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-mono text-[10px] font-extrabold tracking-[0.22em] text-brand-400 uppercase">
            Menu
          </h2>
          <span className="font-mono text-[10px] text-white/30">
            {items.length} {items.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        <MenuImport onAdd={addExtracted} />

        {items.map((item, index) => (
          <div key={item.key} className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="font-mono text-[9px] font-extrabold tracking-[0.18em] text-white/30 uppercase">
                Item {index + 1}
              </span>
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

            <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
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
                placeholder="450"
                className={`${inputClass} sm:w-28`}
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

      {error && (
        <p
          role="alert"
          className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[13.5px] text-red-400"
        >
          {error}
        </p>
      )}

      <Button type="submit" variant="primary" loading={busy} className="w-full">
        {submitLabel}
      </Button>
    </form>
  )
}
