import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TableRow, ViewRow } from '../types/db'

// Typed from database.types.ts
export type AuditLogRow = TableRow<'audit_log'>
export type PendingRequestRow = ViewRow<'pending_requests'>
export type OverdueBorrowRow = ViewRow<'overdue_borrows'>

export function useAuditLog() {
  return useQuery<AuditLogRow[]>({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100)
        .returns<AuditLogRow[]>()
      if (error) throw error
      return (data ?? []) as AuditLogRow[]
    },
  })
}

export function usePendingRequests() {
  return useQuery<PendingRequestRow[]>({
    queryKey: ['pending_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_requests')
        .select('*')
        .order('requested_at', { ascending: true })
        .returns<PendingRequestRow[]>()
      if (error) throw error
      return (data ?? []) as PendingRequestRow[]
    },
  })
}

export function useOverdueBooks() {
  return useQuery<OverdueBorrowRow[]>({
    queryKey: ['overdueBooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('overdue_borrows')
        .select('*')
        .returns<OverdueBorrowRow[]>()
      if (error) throw error
      return (data ?? []) as OverdueBorrowRow[]
    },
  })
}
