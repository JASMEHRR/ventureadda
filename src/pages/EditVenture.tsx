import { useEffect, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import VentureForm from '../components/VentureForm'
import type { VentureFormValues } from '../components/VentureForm'
import LoadingLine from '../components/ui/LoadingLine'
import ChooseUsername from './ChooseUsername'
import { useAuth } from '../auth/AuthProvider'
import { useAsyncData } from '../hooks/useAsyncData'
import { getVenture, listMenuItems, updateVenture } from '../data/ventures'
import type { MenuItemDraft } from '../data/types'

export default function EditVenture() {
  const { ventureId = '' } = useParams()
  const { profile, status, user } = useAuth()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])

  // The document id, not the URL segment: /venture/glood/edit resolves through
  // the slug claim, and both the menu read and the save below key off the id.
  // Editing links are built from the id today, but a hand-typed or bookmarked
  // slug must not silently load an empty menu and then save over the venture.
  const resolvedId = venture.data?.id
  const menu = useAsyncData(
    () => (resolvedId ? listMenuItems(resolvedId) : Promise.resolve([])),
    [resolvedId],
  )

  useEffect(() => {
    if (saved) navigate('/profile', { replace: true })
  }, [saved, navigate])

  if (status === 'loading' || venture.loading || menu.loading) {
    return (
      <LoadingLine label="Loading…" />
    )
  }
  if (status === 'signedOut') return <Navigate to="/signin" replace />
  // Signed in without a username. Sending them to /signin would bounce them to
  // /browse with no explanation, same dead end Profile had; AddVenture already
  // does it this way.
  if (!profile) {
    return <ChooseUsername reason="Your listings are filed under a username, so pick one first." />
  }

  if (!venture.data) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-white/50">
        That venture does not exist, or you do not have access to it.
      </p>
    )
  }

  // The rules enforce this too; the check here is so the page says something
  // useful instead of failing on save.
  const isOwner = venture.data.ownerId === profile.uid
  // A co-owner the owner listed by address. The rules agree, and they may edit
  // everything here except who else is on that list.
  const isManager = Boolean(
    user?.email && venture.data.managerEmails.includes(user.email.toLowerCase()),
  )
  const mayEdit = isOwner || isManager || profile.isModerator
  if (!mayEdit) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[16px] text-white/50">
        Only the owner can edit this listing.
      </p>
    )
  }

  const drafts: MenuItemDraft[] = (menu.data ?? []).map((item, index) => ({
    key: `existing-${item.id}-${index}`,
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    // Same trap as stock below, and this one shipped: since a price became
    // optional, String(undefined) wrote the word "undefined" into the box on
    // every unpriced item — which then failed validation and made the whole
    // listing unsavable, menu edits and all.
    price: item.price === undefined ? '' : String(item.price),
    category: item.category ?? '',
    // Undefined means the seller was not counting, and the form says that with
    // an empty field. String(undefined) would put the word "undefined" in it.
    stock: item.stock === undefined ? '' : String(item.stock),
    inStock: item.inStock,
    limitedTime: item.limitedTime === true,
    photo: item.photo,
  }))

  const handleSubmit = async ({ venture: input, items }: VentureFormValues) => {
    if (!resolvedId) throw new Error('That venture could not be loaded.')
    await updateVenture(resolvedId, input, items)
    setSaved(true)
  }

  return (
    // Wider from lg so VentureForm's save rail has a column to sit in.
    <div className="mx-auto max-w-5xl space-y-4">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[16px] leading-relaxed text-white/50">
        Edits go live immediately — approval is only for new listings. Items you keep hold on to
        their enquiry counts; items you remove lose theirs.
      </p>
      <VentureForm
        initial={{ ...venture.data, items: drafts }}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
        canEditManagers={isOwner || profile.isModerator}
      />
    </div>
  )
}
