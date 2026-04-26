import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

export function useRequestBorrow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, bookId }: { userId: string; bookId: number }) => {
      const { data, error } = await supabase.rpc('request_borrow', {
        p_user_id: userId,
        p_book_id: bookId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['books'] })
      qc.invalidateQueries({ queryKey: ['myBorrows'] })
    },
  })
}

export function useConfirmBorrow() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (borrowId: number) => {
      const { data, error } = await supabase.rpc('confirm_borrow', {
        p_borrow_id: borrowId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pendingRequests'] })
    },
  })
}

export function useReturnBook() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ userId, bookId }: { userId: string; bookId: number }) => {
      const { data, error } = await supabase.rpc('return_book', {
        p_user_id: userId,
        p_book_id: bookId,
      })
      if (error) throw error
      return data as string
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['myBorrows'] })
    },
  })
}
