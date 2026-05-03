import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { FunctionReturn, TableRow, ViewRow } from '../types/db'

type BorrowRow = TableRow<'borrow_history'>
type WaitlistRow = TableRow<'waitlist'>
type BookLookup = Pick<ViewRow<'book_details'>, 'id' | 'title' | 'cover_url'>

export type MyBorrowItem = {
  id: number
  bookId: number
  title: string
  coverUrl: string | null
  status: BorrowRow['status']
  requestedAt: string | null
  borrowedAt: string | null
  dueDate: string | null
  returnedAt: string | null
}

export type MyWaitlistItem = {
  id: number
  bookId: number
  title: string
  coverUrl: string | null
  position: number | null
  joinedAt: string | null
}

export function useMyBorrows(userId: string | null | undefined) {
  return useQuery<MyBorrowItem[]>({
    queryKey: ['shelf-active', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as MyBorrowItem[]

      const { data: borrows, error } = await supabase
        .from('borrow_history')
        .select('id, user_id, book_id, status, borrowed_at, due_date, returned_at, books(id, title, cover_url)')
        .eq('user_id', userId)
        .in('status', ['active', 'requested', 'overdue'])
        .order('id', { ascending: false })
        .returns<(BorrowRow & { books: BookLookup | null })[]>()

      if (error) throw error

      return (borrows ?? []).map((row) => ({
        id: row.id,
        bookId: row.book_id ?? 0,
        title: row.books?.title ?? `Book #${row.book_id ?? '?'}`,
        coverUrl: row.books?.cover_url ?? null,
        status: row.status,
        requestedAt: null,
        borrowedAt: row.borrowed_at,
        dueDate: row.due_date,
        returnedAt: row.returned_at,
      }))
    },
  })
}

export function useMyWaitlist(userId: string | null | undefined) {
  return useQuery<MyWaitlistItem[]>({
    queryKey: ['shelf-waitlist', userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      if (!userId) return [] as MyWaitlistItem[]

      const { data: waitlist, error } = await supabase
        .from('waitlist')
        .select('id, user_id, book_id, joined_at, books(id, title, cover_url)')
        .eq('user_id', userId)
        .order('joined_at', { ascending: true })
        .returns<(WaitlistRow & { books: BookLookup | null })[]>()

      if (error) throw error

      const items = await Promise.all(
        (waitlist ?? []).map(async (row) => {
          const { count } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true })
            .eq('book_id', row.book_id!)
            .lt('joined_at', row.joined_at!)

          return {
            id: row.id,
            bookId: row.book_id ?? 0,
            title: row.books?.title ?? `Book #${row.book_id ?? '?'}`,
            coverUrl: row.books?.cover_url ?? null,
            position: (count ?? 0) + 1,
            joinedAt: row.joined_at,
          }
        }),
      )

      return items
    },
  })
}

export function useRequestBorrow() {
  const qc = useQueryClient()
  return useMutation<FunctionReturn<'request_borrow'>, Error, { userId: string; bookId: number }>({
    mutationFn: async ({ userId, bookId }: { userId: string; bookId: number }) => {
      const { data, error } = await supabase.rpc('request_borrow', {
        p_user_id: userId,
        p_book_id: bookId,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['trending'] })
      qc.invalidateQueries({ queryKey: ['landing-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-books'] })
      qc.invalidateQueries({ queryKey: ['shelf-active', variables.userId] })
      qc.invalidateQueries({ queryKey: ['shelf-waitlist', variables.userId] })
      qc.invalidateQueries({ queryKey: ['pending_requests'] })
    },
  })
}

export function useConfirmBorrow() {
  const qc = useQueryClient()
  return useMutation<FunctionReturn<'confirm_borrow'>, Error, number>({
    mutationFn: async (borrowId: number) => {
      const { data, error } = await supabase.rpc('confirm_borrow', {
        p_borrow_id: borrowId,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending_requests'] })
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['trending'] })
      qc.invalidateQueries({ queryKey: ['landing-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-books'] })
      qc.invalidateQueries({ queryKey: ['shelf-active'] })
    },
  })
}

export function useReturnBook() {
  const qc = useQueryClient()
  return useMutation<FunctionReturn<'return_book'>, Error, { userId: string; bookId: number }>({
    mutationFn: async ({ userId, bookId }: { userId: string; bookId: number }) => {
      const { data, error } = await supabase.rpc('return_book', {
        p_user_id: userId,
        p_book_id: bookId,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['shelf-active', variables.userId] })
      qc.invalidateQueries({ queryKey: ['shelf-history', variables.userId] })
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['trending'] })
      qc.invalidateQueries({ queryKey: ['landing-stats'] })
      qc.invalidateQueries({ queryKey: ['inventory-books'] })
    },
  })
}

export function useCancelRequest() {
  const qc = useQueryClient()
  return useMutation<void, Error, { borrowId: number; userId: string }>({
    mutationFn: async ({ borrowId }) => {
      const { error } = await supabase
        .from('borrow_history')
        .delete()
        .eq('id', borrowId)
        .eq('status', 'requested') // Safety check

      if (error) throw error
    },
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: ['shelf-active', variables.userId] })
      qc.invalidateQueries({ queryKey: ['pending_requests'] })
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['inventory-books'] })
    },
  })
}
