import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabaseClient'

interface AppUser {
  id: string
  gym_id: string
  role: string
  full_name: string | null
}

interface AuthContextValue {
  session: Session | null
  appUser: AppUser | null
  isLoading: boolean
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const queryClient = useQueryClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setSessionLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      queryClient.invalidateQueries({ queryKey: ['appUser'] })
    })

    return () => listener.subscription.unsubscribe()
  }, [queryClient])

  const { data: appUser, isLoading: appUserLoading } = useQuery({
    queryKey: ['appUser', session?.user.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('app_users')
        .select('id, gym_id, role, full_name')
        .eq('id', session!.user.id)
        .maybeSingle()
      if (error) throw error
      return data as AppUser | null
    },
    enabled: !!session,
  })

  async function signOut() {
    await supabase.auth.signOut()
  }

  const isLoading = sessionLoading || (!!session && appUserLoading)

  return (
    <AuthContext.Provider value={{ session, appUser: appUser ?? null, isLoading, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}