import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface AuditLogEntry {
  id: number
  table_name: string
  action: 'INSERT' | 'UPDATE' | 'DELETE' | 'NOTIFY'
  row_id: number
  changed_by: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  changed_at: string
}

interface PendingRequest {
  id: number
  user_id: string
  book_id: number
  username: string
  book_title: string
  requested_at: string
}

interface OverdueBook {
  user_id: string
  book_id: number
  username: string
  book_title: string
  due_date: string
}

export function useAuditLog() {
  return useQuery({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100)
      if (error) throw error
      return (data ?? []) as AuditLogEntry[]
    },
  })
}

export function usePendingRequests() {
  return useQuery({
    queryKey: ['pendingRequests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_requests')
        .select('*')
        .order('requested_at', { ascending: true })
      if (error) throw error
      return (data ?? []) as PendingRequest[]
    },
  })
}

export function useOverdueBooks() {
  return useQuery({
    queryKey: ['overdueBooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overdue_borrows')
        .select('*')
      if (error) throw error
      return (data ?? []) as OverdueBook[]
    },
  })
}
