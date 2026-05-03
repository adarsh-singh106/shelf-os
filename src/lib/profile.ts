import type { User } from '@supabase/supabase-js'
import { supabase } from './supabase'
import type { TableInsert, TableRow } from '../types/db'

type Profile = TableRow<'users'>

export function deriveUsername(user: Pick<User, 'email' | 'user_metadata'>) {
  const metadataName = user.user_metadata?.name
  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim()
  }

  return user.email?.split('@')[0]?.trim() || 'member'
}

export async function ensureUserProfile(user: User) {
  const { data: existing, error: lookupError } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .maybeSingle()
    .returns<Profile>()

  if (lookupError) {
    throw lookupError
  }

  if (existing) {
    return existing
  }

  const profileInsert = {
    id: user.id,
    email: user.email ?? `${user.id}@unknown.local`,
    username: deriveUsername(user),
    role: 'member',
    preferences: { onboarded: false },
    avatar_url:
      typeof user.user_metadata?.avatar_url === 'string'
        ? user.user_metadata.avatar_url
        : null,
  } satisfies TableInsert<'users'>

  const { data, error } = await supabase
    .from('users')
    .upsert(profileInsert, { onConflict: 'id' })
    .select('*')
    .single()
    .returns<Profile>()

  if (error) {
    throw error
  }

  return data
}
