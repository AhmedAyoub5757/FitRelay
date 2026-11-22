
import { useState, useMemo, type FormEvent } from 'react'
import { Modal } from '../../components/Modal'
import { normalizePhone } from '../../lib/phone'
import { useMembershipPlans, useDuplicateCheck, useRegisterMember } from './queries'

export function MemberFormModal({
  open,
  onClose,
}: {
  open: boolean
  onClose: () => void
}) {
  const [fullName, setFullName] = useState('')
  const [phoneInput, setPhoneInput] = useState('')
  const [emergencyName, setEmergencyName] = useState('')
  const [emergencyPhone, setEmergencyPhone] = useState('')
  const [planId, setPlanId] = useState('')
  const [durationDays, setDurationDays] = useState(30)
  const [grossAmount, setGrossAmount] = useState(0)
  const [discountAmount, setDiscountAmount] = useState(0)
  const [initialPayment, setInitialPayment] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [error, setError] = useState<string | null>(null)

  const { data: plans } = useMembershipPlans()
  const registerMember = useRegisterMember()

  const phoneResult = useMemo(
    () => normalizePhone(phoneInput),
    [phoneInput],
  )

  const { data: duplicates } = useDuplicateCheck(phoneResult.normalized)

  function handlePlanChange(id: string) {
    setPlanId(id)

    const plan = plans?.find((p) => p.id === id)

    if (plan) {
      if (plan.duration_days) setDurationDays(plan.duration_days)
      setGrossAmount(Number(plan.default_price))
    }
  }

  function resetForm() {
    setFullName('')
    setPhoneInput('')
    setEmergencyName('')
    setEmergencyPhone('')
    setPlanId('')
    setDurationDays(30)
    setGrossAmount(0)
    setDiscountAmount(0)
    setInitialPayment('')
    setPaymentMethod('cash')
    setError(null)
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    if (!fullName.trim()) {
      setError('Full name is required')
      return
    }

    if (!phoneResult.valid || !phoneResult.normalized) {
      setError('Enter a valid phone number')
      return
    }

    if (durationDays < 1) {
      setError('Membership duration must be at least 1 day')
      return
    }

    if (grossAmount < 0 || discountAmount < 0) {
      setError('Amounts cannot be negative')
      return
    }

    if (discountAmount > grossAmount) {
      setError('Discount cannot exceed the membership price')
      return
    }

    const netAmount = grossAmount - discountAmount

    if (initialPayment && Number(initialPayment) > netAmount) {
      setError('Initial payment cannot exceed the amount due')
      return
    }

    if (initialPayment && Number(initialPayment) < 0) {
      setError('Initial payment cannot be negative')
      return
    }

    try {
      const today = new Date().toLocaleDateString('en-CA')

      await registerMember.mutateAsync({
        full_name: fullName.trim(),
        phone: phoneInput.trim(),
        phone_normalized: phoneResult.normalized,
        emergency_contact_name: emergencyName.trim() || null,
        emergency_contact_phone: emergencyPhone.trim() || null,
        joining_date: today,
        plan_id: planId || null,
        plan_name_snapshot:
          plans?.find((p) => p.id === planId)?.name ?? 'Custom',
        duration_days: durationDays,
        start_date: today,
        gross_amount: grossAmount,
        discount_amount: discountAmount,
        initial_payment_amount:
          initialPayment !== '' ? Number(initialPayment) : null,
        initial_payment_method:
          initialPayment !== '' ? paymentMethod : null,
      })

      resetForm()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    }
  }

  const activeDuplicates = duplicates?.filter((d) => !d.is_deleted) ?? []
  const deletedDuplicates = duplicates?.filter((d) => d.is_deleted) ?? []

  const netAmount = grossAmount - discountAmount

  const inputClass = 'member-input'
  const labelClass = 'member-label'

  return (
    <Modal open={open} onClose={onClose} title="Add member">
      <form onSubmit={handleSubmit} className="member-form">

        {/* Member information */}
        <div className="member-form__section">
          <div className="member-form__section-heading">
            <span className="member-form__section-number">01</span>
            <span>PERSONAL INFORMATION</span>
          </div>

          <div className="member-form__grid">
            <div className="member-field member-field--full">
              <label className={labelClass}>Full name *</label>
              <input
                required
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Ahmed Ali"
                className={inputClass}
              />
            </div>

            <div className="member-field member-field--full">
              <label className={labelClass}>Phone number *</label>
              <input
                required
                value={phoneInput}
                onChange={(e) => setPhoneInput(e.target.value)}
                placeholder="0300 1234567"
                className={inputClass}
              />

              {phoneInput && !phoneResult.valid && (
                <p className="member-field__hint member-field__hint--error">
                  Enter a valid Pakistani phone number.
                </p>
              )}

              {activeDuplicates.length > 0 && (
                <div className="member-warning">
                  <span className="member-warning__icon">!</span>
                  <p>
                    This number already belongs to{' '}
                    <strong>
                      {activeDuplicates.map((d) => d.full_name).join(', ')}
                    </strong>
                    . You can still continue if this is intentional.
                  </p>
                </div>
              )}

              {deletedDuplicates.length > 0 && (
                <p className="member-field__hint">
                  Previously deleted record found:{' '}
                  {deletedDuplicates.map((d) => d.full_name).join(', ')}
                </p>
              )}
            </div>

            <div className="member-field">
              <label className={labelClass}>Emergency contact</label>
              <input
                value={emergencyName}
                onChange={(e) => setEmergencyName(e.target.value)}
                placeholder="Contact name"
                className={inputClass}
              />
            </div>

            <div className="member-field">
              <label className={labelClass}>Emergency phone</label>
              <input
                value={emergencyPhone}
                onChange={(e) => setEmergencyPhone(e.target.value)}
                placeholder="Phone number"
                className={inputClass}
              />
            </div>
          </div>
        </div>

        {/* Membership details */}
        <div className="member-form__section">
          <div className="member-form__section-heading">
            <span className="member-form__section-number">02</span>
            <span>MEMBERSHIP DETAILS</span>
          </div>

          <div className="member-form__grid">
            <div className="member-field member-field--full">
              <label className={labelClass}>Membership plan</label>
              <select
                value={planId}
                onChange={(e) => handlePlanChange(e.target.value)}
                className={inputClass}
              >
                <option value="">Custom membership</option>
                {plans?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="member-field">
              <label className={labelClass}>Duration (days) *</label>
              <input
                type="number"
                required
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="member-field">
              <label className={labelClass}>Price *</label>
              <input
                type="number"
                required
                min={0}
                value={grossAmount}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="member-field">
              <label className={labelClass}>Discount</label>
              <input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className={inputClass}
              />
            </div>

            <div className="member-field">
              <label className={labelClass}>Initial payment</label>
              <input
                type="number"
                min={0}
                max={netAmount}
                value={initialPayment}
                onChange={(e) => setInitialPayment(e.target.value)}
                placeholder="0 = unpaid"
                className={inputClass}
              />
            </div>
          </div>

          {initialPayment !== '' && Number(initialPayment) > 0 && (
            <div className="member-field member-field--payment-method">
              <label className={labelClass}>Payment method</label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className={inputClass}
              >
                <option value="cash">Cash</option>
                <option value="bank_transfer">Bank transfer</option>
                <option value="card">Card</option>
                <option value="other">Other</option>
              </select>
            </div>
          )}

          <div className="member-summary">
            <div>
              <span>Net membership fee</span>
              <strong>Rs. {netAmount.toLocaleString()}</strong>
            </div>
            <div>
              <span>Initial payment</span>
              <strong>Rs. {(Number(initialPayment) || 0).toLocaleString()}</strong>
            </div>
            <div>
              <span>Remaining balance</span>
              <strong className="member-summary__balance">
                Rs. {(netAmount - (Number(initialPayment) || 0)).toLocaleString()}
              </strong>
            </div>
          </div>
        </div>

        {error && (
          <div className="member-form__error">
            <span>!</span>
            {error}
          </div>
        )}

        {/* Actions */}
        <div className="member-form__footer">
          <button
            type="button"
            onClick={onClose}
            className="member-form__cancel"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={registerMember.isPending}
            className="member-form__submit"
          >
            {registerMember.isPending ? (
              <>
                <span className="member-form__spinner" />
                Creating member...
              </>
            ) : (
              <>
                Create member
                <span>↗</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  )
}
