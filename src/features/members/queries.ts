import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'

export interface MemberRow {
  id: string
  full_name: string
  phone: string
  phone_normalized: string
  joining_date: string
  status: string
}

export function useMembers(search: string, statusFilter: string) {
  const { appUser } = useAuth()

  return useQuery({
    queryKey: ['members', appUser?.gym_id, search, statusFilter],
    enabled: !!appUser,
    queryFn: async (): Promise<MemberRow[]> => {
      let query = supabase
        .from('members')
        .select('id, full_name, phone, phone_normalized, joining_date')
        .eq('is_deleted', false)
        .order('full_name', { ascending: true })

      if (search) {
        query = query.or(`full_name.ilike.%${search}%,phone.ilike.%${search}%`)
      }

      const { data: members, error } = await query
      if (error) throw error

      const { data: statuses, error: statusError } = await supabase
        .from('member_status')
        .select('member_id, status')
      if (statusError) throw statusError

      const statusMap = new Map(statuses.map((s) => [s.member_id, s.status]))
      const rows = members.map((m) => ({ ...m, status: statusMap.get(m.id) ?? 'no_membership' }))

      return statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter)
    },
  })
}

export function useMembershipPlans() {
  const { appUser } = useAuth()
  return useQuery({
    queryKey: ['membershipPlans', appUser?.gym_id],
    enabled: !!appUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('id, name, duration_days, default_price')
        .eq('is_active', true)
        .order('name')
      if (error) throw error
      return data
    },
  })
}

export function useDuplicateCheck(phoneNormalized: string | null) {
  return useQuery({
    queryKey: ['duplicateCheck', phoneNormalized],
    enabled: !!phoneNormalized,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('members')
        .select('id, full_name, is_deleted')
        .eq('phone_normalized', phoneNormalized!)
      if (error) throw error
      return data
    },
  })
}

interface RegisterMemberInput {
  full_name: string
  phone: string
  phone_normalized: string
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  joining_date: string
  plan_id: string | null
  plan_name_snapshot: string
  duration_days: number
  start_date: string
  gross_amount: number
  discount_amount: number
  initial_payment_amount: number | null
  initial_payment_method: string | null
}

export function useRegisterMember() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: RegisterMemberInput) => {
      const { data, error } = await supabase.rpc('register_member_with_membership', {
        p_full_name: input.full_name,
        p_phone: input.phone,
        p_phone_normalized: input.phone_normalized,
        p_emergency_contact_name: input.emergency_contact_name,
        p_emergency_contact_phone: input.emergency_contact_phone,
        p_joining_date: input.joining_date,
        p_plan_id: input.plan_id,
        p_plan_name_snapshot: input.plan_name_snapshot,
        p_duration_days: input.duration_days,
        p_start_date: input.start_date,
        p_gross_amount: input.gross_amount,
        p_discount_amount: input.discount_amount,
        p_initial_payment_amount: input.initial_payment_amount,
        p_initial_payment_method: input.initial_payment_method,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}