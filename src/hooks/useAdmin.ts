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

export function useLibraryStats() {
  return useQuery({
    queryKey: ['libraryStats'],
    queryFn: async () => {
      const [booksCount, usersCount, activeBorrows, overdueCount] = await Promise.all([
        supabase.from('books').select('*', { count: 'exact', head: true }),
        supabase.from('users').select('*', { count: 'exact', head: true }),
        supabase.from('borrow_history').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('overdue_borrows').select('*', { count: 'exact', head: true })
      ])

      return {
        totalBooks: booksCount.count ?? 0,
        totalMembers: usersCount.count ?? 0,
        activeBorrows: activeBorrows.count ?? 0,
        overdueCount: overdueCount.count ?? 0,
      }
    }
  })
}

export function useGenreStats() {
  return useQuery({
    queryKey: ['genreStats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('genre_stats')
        .select('*')
        .order('book_count', { ascending: false })
      if (error) throw error
      return data || []
    }
  })
}
