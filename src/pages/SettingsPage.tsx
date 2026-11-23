import { useState, type FormEvent } from 'react'
import { Modal } from '../components/Modal'
import {
  useCurrentGymId, useMembershipPlansAll, useCreatePlan, useUpdatePlan, useSetPlanActive,
} from '../features/settings/queries'
import { SkeletonTable } from '../components/Skeleton'
import { EmptyState } from '../components/EmptyState'
import { useToast } from '../context/ToastContext'
import { formatCurrency } from '../lib/formatCurrency'
import { Spinner } from '../components/Spinner'
import { Layers, Plus } from 'lucide-react'

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
  const toast = useToast()

  function openAdd() {
    setEditingPlan(null)
    setModalOpen(true)
  }
  function openEdit(plan: Plan) {
    setEditingPlan(plan)
    setModalOpen(true)
  }

  return (
    <div className="page-container space-y-6">
      <h1 className="page-title">Settings</h1>

      <section className="space-y-4 rounded-xl border border-border bg-surface/30 p-5">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="section-title">Membership plans</h2>
            <p className="text-xs text-muted">Manage active plans and pricing structures for your gym</p>
          </div>
          <button onClick={openAdd} className="btn-primary">
            <Plus size={15} aria-hidden="true" />
            Add plan
          </button>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Duration</th>
                <th>Price</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && <SkeletonTable rows={4} cols={5} />}
              {!isLoading && plans?.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium text-foreground">{p.name}</td>
                  <td className="text-muted">{p.duration_days ? `${p.duration_days} days` : 'Custom'}</td>
                  <td className="font-medium text-foreground">{formatCurrency(p.default_price)}</td>
                  <td>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
                      p.is_active ? 'bg-success/10 text-success' : 'bg-muted/10 text-muted'
                    }`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${p.is_active ? 'bg-success' : 'bg-muted'}`} />
                      {p.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => openEdit(p)}
                        className="rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-surface"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() =>
                          setActive.mutate(
                            { id: p.id, isActive: !p.is_active },
                            {
                              onSuccess: () =>
                                toast.success(p.is_active ? 'Plan deactivated' : 'Plan reactivated'),
                              onError: (err) =>
                                toast.error(err instanceof Error ? err.message : 'Failed to update plan'),
                            }
                          )
                        }
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

          {!isLoading && plans?.length === 0 && (
            <EmptyState
              icon={<Layers size={32} />}
              title="No plans yet — add your first plan"
              description="Define membership tiers and default prices to start registering members."
              action={
                <button onClick={openAdd} className="btn-primary">
                  <Plus size={15} aria-hidden="true" />
                  Add plan
                </button>
              }
            />
          )}
        </div>
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
  gymId?: string
  editingPlan: Plan | null
}) {
  const [name, setName] = useState(editingPlan?.name ?? '')
  const [durationDays, setDurationDays] = useState<string>(
    editingPlan?.duration_days != null ? String(editingPlan.duration_days) : '30',
  )
  const [defaultPrice, setDefaultPrice] = useState(
    editingPlan ? String(editingPlan.default_price) : '',
  )
  const [error, setError] = useState<string | null>(null)

  const createPlan = useCreatePlan(gymId)
  const updatePlan = useUpdatePlan()
  const isEditing = !!editingPlan
  const toast = useToast()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const price = Number(defaultPrice)
    const days = durationDays === '' ? null : Number(durationDays)
    if (isNaN(price) || price < 0) {
      setError('Price must be a non-negative number')
      return
    }
    try {
      if (isEditing) {
        await updatePlan.mutateAsync({
          id: editingPlan.id,
          name,
          durationDays: days,
          defaultPrice: price,
        })
        toast.success('Plan updated successfully')
      } else {
        if (!gymId) {
          setError('Gym not loaded')
          return
        }
        await createPlan.mutateAsync({
          name,
          durationDays: days,
          defaultPrice: price,
        })
        toast.success('Plan created successfully')
      }
      onClose()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg)
      toast.error(msg)
    }
  }

  const isPending = createPlan.isPending || updatePlan.isPending

  return (
    <Modal open={open} onClose={onClose} title={isEditing ? 'Edit plan' : 'Add plan'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Plan name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Duration (days)</label>
          <input
            type="number"
            min={1}
            value={durationDays}
            onChange={(e) => setDurationDays(e.target.value)}
            placeholder="Leave empty for custom"
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Default price</label>
          <input
            type="number"
            required
            min={0}
            step="0.01"
            value={defaultPrice}
            onChange={(e) => setDefaultPrice(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {isPending ? <Spinner size={14} label="Saving..." /> : isEditing ? 'Save changes' : 'Create plan'}
        </button>
      </form>
    </Modal>
  )
}
