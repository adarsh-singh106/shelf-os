import { useEffect, useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import ShelfRow from '../components/books/ShelfRow'
import type { BookCardProps } from '../components/books/BookCard'
import BookModal from '../components/books/BookModal'
import { useAuth } from '../hooks/useAuth'
import { useTrending } from '../hooks/useBooks'
import type { ViewRow } from '../types/db'

type BookRow = ViewRow<'book_details'>

function normalizeGenre(value: string) {
  return value.replace(/^[^\p{L}\p{N}]+/u, '').trim().toLowerCase()
}

function hasGenreMatch(bookGenres: string[] | null, preferredGenres: string[]) {
  const normalizedBookGenres = (bookGenres ?? [])
    .filter((genre): genre is string => typeof genre === 'string')
    .map(normalizeGenre)
    .filter(Boolean)

  const normalizedPreferred = preferredGenres.map(normalizeGenre).filter(Boolean)
  if (normalizedBookGenres.length === 0 || normalizedPreferred.length === 0) return false

  return normalizedBookGenres.some((bookGenre) =>
    normalizedPreferred.some((preferred) => bookGenre === preferred || bookGenre.includes(preferred) || preferred.includes(bookGenre)),
  )
}

function normalizeBook(row: BookRow): BookCardProps {
  return {
    id: row.id ?? 0,
    title: row.title ?? 'Untitled',
    authors: row.authors ?? [],
    coverUrl: row.cover_url,
    isbn: row.isbn ?? null,
    format: (row.format ?? 'novel') as BookCardProps['format'],
    availableCopies: (row.available_copies ?? 0) as number,
    totalCopies: (row.total_copies ?? 0) as number,
    avgRating: row.avg_rating ?? 0,
    genres: row.genres ?? [],
    onClick: () => {
      // bound by ShelfRow
    },
  } as BookCardProps
}

export default function DiscoverPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const [selectedBook, setSelectedBook] = useState<BookRow | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  const handleRefresh = async () => {
    setRefreshing(true)
    await queryClient.invalidateQueries({ queryKey: ['books'] })
    await queryClient.invalidateQueries({ queryKey: ['trending'] })
    setTimeout(() => setRefreshing(false), 600)
  }

  const { data: trending = [], isLoading: loadingTrending } = useTrending()

  useEffect(() => {
    const state = location.state as { focusBookId?: number } | null
    if (!state?.focusBookId) return
    const focusBookId = state.focusBookId

    const loadFocusedBook = async () => {
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .eq('id', focusBookId)
        .maybeSingle()
        .returns<BookRow>()

      if (!error && data) {
        setSelectedBook(data)
      }
    }

    void loadFocusedBook()
    navigate(location.pathname, { replace: true, state: null })
  }, [location.pathname, location.state, navigate])

  const { data: fictionRomance = [], isLoading: loadingFictionRomance } = useQuery<BookRow[]>({
    queryKey: ['books', 'fiction-romance'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .order('id', { ascending: false })
        .limit(100)
        .returns<BookRow[]>()
      if (error) throw error

      const targetGenres = new Set(['Fiction', 'Romance', 'Science Fiction', 'Fantasy', 'Historical Fiction', 'Literary Fiction'])
      return (data ?? [])
        .filter((book) => (book.genres ?? []).some((genre) => targetGenres.has(genre) || genre.toLowerCase().includes('fiction') || genre.toLowerCase().includes('romance')))
        .slice(0, 20)
    },
  })

  const { data: textbooks = [], isLoading: loadingTextbooks } = useQuery<BookRow[]>({
    queryKey: ['books', 'textbooks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .eq('format', 'textbook')
        .order('id', { ascending: false })
        .limit(20)
        .returns<BookRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const { data: newBooks = [], isLoading: loadingNew } = useQuery<BookRow[]>({
    queryKey: ['books', 'new'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .order('id', { ascending: false })
        .limit(20)
        .returns<BookRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const preferredGenres = useMemo(() => {
    const raw = profile?.preferences
    if (!raw || typeof raw !== 'object' || !('genres' in raw)) return [] as string[]
    const genres = (raw as { genres?: unknown }).genres
    return Array.isArray(genres)
      ? genres
          .filter((value): value is string => typeof value === 'string')
          .map((value) => value.replace(/^[^\p{L}\p{N}]+/u, '').trim())
          .filter(Boolean)
      : []
  }, [profile?.preferences])

  const { data: forYou = [], isLoading: loadingForYou } = useQuery<BookRow[]>({
    queryKey: ['books', 'for-you', preferredGenres],
    enabled: preferredGenres.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('book_details')
        .select('*')
        .limit(40)
        .returns<BookRow[]>()
      if (error) throw error

      return (data ?? [])
        .filter((book) => hasGenreMatch(book.genres, preferredGenres))
        .sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0))
        .slice(0, 20)
    },
  })

  const heroBook = (trending[0] as BookRow | undefined)

  const toCardRows = (rows: BookRow[]) => rows.map(normalizeBook)
  const openBookByCard = (book: BookCardProps, rows: BookRow[]) => {
    setSelectedBook(rows.find((row) => row.id === book.id) ?? null)
  }

  useEffect(() => {
    const channel = supabase
      .channel('discover-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['books'] })
        void queryClient.invalidateQueries({ queryKey: ['trending'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_copies' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['books'] })
        void queryClient.invalidateQueries({ queryKey: ['trending'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'waitlist' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['books'] })
        void queryClient.invalidateQueries({ queryKey: ['trending'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <main className="min-h-screen bg-void px-4 pb-20 pt-7 sm:px-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-[28px] italic text-white sm:text-[32px]">Discover</h1>
          <p className="mt-1 text-sm text-muted">Explore the latest and greatest in our collection</p>
        </div>
        <button
          type="button"
          onClick={() => void handleRefresh()}
          disabled={refreshing}
          className={`flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/4 text-muted transition-all hover:bg-white/8 hover:text-white sm:self-center ${refreshing ? 'cursor-not-allowed opacity-50' : ''}`}
          title="Sync with Library"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </header>

      <section className="relative mb-10 h-[220px] overflow-hidden rounded-card sm:h-[240px] md:h-[280px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#0d1829] to-[#1a0d29]" />
        {heroBook?.cover_url ? (
          <img
            src={heroBook.cover_url}
            alt={heroBook.title ?? ''}
            className="absolute inset-[-20px] h-[calc(100%+40px)] w-[calc(100%+40px)] scale-110 object-cover"
            style={{ filter: 'blur(40px) saturate(0.5) brightness(0.25)' }}
          />
        ) : null}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />

        <div className="relative z-10 flex h-full flex-col justify-end p-5 sm:p-7 md:justify-center">
          <p className="mb-2 font-mono text-[10px] tracking-[0.1em] text-accent">✦ Featured this week</p>
          <h1 className="max-w-full font-display text-xl italic text-white sm:text-2xl md:max-w-[60%] md:text-[32px] lg:text-[40px] leading-tight">
            {heroBook?.title ?? 'Discover the best books this week'}
          </h1>
          <p className="mt-1 line-clamp-1 text-xs text-muted sm:text-sm">{heroBook?.authors?.[0] ?? 'Popular picks from your library'}</p>

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
            <span className="font-mono text-warn">★ {heroBook?.avg_rating?.toFixed(1) ?? '4.5'}</span>
            <span className="rounded-full bg-white/10 px-2 py-0.5">{heroBook?.format ?? 'novel'}</span>
            <span className="text-ok font-medium">{heroBook?.available_copies ?? 0} available</span>
          </div>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              className="h-9 rounded-lg bg-accent px-4 text-xs font-bold uppercase tracking-wider text-white shadow-lg shadow-accent/20 transition-transform active:scale-95 sm:text-sm"
              onClick={() => setSelectedBook(heroBook ?? null)}
              disabled={!heroBook}
            >
              Borrow
            </button>
            <button
              type="button"
              className="h-9 rounded-lg border border-border bg-white/6 px-4 text-xs font-medium text-white/80 transition-colors hover:bg-white/10 sm:text-sm"
              onClick={() => setSelectedBook(heroBook ?? null)}
              disabled={!heroBook}
            >
              + Waitlist
            </button>
          </div>
        </div>
      </section>

      <div className="space-y-4">
        <ShelfRow title="Newly Added" books={toCardRows(newBooks)} loading={loadingNew} onBookClick={(book) => openBookByCard(book, newBooks)} />
        <ShelfRow title="Academic & Textbooks" books={toCardRows(textbooks)} loading={loadingTextbooks} onBookClick={(book) => openBookByCard(book, textbooks)} />

        <ShelfRow
          title="Trending This Week"
          books={toCardRows(trending as BookRow[])}
          loading={loadingTrending}
          onBookClick={(book) => openBookByCard(book, trending as BookRow[])}
        />

        <ShelfRow title="Fiction & Romance" books={toCardRows(fictionRomance)} loading={loadingFictionRomance} onBookClick={(book) => openBookByCard(book, fictionRomance)} />

        {preferredGenres.length === 0 ? (
          <div className="mb-9 rounded-card border border-accent/20 bg-accent/8 p-5 text-center sm:text-left">
            <p className="text-sm text-white/90">Tell us your taste to personalize recommendations.</p>
            <button
              type="button"
              onClick={() => navigate('/space')}
              className="mt-3 inline-flex items-center gap-2 text-sm font-bold text-accent transition-colors duration-150 hover:text-white"
            >
              Tell us your taste →
            </button>
          </div>
        ) : null}

        <ShelfRow
          title="Picked For You"
          books={toCardRows((preferredGenres.length > 0 ? forYou : trending) as BookRow[])}
          loading={preferredGenres.length > 0 ? loadingForYou : loadingTrending}
          onBookClick={(book) => openBookByCard(book, (preferredGenres.length > 0 ? forYou : trending) as BookRow[])}
        />
      </div>

      <BookModal
        isOpen={Boolean(selectedBook)}
        onClose={() => setSelectedBook(null)}
        userId={user?.id ?? null}
        book={
          selectedBook
            ? {
                id: selectedBook.id ?? 0,
                title: selectedBook.title ?? 'Untitled',
                authors: selectedBook.authors ?? [],
                genres: selectedBook.genres ?? [],
                coverUrl: selectedBook.cover_url,
                isbn: selectedBook.isbn,
                format: selectedBook.format ?? 'novel',
                language: selectedBook.language ?? 'English',
                publishedDate: selectedBook.published_date,
                description: selectedBook.description,
                avgRating: selectedBook.avg_rating ?? 0,
                reviewCount: selectedBook.review_count ?? 0,
                availableCopies: selectedBook.available_copies ?? 0,
                totalCopies: selectedBook.total_copies ?? 0,
                waitlistCount: selectedBook.waitlist_count ?? 0,
              }
            : null
        }
      />
    </main>
  )
}
