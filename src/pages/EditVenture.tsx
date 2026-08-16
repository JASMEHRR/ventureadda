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
  const { profile, status } = useAuth()
  const navigate = useNavigate()
  const [saved, setSaved] = useState(false)

  const venture = useAsyncData(() => getVenture(ventureId), [ventureId])
  const menu = useAsyncData(() => listMenuItems(ventureId), [ventureId])

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
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-white/50">
        That venture does not exist, or you do not have access to it.
      </p>
    )
  }

  // The rules enforce this too; the check here is so the page says something
  // useful instead of failing on save.
  const mayEdit = venture.data.ownerId === profile.uid || profile.isModerator
  if (!mayEdit) {
    return (
      <p className="liquid-glass-panel rounded-3xl px-5 py-4 text-[14px] text-white/50">
        Only the owner can edit this listing.
      </p>
    )
  }

  const drafts: MenuItemDraft[] = (menu.data ?? []).map((item, index) => ({
    key: `existing-${item.id}-${index}`,
    id: item.id,
    name: item.name,
    description: item.description ?? '',
    price: String(item.price),
    category: item.category ?? '',
    // Undefined means the seller was not counting, and the form says that with
    // an empty field. String(undefined) would put the word "undefined" in it.
    stock: item.stock === undefined ? '' : String(item.stock),
    inStock: item.inStock,
    photo: item.photo,
  }))

  const handleSubmit = async ({ venture: input, items }: VentureFormValues) => {
    await updateVenture(ventureId, input, items)
    setSaved(true)
  }

  return (
    // Wider from lg so VentureForm's save rail has a column to sit in.
    <div className="mx-auto max-w-2xl space-y-4 lg:max-w-5xl">
      <p className="liquid-glass-panel rounded-2xl px-5 py-3.5 text-[13.5px] leading-relaxed text-white/50">
        Edits go live immediately — approval is only for new listings. Items you keep hold on to
        their enquiry counts; items you remove lose theirs.
      </p>
      <VentureForm
        initial={{ ...venture.data, items: drafts }}
        submitLabel="Save changes"
        onSubmit={handleSubmit}
      />
    </div>
  )
}
