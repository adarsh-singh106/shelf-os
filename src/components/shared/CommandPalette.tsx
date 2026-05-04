import { Book, BookOpen, Home, LogOut, Search, User } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { ViewRow } from '../../types/db'

type PaletteBook = Pick<
  ViewRow<'book_details'>,
  'id' | 'title' | 'authors' | 'cover_url' | 'isbn' | 'format' | 'available_copies' | 'total_copies' | 'avg_rating'
  | 'genres'
>

const FALLBACK_GRADIENTS = [
  'linear-gradient(135deg, #1a3a5c, #2d6b9e)',
  'linear-gradient(135deg, #3a1a1a, #8c3030)',
  'linear-gradient(135deg, #1a3a1a, #2d7a2d)',
  'linear-gradient(135deg, #2d1a3a, #6b2d8c)',
  'linear-gradient(135deg, #3a2a1a, #8c6b2d)',
  'linear-gradient(135deg, #1a2d3a, #2d6b8c)',
  'linear-gradient(135deg, #3a1a2d, #8c2d6b)',
  'linear-gradient(135deg, #1a1a3a, #3a3a8c)',
]

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onBookSelect: (book: PaletteBook) => void
}

export default function CommandPalette({ isOpen, onClose, onBookSelect }: CommandPaletteProps) {
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PaletteBook[]>([])
  const [searchError, setSearchError] = useState<string | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)

  useEffect(() => {
    if (isOpen) return

    const raf = requestAnimationFrame(() => {
      setQuery('')
      setDebouncedQuery('')
      setResults([])
      setSearchError(null)
      setSelectedIndex(0)
    })

    return () => cancelAnimationFrame(raf)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return

    const timer = window.setTimeout(() => {
      setDebouncedQuery(query.trim())
    }, 300)

    return () => window.clearTimeout(timer)
  }, [isOpen, query])

  useEffect(() => {
    if (!isOpen || debouncedQuery.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      setLoading(false)
      setSearchError(null)
      return
    }

    const runSearch = async () => {
      const term = debouncedQuery.toLowerCase()
      setLoading(true)
      setSearchError(null)
      
      const { data, error } = await supabase
        .from('book_details')
        .select('id, title, authors, genres, cover_url, isbn, format, available_copies, total_copies, avg_rating')
        .ilike('searchable_text', `%${term}%`)
        .order('id', { ascending: false })
        .limit(12)
        .returns<PaletteBook[]>()

      if (error) {
        setSearchError(error.message)
        setResults([])
      } else {
        setResults(data ?? [])
      }

      setSelectedIndex(0)
      setLoading(false)
    }

    void runSearch()
  }, [debouncedQuery, isOpen])

  const quickActions = useMemo(
    () => [
      { id: 'discover', label: 'Go to Discover', icon: Home, action: () => navigate('/discover') },
      { id: 'shelf', label: 'My Shelf', icon: BookOpen, action: () => navigate('/shelf') },
      { id: 'space', label: 'My Space', icon: User, action: () => navigate('/space') },
      {
        id: 'signout',
        label: 'Sign Out',
        icon: LogOut,
        action: async () => {
          await supabase.auth.signOut()
          navigate('/')
        },
      },
    ],
    [navigate],
  )

  useEffect(() => {
    if (!isOpen) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        onClose()
        return
      }

      const listSize = debouncedQuery.length >= 2 ? results.length : quickActions.length
      if (listSize === 0) return

      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setSelectedIndex((current) => (current + 1) % listSize)
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault()
        setSelectedIndex((current) => (current - 1 + listSize) % listSize)
      }
      if (event.key === 'Enter') {
        event.preventDefault()
        if (debouncedQuery.length >= 2) {
          const selected = results[selectedIndex]
          if (selected) {
            onBookSelect(selected)
            onClose()
          }
        } else {
          const action = quickActions[selectedIndex]
          if (action) {
            void action.action()
            onClose()
          }
        }
      }
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [debouncedQuery.length, isOpen, onBookSelect, onClose, quickActions, results, selectedIndex])

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-[8px]"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose()
        }
      }}
    >
      <style>{`
        @keyframes palette-enter {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <section
        className="mx-auto mt-[20vh] max-h-[480px] w-[min(600px,90vw)] overflow-hidden rounded-[14px] border border-border bg-raised shadow-[0_40px_80px_rgba(0,0,0,0.6)]"
        style={{ animation: 'palette-enter 150ms ease' }}
      >
        {loading ? <div className="h-0.5 w-full animate-pulse bg-accent" /> : null}

        <div className="flex h-14 items-center gap-3 border-b border-border px-[18px]">
          <Search size={18} className="text-muted" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Search books, authors, or type a command..."
            className="h-full flex-1 bg-transparent text-base text-white outline-none placeholder:text-ghost"
          />
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] text-muted">ESC</kbd>
        </div>

        <div className="max-h-[388px] overflow-y-auto">
          {debouncedQuery.length < 2 ? (
            <>
              <p className="px-[18px] pb-1 pt-2.5 font-mono text-[11px] tracking-[0.1em] text-muted">Quick Actions</p>
              {quickActions.map((item, index) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    void item.action()
                    onClose()
                  }}
                  className={`flex h-11 w-full items-center gap-3 px-[18px] text-left transition duration-150 ${
                    selectedIndex === index ? 'border-l-2 border-accent bg-accent/10' : 'hover:bg-white/6'
                  }`}
                >
                  <item.icon size={16} className="text-muted" />
                  <span className="text-sm text-white">{item.label}</span>
                </button>
              ))}
            </>
          ) : searchError ? (
            <div className="grid place-items-center py-12 text-center">
              <Book size={32} className="text-danger" />
              <p className="mt-3 text-sm text-danger">{searchError}</p>
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="grid place-items-center py-12 text-center">
              <Book size={32} className="text-ghost" />
              <p className="mt-3 text-sm text-muted">No books found for "{debouncedQuery}"</p>
              <p className="text-xs text-muted">Try title, author, ISBN, format, or genre</p>
            </div>
          ) : (
            <>
              <p className="px-[18px] pb-1 pt-2.5 font-mono text-[11px] tracking-[0.1em] text-muted">{results.length} results</p>
              {results.map((book, index) => {
                const firstAuthor = book.authors?.[0] ?? 'Unknown Author'
                const authorLabel = (book.authors?.length ?? 0) > 1 ? `${firstAuthor} et al.` : firstAuthor
                const gradient = FALLBACK_GRADIENTS[(book.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length]

                return (
                  <button
                    key={book.id}
                    type="button"
                    onClick={() => {
                      onBookSelect(book)
                      onClose()
                    }}
                    className={`flex h-16 w-full items-center gap-3 px-[18px] text-left transition duration-150 ${
                      selectedIndex === index ? 'border-l-2 border-accent bg-accent/10' : 'hover:bg-white/6'
                    }`}
                  >
                    <div className="relative h-[60px] w-10 overflow-hidden rounded-md border border-border bg-white/8">
<div className="absolute inset-0 grid place-items-center font-display text-sm italic text-white" style={{ background: gradient }}>
                         {book.title?.[0]?.toUpperCase() ?? 'B'}
                       </div>
                      {book.cover_url ? (
<img
                           src={book.cover_url ?? ''}
                           alt={book.title ?? 'Book'}
                           className="relative z-10 h-full w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = 'none'
                          }}
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm text-white">{book.title}</p>
                      <p className="truncate text-xs text-muted">{authorLabel}</p>
                    </div>
<span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] text-muted">
                       {book.format === 'digital' ? 'Digital' : (book.available_copies ?? 0) > 0 ? `${book.available_copies} avail` : 'Waitlist'}
                     </span>
                  </button>
                )
              })}
            </>
          )}
        </div>

        <footer className="flex h-9 items-center gap-3 border-t border-border bg-white/2 px-[18px] font-mono text-[10px] text-muted">
          ↑↓ navigate · Enter select · Esc close
        </footer>
      </section>
    </div>
  )
}
