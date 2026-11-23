import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export interface ReportFilters {
  fromDate: string
  toDate: string
}

export function useReportPayments(filters: ReportFilters) {
  return useQuery({
    queryKey: ['reportPayments', filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('*, member:members(id, full_name)')
        .gte('created_at', `${filters.fromDate}T00:00:00`)
        .lte('created_at', `${filters.toDate}T23:59:59`)
        .order('created_at', { ascending: false })
      if (error) throw error
      return data
    },
  })
}