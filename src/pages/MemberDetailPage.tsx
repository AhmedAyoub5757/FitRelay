import { useState, type FormEvent } from "react";
import { useParams, Link } from "react-router-dom";
import { Modal } from "../components/Modal";
import { StatusBadge } from "../components/StatusBadge";
import { useMembershipPlans } from "../features/members/queries";
import {
  useMember,
  useMemberStatus,
  useMemberships,
  useCharges,
  usePayments,
  useCreditBalance,
  useRecordPayment,
  useFreezeMembership,
  useUnfreezeMembership,
  useRenewMembership,
} from "../features/members/detailQueries";
import { SkeletonDetailHeader, SkeletonCard, SkeletonTable, SkeletonModalBody } from "../components/Skeleton";
import { EmptyState } from "../components/EmptyState";
import { useToast } from "../context/ToastContext";
import { formatCurrency } from "../lib/formatCurrency";
import { formatDate } from "../lib/formatDate";
import { Spinner } from "../components/Spinner";
import { ArrowLeft, CreditCard, Calendar } from "lucide-react";

export default function MemberDetailPage() {
  const { memberId } = useParams<{ memberId: string }>();
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [freezeModalOpen, setFreezeModalOpen] = useState(false);
  const [unfreezeModalOpen, setUnfreezeModalOpen] = useState(false);
  const [renewModalOpen, setRenewModalOpen] = useState(false);

  const { data: member, isLoading: memberLoading } = useMember(memberId!);
  const { data: status } = useMemberStatus(memberId!);
  const { data: memberships, isLoading: membershipsLoading } = useMemberships(
    memberId!,
  );
  const { data: charges } = useCharges(memberId!);
  const { data: payments } = usePayments(memberId!);
  const { data: credit } = useCreditBalance(memberId!);

  if (!memberId) return null;

  if (memberLoading || membershipsLoading) {
    return (
      <div className="page-container space-y-6">
        <Link
          to="/app/members"
          className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
          Back to members
        </Link>
        <SkeletonDetailHeader />
        <div className="grid grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              <SkeletonTable rows={3} cols={4} />
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (!member) return <p className="text-sm text-danger">Member not found.</p>;

  const latest = memberships?.[0] ?? null;
  const totalOutstanding = (charges ?? []).reduce(
    (sum, c) => sum + c.outstanding,
    0,
  );

  return (
    <div className="page-container space-y-6">
      <Link
        to="/app/members"
        className="group inline-flex items-center gap-1.5 text-sm font-medium text-muted transition-colors duration-150 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 ease-out group-hover:-translate-x-1" />
        Back to members
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="page-title">
            {member.full_name}
          </h1>
          <p className="mt-1 text-sm text-muted">{member.phone}</p>
          {member.emergency_contact_name && (
            <p className="text-sm text-muted">
              Emergency: {member.emergency_contact_name} (
              {member.emergency_contact_phone})
            </p>
          )}
        </div>
        {status && <StatusBadge status={status} />}
      </div>

      <div className="flex gap-6 rounded-xl border border-border bg-surface/30 p-4">
        <div>
          <p className="text-xs text-muted">Outstanding balance</p>
          <p
            className={`font-display text-2xl ${totalOutstanding > 0 ? "text-danger" : "text-success"}`}
          >
            {formatCurrency(totalOutstanding)}
          </p>
        </div>
        {credit != null && credit > 0 && (
          <div>
            <p className="text-xs text-muted">Available credit</p>
            <p className="font-display text-2xl text-accent">
              {formatCurrency(credit)}
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setPaymentModalOpen(true)}
          className="btn-primary"
        >
          Record payment
        </button>
        {latest?.status === "active" && (
          <button
            onClick={() => setFreezeModalOpen(true)}
            className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Freeze membership
          </button>
        )}
        {latest?.status === "frozen" && (
          <button
            onClick={() => setUnfreezeModalOpen(true)}
            className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Unfreeze membership
          </button>
        )}
        {latest && ["active", "frozen", "expired"].includes(latest.status) && (
          <button
            onClick={() => setRenewModalOpen(true)}
            className="rounded border border-border px-4 py-2 text-sm font-medium hover:bg-surface"
          >
            Renew
          </button>
        )}
      </div>

      <section>
        <h2 className="section-title mb-2">
          Membership history
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {memberships?.map((m) => (
                <tr key={m.id}>
                  <td className="font-medium text-foreground">{m.plan_name_snapshot}</td>
                  <td className="text-muted">{formatDate(m.start_date)}</td>
                  <td className="text-muted">{formatDate(m.end_date)}</td>
                  <td>
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {memberships?.length === 0 && (
            <EmptyState
              icon={<Calendar size={28} />}
              title="No memberships recorded"
              description="Renew or assign a membership to this member."
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="section-title mb-2">
          Payment history
        </h2>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method</th>
                <th>Receipt #</th>
              </tr>
            </thead>
            <tbody>
              {payments?.map((p) => (
                <tr key={p.id}>
                  <td className="text-muted">
                    {formatDate(p.created_at)}
                  </td>
                  <td>
                    {p.entry_type === "refund" ? "Refund" : "Payment"}
                  </td>
                  <td
                    className={p.entry_type === "refund" ? "text-danger font-medium" : "text-success font-medium"}
                  >
                    {p.entry_type === "refund" ? "-" : ""}
                    {formatCurrency(p.amount)}
                  </td>
                  <td className="text-muted capitalize">{p.payment_method?.replace('_', ' ')}</td>
                  <td className="text-muted">#{p.receipt_number}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {payments?.length === 0 && (
            <EmptyState
              icon={<CreditCard size={28} />}
              title="No payments recorded yet"
              description="Record a payment when the member settles their dues."
            />
          )}
        </div>
      </section>

      <RecordPaymentModal
        open={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        memberId={memberId}
      />
      {latest && (
        <FreezeModal
          open={freezeModalOpen}
          onClose={() => setFreezeModalOpen(false)}
          memberId={memberId}
          membershipId={latest.id}
        />
      )}
      {latest?.activeFreeze && (
        <UnfreezeModal
          open={unfreezeModalOpen}
          onClose={() => setUnfreezeModalOpen(false)}
          memberId={memberId}
          freezeId={latest.activeFreeze.id}
        />
      )}
      {latest && (
        <RenewModal
          open={renewModalOpen}
          onClose={() => setRenewModalOpen(false)}
          memberId={memberId}
          membershipId={latest.id}
        />
      )}
    </div>
  );
}

function RecordPaymentModal({
  open,
  onClose,
  memberId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
}) {
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("cash");
  const [error, setError] = useState<string | null>(null);
  const recordPayment = useRecordPayment(memberId);
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await recordPayment.mutateAsync({ amount: Number(amount), method });
      toast.success("Payment recorded successfully");
      setAmount("");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Record payment">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Amount</label>
          <input
            type="number"
            required
            min={0.01}
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Payment method</label>
          <select
            value={method}
            onChange={(e) => setMethod(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          >
            <option value="cash">Cash</option>
            <option value="bank_transfer">Bank transfer</option>
            <option value="card">Card</option>
            <option value="other">Other</option>
          </select>
        </div>
        <p className="text-xs text-muted">
          Applied automatically to the oldest outstanding charge first.
        </p>
        <button
          type="submit"
          disabled={recordPayment.isPending}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {recordPayment.isPending ? <Spinner size={14} label="Recording payment..." /> : "Record payment"}
        </button>
      </form>
    </Modal>
  );
}

function FreezeModal({
  open,
  onClose,
  memberId,
  membershipId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  membershipId: string;
}) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [error, setError] = useState<string | null>(null);
  const freeze = useFreezeMembership(memberId);
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await freeze.mutateAsync({ membershipId, startDate });
      toast.success("Membership frozen successfully");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Freeze membership">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Start date</label>
          <input
            type="date"
            required
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={freeze.isPending}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {freeze.isPending ? <Spinner size={14} label="Freezing..." /> : "Freeze"}
        </button>
      </form>
    </Modal>
  );
}

function UnfreezeModal({
  open,
  onClose,
  memberId,
  freezeId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  freezeId: string;
}) {
  const [endDate, setEndDate] = useState(new Date().toISOString().slice(0, 10));
  const [error, setError] = useState<string | null>(null);
  const unfreeze = useUnfreezeMembership(memberId);
  const toast = useToast();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await unfreeze.mutateAsync({ freezeId, endDate });
      toast.success("Membership reactivated successfully");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Unfreeze membership">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-danger">{error}</p>}
        <div>
          <label className="block text-sm font-medium">Active again from</label>
          <input
            type="date"
            required
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={unfreeze.isPending}
          className="btn-primary w-full justify-center disabled:opacity-50"
        >
          {unfreeze.isPending ? <Spinner size={14} label="Unfreezing..." /> : "Unfreeze"}
        </button>
      </form>
    </Modal>
  );
}

function RenewModal({
  open,
  onClose,
  memberId,
  membershipId,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  membershipId: string;
}) {
  const [planId, setPlanId] = useState("");
  const [durationDays, setDurationDays] = useState(30);
  const [grossAmount, setGrossAmount] = useState(0);
  const [discountAmount, setDiscountAmount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const { data: plans, isLoading: plansLoading } = useMembershipPlans();
  const renew = useRenewMembership(memberId);
  const toast = useToast();

  function handlePlanChange(id: string) {
    setPlanId(id);
    const plan = plans?.find((p) => p.id === id);
    if (plan) {
      if (plan.duration_days) setDurationDays(plan.duration_days);
      setGrossAmount(Number(plan.default_price));
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await renew.mutateAsync({
        membershipId,
        planId: planId || null,
        planName: plans?.find((p) => p.id === planId)?.name ?? "Custom",
        durationDays,
        grossAmount,
        discountAmount,
      });
      toast.success("Membership renewed successfully");
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      setError(msg);
      toast.error(msg);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Renew membership">
      {plansLoading ? (
        <SkeletonModalBody rows={3} />
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-sm text-danger">{error}</p>}
          <div>
            <label className="block text-sm font-medium">Plan</label>
            <select
              value={planId}
              onChange={(e) => handlePlanChange(e.target.value)}
              className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="">Custom</option>
              {plans?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm font-medium">Duration (days)</label>
              <input
                type="number"
                required
                min={1}
                value={durationDays}
                onChange={(e) => setDurationDays(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Price</label>
              <input
                type="number"
                required
                min={0}
                value={grossAmount}
                onChange={(e) => setGrossAmount(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium">Discount</label>
              <input
                type="number"
                min={0}
                value={discountAmount}
                onChange={(e) => setDiscountAmount(Number(e.target.value))}
                className="mt-1 w-full rounded border border-border bg-background px-3 py-2 text-sm"
              />
            </div>
          </div>
          <button
            type="submit"
            disabled={renew.isPending}
            className="btn-primary w-full justify-center disabled:opacity-50"
          >
            {renew.isPending ? <Spinner size={14} label="Renewing..." /> : "Renew"}
          </button>
        </form>
      )}
    </Modal>
  );
}
