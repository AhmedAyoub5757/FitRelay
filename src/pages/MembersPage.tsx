import { useState } from "react";
import { useMembers } from "../features/members/queries";
import { MemberFormModal } from "../features/members/MemberFormModal";
import { StatusBadge } from "../components/StatusBadge";
import { Link } from "react-router-dom";
const statusOptions = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "upcoming", label: "Upcoming" },
  { value: "frozen", label: "Frozen" },
  { value: "expired", label: "Expired" },
  { value: "no_membership", label: "No membership" },
];

export default function MembersPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [modalOpen, setModalOpen] = useState(false);

  const { data: members, isLoading, error } = useMembers(search, statusFilter);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="font-display text-3xl tracking-wide">Members</h1>
        <button
          onClick={() => setModalOpen(true)}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-white"
        >
          Add member
        </button>
      </div>

      <div className="mb-4 flex gap-3">
        <input
          placeholder="Search by name or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-64 rounded border border-border bg-background px-3 py-2 text-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded border border-border bg-background px-3 py-2 text-sm"
        >
          {statusOptions.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading members...</p>}
      {error && <p className="text-sm text-danger">Couldn't load members.</p>}
      {!isLoading && !error && members?.length === 0 && (
        <p className="text-sm text-muted">No members match this view yet.</p>
      )}

      {!isLoading && members && members.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Phone</th>
              <th className="py-2 pr-4 font-medium">Status</th>
              <th className="py-2 pr-4 font-medium">Joined</th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-b border-border">
                {/* <td className="py-2 pr-4">{m.full_name}</td> */}
                <td className="py-2 pr-4">
                  <Link to={`/app/members/${m.id}`} className="hover:underline">
                    {m.full_name}
                  </Link>
                </td>
                <td className="py-2 pr-4">{m.phone}</td>
                <td className="py-2 pr-4">
                  <StatusBadge status={m.status} />
                </td>
                <td className="py-2 pr-4 text-muted">{m.joining_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <MemberFormModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </div>
  );
}
