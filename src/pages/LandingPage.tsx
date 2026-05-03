import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowRight,
  BookOpenText,
  CalendarClock,
  Library,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from 'lucide-react'
import { useAuthFlow } from '../hooks/useAuthFlow'
import { useBooks, useTrending } from '../hooks/useBooks'
import { supabase } from '../lib/supabase'
import type { ViewRow } from '../types/db'

type LandingBook = ViewRow<'book_details'>

type LandingStats = {
  books: number
  authors: number
  members: number
  availableCopies: number
}

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

function BookCard({ book }: { book: LandingBook }) {
  const author = book.authors?.[0] ?? 'Unknown Author'
  const initials = (book.title ?? '')
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
  const [coverReady, setCoverReady] = useState(true)
  const showFallback = !book.cover_url || !coverReady
  const gradient = FALLBACK_GRADIENTS[((book.title?.charCodeAt(0) ?? 0) || 0) % FALLBACK_GRADIENTS.length]

  return (
    <article className="group w-37.5 sm:w-42.5 shrink-0 transition-transform duration-150 ease group-hover:-translate-y-1.5">
      <div className="relative h-55 sm:h-62.5 overflow-hidden rounded-card border border-border bg-surface">
        <div className="absolute inset-0 flex h-full w-full items-center justify-center" style={{ background: gradient }}>
          <span className="font-display text-4xl italic text-white/95">{initials}</span>
        </div>
        {book.cover_url && coverReady ? (
<img
             src={book.cover_url ?? ''}
             alt={book.title ?? 'Book'}
             className="relative z-10 h-full w-full object-cover transition duration-150 ease group-hover:scale-105"
             loading="lazy"
             onError={() => setCoverReady(false)}
             style={{ opacity: showFallback ? 0 : 1 }}
           />
        ) : null}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
          {book.format}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-sm italic text-white sm:text-base">{book.title}</h3>
      <p className="line-clamp-1 text-xs text-muted sm:text-sm">{author}</p>
<p className="mt-1 text-[11px] text-ok sm:text-xs">
         {(book.available_copies ?? 0)} / {(book.total_copies ?? 0)} available
       </p>
    </article>
  )
}

function ShelfRow({ title, books }: { title: string; books: LandingBook[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl italic text-white sm:text-3xl">{title}</h2>
        <button className="hidden items-center gap-2 text-sm text-accent transition duration-150 hover:text-white sm:inline-flex">
          View all
          <ArrowRight size={16} />
        </button>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {books.map((book) => (
          <BookCard key={book.id} book={book} />
        ))}
      </div>
    </section>
  )
}

export default function LandingPage() {
  const queryClient = useQueryClient()
  const { openSignIn, openSignUp } = useAuthFlow()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const { data: trending = [], isLoading: loadingTrending } = useTrending()
  const { data: books = [], isLoading: loadingBooks } = useBooks({ limit: 24 })

  const { data: stats } = useQuery<LandingStats>({
    queryKey: ['landing-stats'],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const [bookCountRes, authorCountRes, memberCountRes, copiesRes] = await Promise.all([
        supabase.from('book_details').select('id', { count: 'exact', head: true }),
        supabase.from('authors').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).neq('role', 'admin'),
        supabase
          .from('book_details')
          .select('available_copies')
          .returns<Pick<ViewRow<'book_details'>, 'available_copies'>[]>(),
      ])

      if (bookCountRes.error) throw bookCountRes.error
      if (authorCountRes.error) throw authorCountRes.error
      if (memberCountRes.error) throw memberCountRes.error
      if (copiesRes.error) throw copiesRes.error

      const availableCopies = (copiesRes.data ?? []).reduce((sum, row) => sum + (row.available_copies ?? 0), 0)

      return {
        books: bookCountRes.count ?? 0,
        authors: authorCountRes.count ?? 0,
        members: memberCountRes.count ?? 0,
        availableCopies,
      }
    },
  })

  const trendingBooks = useMemo(() => (trending as LandingBook[]).slice(0, 12), [trending])
  const latestBooks = useMemo(() => {
    return [...(books as LandingBook[])]
      .sort((a, b) => (b.id ?? 0) - (a.id ?? 0))
      .slice(0, 12)
  }, [books])
  
  const surpriseBooks = useMemo(() => {
    return [...(books as LandingBook[])]
      .sort(() => Math.random() - 0.5)
      .slice(0, 12)
  }, [books])

  const textbookBooks = useMemo(
    () => (books as LandingBook[]).filter((book) => book.format === 'textbook').slice(0, 12),
    [books],
  )

  const featureCards = [
    {
      title: 'Real-time Search',
      description: 'Search by title, author, format, and availability from your actual GECA library catalog.',
      icon: Search,
    },
    {
      title: 'Secure Borrow Flow',
      description: 'Request, confirm, and return books through auditable workflows and role-aware access.',
      icon: ShieldCheck,
    },
    {
      title: 'Smart Discovery',
      description: 'Trending rows and shelf sections are generated directly from your live database views.',
      icon: Sparkles,
    },
  ]

  const loading = loadingTrending || loadingBooks

  useEffect(() => {
    const channel = supabase
      .channel('landing-live-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['books'] })
        void queryClient.invalidateQueries({ queryKey: ['landing-stats'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'book_copies' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['books'] })
        void queryClient.invalidateQueries({ queryKey: ['trending'] })
        void queryClient.invalidateQueries({ queryKey: ['landing-stats'] })
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['landing-stats'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-void text-white">
      <style>{`
        .landing-bg::before {
          content: '';
          position: absolute;
          inset: 0;
          pointer-events: none;
          background:
            radial-gradient(1000px 600px at 0% -10%, rgba(249,115,22,0.18), transparent 60%),
            radial-gradient(900px 600px at 100% 0%, rgba(16,185,129,0.14), transparent 60%),
            linear-gradient(180deg, rgba(255,255,255,0.02), transparent 35%);
          z-index: 0;
        }
        .paper-grid::before {
          content: '';
          position: absolute;
          inset: 0;
          background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
          background-size: 28px 28px;
          mask-image: linear-gradient(to bottom, black, transparent 70%);
          pointer-events: none;
          z-index: 0;
        }
      `}</style>

      <div className="landing-bg paper-grid relative">
        <header className="sticky top-0 z-50 border-b border-border bg-base/85 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-8 sm:px-8 lg:px-10">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-accent/20 p-2 text-accent">
                <Library size={18} />
              </span>
              <div>
                <p className="font-display text-lg italic leading-none text-white">ShelfOS</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-muted">GECA Aurangabad</p>
              </div>
            </div>

            <nav className="hidden items-center gap-7 text-sm text-muted md:flex">
              <a href="#discover" className="transition duration-150 hover:text-white">Discover</a>
              <a href="#features" className="transition duration-150 hover:text-white">Features</a>
              <a href="#borrow" className="transition duration-150 hover:text-white">How It Works</a>
            </nav>

            <button
              type="button"
              className="rounded-lg border border-border p-2 text-white/80 md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-border px-8 py-3 md:hidden">
              <div className="flex flex-col gap-3 text-sm text-muted">
                <a href="#discover">Discover</a>
                <a href="#features">Features</a>
                <a href="#borrow">How It Works</a>
              </div>
            </div>
          )}
        </header>

        <main className="relative z-10">
          <section className="mx-auto grid max-w-7xl gap-10 px-8 pb-16 pt-14 sm:px-8 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-20">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-accent">
                <BookOpenText size={14} />
                College Library Management
              </span>
              <h1 className="max-w-2xl font-display text-4xl italic leading-tight text-white sm:text-5xl lg:text-6xl">
                Built for readers, librarians, and real campus workflows.
              </h1>
              <p className="max-w-xl text-base leading-relaxed text-muted sm:text-lg">
                ShelfOS is connected to your live catalog and borrowing system. Browse available copies, discover trending
                books, and manage borrowing without paperwork friction.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  id="btn-get-started"
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-accent px-6 text-sm font-semibold text-white transition duration-150 ease hover:bg-accent/90"
                  onClick={openSignUp}
                >
                  Get Started
                  <ArrowRight size={16} />
                </button>
                <button
                  id="btn-sign-in"
                  type="button"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-border bg-surface px-6 text-sm font-semibold text-white transition duration-150 ease hover:bg-overlay"
                  onClick={openSignIn}
                >
                  Sign In
                </button>
              </div>
            </div>

            <aside className="rounded-card border border-border bg-raised/80 px-6 py-5 shadow-2xl shadow-black/30">
              <h2 className="text-sm uppercase tracking-[0.16em] text-muted">Live Library Snapshot</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-card border border-border bg-base/60 px-4 py-3">
                  <p className="text-xs text-muted">Books</p>
                  <p className="mt-1 text-2xl font-semibold text-accent">{stats?.books ?? '--'}</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 px-4 py-3">
                  <p className="text-xs text-muted">Authors</p>
                  <p className="mt-1 text-2xl font-semibold text-ok">{stats?.authors ?? '--'}</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 px-4 py-3">
                  <p className="text-xs text-muted">Members</p>
                  <p className="mt-1 text-2xl font-semibold text-white">{stats?.members ?? '--'}</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 px-4 py-3">
                  <p className="text-xs text-muted">Available Copies</p>
                  <p className="mt-1 text-2xl font-semibold text-warn">{stats?.availableCopies ?? '--'}</p>
                </div>
              </div>
              <div className="mt-5 rounded-card border border-border bg-base/40 px-5 py-4 text-sm text-muted">
                Data is pulled from your Supabase tables/views: <span className="text-white">book_details</span>, <span className="text-white">trending_books</span>, <span className="text-white">authors</span>, and <span className="text-white">users</span>.
              </div>
            </aside>
          </section>

          <section id="features" className="mx-auto max-w-7xl px-8 pb-14 sm:px-8 lg:px-10">
            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon
                return (
                  <article key={feature.title} className="rounded-card border border-border bg-surface px-6 py-5">
                    <span className="inline-flex rounded-lg bg-accent/15 p-2 text-accent">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-4 font-display text-2xl italic text-white">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-muted">{feature.description}</p>
                  </article>
                )
              })}
            </div>
          </section>

          <section id="discover" className="mx-auto max-w-7xl space-y-12 px-8 pb-16 sm:px-8 lg:px-10">
            {loading ? (
              <div className="rounded-card border border-border bg-surface px-6 py-5 text-center text-muted">
                Loading catalog shelves...
              </div>
            ) : (
              <>
                <ShelfRow title="Trending This Week" books={trendingBooks} />
                <ShelfRow title="Recently Added" books={latestBooks} />
                <ShelfRow title="Surprise Me" books={surpriseBooks} />
                <ShelfRow title="Academic & Textbooks" books={textbookBooks.length ? textbookBooks : latestBooks} />
              </>
            )}
          </section>

          <section id="borrow" className="mx-auto max-w-7xl px-8 pb-20 sm:px-8 lg:px-10">
            <div className="rounded-card border border-border bg-linear-to-br from-accent/12 to-ok/8 px-6 py-5 sm:p-8">
              <h2 className="font-display text-3xl italic text-white sm:text-4xl">How borrowing works</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-card border border-border bg-base/60 p-4">
                  <Search className="text-accent" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Find a book</p>
                  <p className="mt-1 text-xs text-muted">Search title, author, or format across your live catalog.</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 p-4">
                  <BookOpenText className="text-ok" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Request borrow</p>
                  <p className="mt-1 text-xs text-muted">Create a request and let the librarian confirm pickup.</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 p-4">
                  <Users className="text-accent" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Collect at desk</p>
                  <p className="mt-1 text-xs text-muted">Secure, role-based checkouts with audit visibility.</p>
                </div>
                <div className="rounded-card border border-border bg-base/60 p-4">
                  <CalendarClock className="text-warn" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Return on time</p>
                  <p className="mt-1 text-xs text-muted">Track due dates and avoid overdue penalties.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
