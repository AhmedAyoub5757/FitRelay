import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}
function daysFromToday(offset: number) {
  const d = new Date()
  d.setDate(d.getDate() + offset)
  return d.toISOString().slice(0, 10)
}

export function useMemberStatusCounts() {
  return useQuery({
    queryKey: ['dashboard', 'memberStatusCounts'],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_status').select('status')
      if (error) throw error
      const counts: Record<string, number> = {}
      for (const row of data) {
        if (row.status) counts[row.status] = (counts[row.status] ?? 0) + 1
      }
      return counts
    },
  })
}

export function useGymOutstandingTotal() {
  return useQuery({
    queryKey: ['dashboard', 'outstandingTotal'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('gym_outstanding_total')
      if (error) throw error
      return Number(data)
    },
  })
}

export function useTodaysCollections() {
  return useQuery({
    queryKey: ['dashboard', 'todaysCollections'],
    queryFn: async () => {
      const today = todayISO()
      const { data, error } = await supabase
        .from('payments')
        .select('amount, entry_type')
        .gte('created_at', `${today}T00:00:00`)
        .lte('created_at', `${today}T23:59:59`)
      if (error) throw error
      return data.reduce((sum, p) => sum + (p.entry_type === 'refund' ? -Number(p.amount) : Number(p.amount)), 0)
    },
  })
}

export function usePendingReminderCount() {
  return useQuery({
    queryKey: ['dashboard', 'pendingReminders'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('reminders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useExpiringSoon() {
  return useQuery({
    queryKey: ['dashboard', 'expiringSoon'],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('id, end_date, plan_name_snapshot, member:members(id, full_name)')
        .gte('end_date', todayISO())
        .lte('end_date', daysFromToday(7))
        .order('end_date', { ascending: true })
      if (error) throw error
      if (memberships.length === 0) return []

      const { data: statuses, error: statusErr } = await supabase
        .from('membership_status')
        .select('membership_id, status')
        .in('membership_id', memberships.map((m) => m.id))
      if (statusErr) throw statusErr

      const statusMap = new Map(statuses.map((s) => [s.membership_id, s.status]))
      return memberships.filter((m) => statusMap.get(m.id) === 'active')
    },
  })
}