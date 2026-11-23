import { useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import {
  useCurrentGymId, useMembershipPlansAll, useCreatePlan, useUpdatePlan, useSetPlanActive,
} from '../features/settings/queries'

interface Plan {
  id: string
  name: string
  duration_days: number | null
  default_price: number
  is_active: boolean
}

export default function SettingsPage() {
  const { data: gymId } = useCurrentGymId()
  const { data: plans, isLoading } = useMembershipPlansAll()
  const [modalOpen, setModalOpen] = useState(false)
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null)
  const setActive = useSetPlanActive()

  function openAdd() {
    setEditingPlan(null)
    setModalOpen(true)
  }
  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setModalOpen(true)
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl tracking-wide">Settings</h1>

      <section className="space-y-4 rounded border border-border p-4">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl tracking-wide">Membership plans</h2>
          <button onClick={openAdd} className="rounded bg-accent px-4 py-2 text-sm font-medium text-white">
            Add plan
          </button>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Duration</th>
              <th className="py-2 pr-4 font-medium">Price</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium"></th>
            </tr>
          </thead>
          <tbody>
            {isLoading && <tr><td colSpan={5} className="py-4 text-center text-muted">Loading...</td></tr>}
            {plans?.map((p) => (
              <tr key={p.id} className="border-b border-border">
                <td className="py-2 pr-4">{p.name}</td>
                <td className="py-2 pr-4 text-muted">{p.duration_days ? `${p.duration_days} days` : 'Custom'}</td>
                <td className="py-2 pr-4 text-muted">{Number(p.default_price).toFixed(2)}</td>
                <td className="py-2 pr-4">
                  <span className={p.is_active ? 'text-success' : 'text-muted'}>{p.is_active ? 'Active' : 'Inactive'}</span>
                </td>
                <td className="py-2 pr-4">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface">
                      Edit
                    </button>
                    <button
                      onClick={() => setActive.mutate({ id: p.id, isActive: !p.is_active })}
                      disabled={setActive.isPending}
                      className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface disabled:opacity-50"
                    >
                      {p.is_active ? 'Deactivate' : 'Reactivate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {modalOpen && (
        <PlanModal
          key={editingPlan?.id ?? 'new'}
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          gymId={gymId}
          editingPlan={editingPlan}
        />
      )}
    </div>
  )
}

function PlanModal({
  open, onClose, gymId, editingPlan,
}: {
  open: boolean
  onClose: () => void
  gymId: string | undefined
  editingPlan: Plan | null
}) {
  const [name, setName] = useState(editingPlan?.name ?? '')
  const [customDuration, setCustomDuration] = useState(editingPlan ? editingPlan.duration_days == null : false)
  const [durationDays, setDurationDays] = useState(editingPlan?.duration_days != null ? String(editingPlan.duration_days) : '30')
  const [price, setPrice] = useState(editingPlan ? String(editingPlan.default_price) : '')
  const [error, setError] = useState<string | null>(null)

  const createPlan = useCreatePlan(gymId)
  const updatePlan = useUpdatePlan()
  const pending = createPlan.isPending || updatePlan.isPending

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const durationValue = customDuration ? null : Number(durationDays)
    try {
      if (editingPlan) {
        await updatePlan.mutateAsync({ id: editingPlan.id, name, durationDays: durationValue, defaultPrice: Number(price) })
      } else {
        await createPlan.mutateAsync({ name, durationDays: durationValue, defaultPrice: Number(price) })
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={editingPlan ? 'Edit plan' : 'Add plan'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Plan name</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={customDuration} onChange={(e) => setCustomDuration(e.target.checked)} />
            Custom duration (set per membership instead of fixed)
          </label>
        </div>
        {!customDuration && (
          <div>
            <label className="block text-sm font-medium">Duration (days)</label>
            <input type="number" required min={1} value={durationDays} onChange={(e) => setDurationDays(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium">Default price</label>
          <input type="number" required min={0} step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} className="mt-1 w-full rounded border border-border bg-background px-3 py-2" />
        </div>
        <button type="submit" disabled={pending} className="w-full rounded bg-accent py-2 font-medium text-white disabled:opacity-50">
          {pending ? 'Saving...' : editingPlan ? 'Save changes' : 'Add plan'}
        </button>
      </form>
    </Modal>
  )
}