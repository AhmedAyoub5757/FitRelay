import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export type ReminderStatusFilter = 'pending' | 'owner_confirmed_sent' | 'resolved' | 'all'

export function useReminders(status: ReminderStatusFilter) {
  return useQuery({
    queryKey: ['reminders', status],
    queryFn: async () => {
      let query = supabase
        .from('reminders')
        .select('*, member:members(id, full_name, phone_normalized)')
        .order('scheduled_for', { ascending: true })
        .limit(200)

      if (status !== 'all') {
        query = query.eq('status', status)
      }

      const { data, error } = await query
      if (error) throw error
      return data
    },
  })
}

export function useMarkReminderSent() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (reminderId: string) => {
      const { error } = await supabase.rpc('mark_reminder_sent', { p_reminder_id: reminderId })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reminders'] })
    },
  })
}