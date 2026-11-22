import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export function useMember(memberId: string) {
  return useQuery({
    queryKey: ['member', memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from('members').select('*').eq('id', memberId).single()
      if (error) throw error
      return data
    },
  })
}

export function useMemberStatus(memberId: string) {
  return useQuery({
    queryKey: ['memberStatus', memberId],
    queryFn: async () => {
      const { data, error } = await supabase.from('member_status').select('status').eq('member_id', memberId).maybeSingle()
      if (error) throw error
      return data?.status ?? 'no_membership'
    },
  })
}

export function useMemberships(memberId: string) {
  return useQuery({
    queryKey: ['memberships', memberId],
    queryFn: async () => {
      const { data: memberships, error } = await supabase
        .from('memberships')
        .select('*')
        .eq('member_id', memberId)
        .order('start_date', { ascending: false })
      if (error) throw error

      const { data: statuses, error: statusErr } = await supabase
        .from('membership_status')
        .select('membership_id, status')
        .eq('member_id', memberId)
      if (statusErr) throw statusErr

      const { data: freezes, error: freezeErr } = await supabase
        .from('membership_freezes')
        .select('*')
        .in('membership_id', memberships.map((m) => m.id))
        .is('end_date', null)
      if (freezeErr) throw freezeErr

      const statusMap = new Map(statuses.map((s) => [s.membership_id, s.status]))
      const freezeMap = new Map(freezes.map((f) => [f.membership_id, f]))

      return memberships.map((m) => ({
        ...m,
        status: statusMap.get(m.id) ?? 'unknown',
        activeFreeze: freezeMap.get(m.id) ?? null,
      }))
    },
  })
}

export function useCharges(memberId: string) {
  return useQuery({
    queryKey: ['charges', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('charges')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
      if (error) throw error

      return Promise.all(
        data.map(async (c) => {
          const { data: outstanding, error: outErr } = await supabase.rpc('charge_outstanding', { p_charge_id: c.id })
          if (outErr) throw outErr
          return { ...c, outstanding: Number(outstanding) }
        }),
      )
    },
  })
}

export function usePayments(memberId: string) {
  return useQuery({
    queryKey: ['payments', memberId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('member_id', memberId)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}

export function useCreditBalance(memberId: string) {
  return useQuery({
    queryKey: ['creditBalance', memberId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('member_credit_balance', { p_member_id: memberId })
      if (error) throw error
      return Number(data)
    },
  })
}

function useInvalidateMemberDetail(memberId: string) {
  const queryClient = useQueryClient()
  return () => {
    queryClient.invalidateQueries({ queryKey: ['memberStatus', memberId] })
    queryClient.invalidateQueries({ queryKey: ['memberships', memberId] })
    queryClient.invalidateQueries({ queryKey: ['charges', memberId] })
    queryClient.invalidateQueries({ queryKey: ['payments', memberId] })
    queryClient.invalidateQueries({ queryKey: ['creditBalance', memberId] })
    queryClient.invalidateQueries({ queryKey: ['members'] })
  }
}

export function useRecordPayment(memberId: string) {
  const invalidate = useInvalidateMemberDetail(memberId)
  return useMutation({
    mutationFn: async (input: { amount: number; method: string }) => {
      const { error } = await supabase.rpc('create_payment', {
        p_member_id: memberId,
        p_amount: input.amount,
        p_payment_method: input.method,
        p_allocations: null,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useFreezeMembership(memberId: string) {
  const invalidate = useInvalidateMemberDetail(memberId)
  return useMutation({
    mutationFn: async (input: { membershipId: string; startDate: string }) => {
      const { error } = await supabase.rpc('create_freeze', {
        p_membership_id: input.membershipId,
        p_start_date: input.startDate,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

export function useUnfreezeMembership(memberId: string) {
  const invalidate = useInvalidateMemberDetail(memberId)
  return useMutation({
    mutationFn: async (input: { freezeId: string; endDate: string }) => {
      const { error } = await supabase.rpc('unfreeze', { p_freeze_id: input.freezeId, p_end_date: input.endDate })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}

interface RenewInput {
  membershipId: string
  planId: string | null
  planName: string
  durationDays: number
  grossAmount: number
  discountAmount: number
}

export function useRenewMembership(memberId: string) {
  const invalidate = useInvalidateMemberDetail(memberId)
  return useMutation({
    mutationFn: async (input: RenewInput) => {
      const { error } = await supabase.rpc('renew_membership', {
        p_membership_id: input.membershipId,
        p_plan_id: input.planId,
        p_plan_name_snapshot: input.planName,
        p_duration_days: input.durationDays,
        p_gross_amount: input.grossAmount,
        p_discount_amount: input.discountAmount,
      })
      if (error) throw error
    },
    onSuccess: invalidate,
  })
}