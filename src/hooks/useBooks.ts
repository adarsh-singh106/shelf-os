import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

interface Book {
  id: number
  title: string
  isbn: string | null
  format: 'novel' | 'manga' | 'magazine' | 'textbook' | 'digital'
  language: string | null
  published_date: string | null
  description: string | null
  cover_url: string | null
  avg_rating: number | null
  review_count: number
  available_copies: number
  total_copies: number
  authors: Array<{ id: number; name: string }>
  genres: Array<{ id: number; name: string }>
}

interface BooksFilters {
  format?: string
  genreId?: number
  limit?: number
}

export function useBooks(filters?: BooksFilters) {
  return useQuery({
    queryKey: ['books', filters],
    queryFn: async () => {
      let q = supabase
        .from('book_details')
        .select('*')
        .order('avg_rating', { ascending: false })
        .limit(filters?.limit ?? 20)
      
      if (filters?.format) q = q.eq('format', filters.format)
      
      const { data, error } = await q
      if (error) throw error
      return (data ?? []) as Book[]
    },
  })
}

export function useTrending() {
  return useQuery({
    queryKey: ['trending'],
    queryFn: async () => {
      const { data } = await supabase
        .from('trending_books')
        .select('*')
        .limit(20)
      return (data ?? []) as Book[]
    },
  })
}

export function useSearch(query: string) {
  return useQuery({
    queryKey: ['search', query],
    enabled: query.trim().length > 2,
    queryFn: async () => {
      const { data } = await supabase
        .from('book_details')
        .select('*')
        .textSearch('search_vector', query, { type: 'websearch' })
        .limit(30)
      return (data ?? []) as Book[]
    },
  })
}
