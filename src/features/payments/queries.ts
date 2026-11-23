import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export interface PaymentFilters {
  search: string
  fromDate: string
  toDate: string
}

export function useGymPayments(filters: PaymentFilters) {
  return useQuery({
    queryKey: ['gymPayments', filters],
    queryFn: async () => {
      let query = supabase
        .from('payments')
        .select('*, member:members!inner(id, full_name)')
        .gte('created_at', `${filters.fromDate}T00:00:00`)
        .lte('created_at', `${filters.toDate}T23:59:59`)
        .order('created_at', { ascending: false })
        .limit(200)

      if (filters.search.trim()) {
        query = query.ilike('member.full_name', `%${filters.search.trim()}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useRecordGymPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { memberId: string; amount: number; method: string }) => {
      const { error } = await supabase.rpc('create_payment', {
        p_member_id: input.memberId,
        p_amount: input.amount,
        p_payment_method: input.method,
        p_allocations: null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gymPayments'] })
      queryClient.invalidateQueries({ queryKey: ['members'] })
    },
  })
}