import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import type { TableRow, ViewRow } from '../types/db'

export type Book = ViewRow<'book_details'>
type TrendingBook = ViewRow<'trending_books'>
type GenreRow = Pick<TableRow<'genres'>, 'id' | 'name'>

interface BooksFilters {
  format?: Book['format']
  genreId?: number
  limit?: number
  sortBy?: 'id' | 'rating'
}

export function useBooks(filters?: BooksFilters) {
  return useQuery<Book[]>({
    queryKey: ['books', filters],
    queryFn: async () => {
      let genreName: string | null = null
      if (filters?.genreId) {
        const { data: genre, error: genreError } = await supabase
          .from('genres')
          .select('id, name')
          .eq('id', filters.genreId)
          .single()
          .returns<GenreRow>()

        if (genreError) throw genreError
        genreName = genre.name
      }

      const sortCol = filters?.sortBy === 'rating' ? 'avg_rating' : 'id'
      
      let q = supabase
        .from('book_details')
        .select('*')
        .order(sortCol, { ascending: false })
        .limit(genreName ? 100 : filters?.limit ?? 20)
      
      if (filters?.format) q = q.eq('format', filters.format)
      
      const { data, error } = await q.returns<Book[]>()
      if (error) throw error

      const rows = data ?? []
      const filtered = genreName
        ? rows.filter((book) => (book.genres ?? []).includes(genreName))
        : rows

      return filtered.slice(0, filters?.limit ?? 20)
    },
  })
}

export function useTrending() {
  return useQuery<Book[]>({
    queryKey: ['trending'],
    queryFn: async () => {
      const { data: trendingRows, error: trendingError } = await supabase
        .from('trending_books')
        .select('*')
        .limit(20)
        .returns<TrendingBook[]>()

      if (trendingError) throw trendingError

      const trendMap = new Map<number, TrendingBook>(
        (trendingRows ?? [])
          .filter((row): row is TrendingBook & { id: number } => row.id !== null)
          .map((row) => [row.id, row])
      )
      const trendIds = [...trendMap.keys()]

      if (trendIds.length === 0) {
        return []
      }

      const { data: detailRows, error: detailError } = await supabase
        .from('book_details')
        .select('*')
        .in('id', trendIds)
        .returns<Book[]>()

      if (detailError) throw detailError

      const details = detailRows ?? []
      return details.sort((a, b) => {
        const aBorrows = a.id ? trendMap.get(a.id)?.borrows_this_week ?? 0 : 0
        const bBorrows = b.id ? trendMap.get(b.id)?.borrows_this_week ?? 0 : 0
        return bBorrows - aBorrows
      })
    },
  })
}

export function useSearch(query: string) {
  return useQuery<Book[]>({
    queryKey: ['search', query],
    enabled: query.trim().length > 2,
    queryFn: async () => {
      const term = query.trim().toLowerCase()
      
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .ilike('searchable_text', `%${term}%`)
        .order('id', { ascending: false })
        .limit(30)
        .returns<Book[]>()
      
      if (error) throw error
      return data ?? []
    },
  })
}
