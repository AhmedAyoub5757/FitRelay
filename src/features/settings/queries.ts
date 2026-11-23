import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabaseClient'

export function useCurrentGymId() {
  return useQuery({
    queryKey: ['currentGymId'],
    queryFn: async () => {
      const { data: auth, error: authErr } = await supabase.auth.getUser()
      if (authErr) throw authErr
      const { data, error } = await supabase
        .from('app_users')
        .select('gym_id')
        .eq('id', auth.user!.id)
        .single()
      if (error) throw error
      return data.gym_id as string
    },
    staleTime: Infinity,
  })
}

export function useMembershipPlansAll() {
  return useQuery({
    queryKey: ['membershipPlansAll'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_plans')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
  })
}

interface PlanInput {
  name: string
  durationDays: number | null
  defaultPrice: number
}

export function useCreatePlan(gymId: string | undefined) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: PlanInput) => {
      if (!gymId) throw new Error('Gym not resolved yet')
      const { error } = await supabase.from('membership_plans').insert({
        gym_id: gymId,
        name: input.name,
        duration_days: input.durationDays,
        default_price: input.defaultPrice,
      })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlansAll'] })
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
    },
  })
}

export function useUpdatePlan() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string } & PlanInput) => {
      const { error } = await supabase
        .from('membership_plans')
        .update({ name: input.name, duration_days: input.durationDays, default_price: input.defaultPrice })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlansAll'] })
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
    },
  })
}

export function useSetPlanActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (input: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('membership_plans')
        .update({ is_active: input.isActive })
        .eq('id', input.id)
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['membershipPlansAll'] })
      queryClient.invalidateQueries({ queryKey: ['membershipPlans'] })
    },
  })
}