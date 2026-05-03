import { createContext } from 'react'
import type { User } from '@supabase/supabase-js'
import type { TableRow } from '../types/db'

type Profile = TableRow<'users'>

export type AuthContextType = {
  user: User | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  isLoading: boolean
  signOut: () => Promise<void>
  refreshProfile: (userId?: string) => Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)
