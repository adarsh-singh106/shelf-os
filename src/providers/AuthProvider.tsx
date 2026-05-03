import { useEffect, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { ensureUserProfile } from '../lib/profile'
import { AuthContext } from '../contexts/AuthContext'
import type { User } from '@supabase/supabase-js'
import type { TableRow } from '../types/db'

type Profile = TableRow<'users'>

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const queryClient = useQueryClient()

  const { data: profile, isLoading: profileLoading, refetch: refreshProfile } = useQuery<Profile | null>({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null
      await ensureUserProfile(user)
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single()
        .returns<Profile>()
      
      if (error) {
        console.error('Error fetching profile:', error)
        return null
      }
      return data
    },
    enabled: !!user?.id,
  })

  useEffect(() => {
    // Initial session check
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
      setSessionLoading(false)
    })

    // Listen for auth changes
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null)
      if (event === 'SIGNED_IN') {
        setSessionLoading(false)
      }
      if (event === 'SIGNED_OUT') {
        queryClient.setQueryData(['profile', null], null)
        setSessionLoading(false)
      }
    })

    return () => listener?.subscription.unsubscribe()
  }, [queryClient])

  const signOut = async () => {
    await supabase.auth.signOut()
    setUser(null)
    queryClient.invalidateQueries({ queryKey: ['profile'] })
  }

  const isLoading = sessionLoading || (!!user && profileLoading)

  const value = {
    user,
    profile: profile ?? null,
    loading: isLoading,
    isAdmin: profile?.role === 'admin',
    isLoading,
    signOut,
    refreshProfile: async (userId?: string) => {
      if (userId && userId !== user?.id) {
        // Handle explicit refresh for another user if needed, but usually it's for current user
      }
      await refreshProfile()
    },
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
