import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
import { useBooks, useTrending } from '../hooks/useBooks'
import { supabase } from '../lib/supabase'

type LandingBook = {
  id: number
  title: string
  cover_url: string | null
  format: string
  authors: Array<{ id: number; name: string }> | null
  avg_rating: number | null
  available_copies: number
  total_copies: number
}

type LandingStats = {
  books: number
  authors: number
  members: number
  availableCopies: number
}

function BookCard({ book }: { book: LandingBook }) {
  const author = book.authors?.[0]?.name ?? 'Unknown Author'
  const initials = book.title
    .split(' ')
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()

  return (
    <article className="group w-37.5 sm:w-42.5 shrink-0">
      <div className="relative h-55 sm:h-62.5 overflow-hidden rounded-xl border border-white/10 bg-slate-900">
        {book.cover_url ? (
          <img
            src={book.cover_url}
            alt={book.title}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-linear-to-br from-orange-500/80 via-amber-500/80 to-emerald-500/80">
            <span className="font-display text-4xl italic text-white/95">{initials}</span>
          </div>
        )}
        <span className="absolute left-2 top-2 rounded-md bg-black/70 px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-white/90">
          {book.format}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 font-display text-sm italic text-white sm:text-base">{book.title}</h3>
      <p className="line-clamp-1 text-xs text-white/60 sm:text-sm">{author}</p>
      <p className="mt-1 text-[11px] text-emerald-300 sm:text-xs">
        {book.available_copies} / {book.total_copies} available
      </p>
    </article>
  )
}

function ShelfRow({ title, books }: { title: string; books: LandingBook[] }) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="font-display text-2xl italic text-white sm:text-3xl">{title}</h2>
        <button className="hidden items-center gap-2 text-sm text-orange-300 transition hover:text-orange-200 sm:inline-flex">
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
        supabase.from('users').select('id', { count: 'exact', head: true }).eq('role', 'member'),
        supabase.from('book_details').select('available_copies'),
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
  const latestBooks = useMemo(() => (books as LandingBook[]).slice(0, 12), [books])
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

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-[#090e17] text-white">
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
        <header className="sticky top-0 z-50 border-b border-white/10 bg-[#090e17]/85 backdrop-blur-lg">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-10">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-orange-500/20 p-2 text-orange-300">
                <Library size={18} />
              </span>
              <div>
                <p className="font-display text-lg italic leading-none text-white">ShelfOS</p>
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/45">GECA Aurangabad</p>
              </div>
            </div>

            <nav className="hidden items-center gap-7 text-sm text-white/70 md:flex">
              <a href="#discover" className="transition hover:text-white">Discover</a>
              <a href="#features" className="transition hover:text-white">Features</a>
              <a href="#borrow" className="transition hover:text-white">How It Works</a>
            </nav>

            <button
              type="button"
              className="rounded-lg border border-white/15 p-2 text-white/80 md:hidden"
              onClick={() => setMobileMenuOpen((open) => !open)}
              aria-label="Toggle navigation"
            >
              {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {mobileMenuOpen && (
            <div className="border-t border-white/10 px-4 py-3 md:hidden">
              <div className="flex flex-col gap-3 text-sm text-white/75">
                <a href="#discover">Discover</a>
                <a href="#features">Features</a>
                <a href="#borrow">How It Works</a>
              </div>
            </div>
          )}
        </header>

        <main className="relative z-10">
          <section className="mx-auto grid max-w-7xl gap-10 px-4 pb-16 pt-14 sm:px-6 md:pt-20 lg:grid-cols-[1.1fr_0.9fr] lg:px-10 lg:pb-20">
            <div className="space-y-7">
              <span className="inline-flex items-center gap-2 rounded-full border border-orange-300/30 bg-orange-300/10 px-4 py-2 text-xs uppercase tracking-[0.18em] text-orange-200">
                <BookOpenText size={14} />
                College Library Management
              </span>
              <h1 className="max-w-2xl font-display text-4xl italic leading-tight text-white sm:text-5xl lg:text-6xl">
                Built for readers, librarians, and real campus workflows.
              </h1>
              <p className="max-w-xl text-base leading-relaxed sm:text-lg">
                ShelfOS is connected to your live catalog and borrowing system. Browse available copies, discover trending
                books, and manage borrowing without paperwork friction.
              </p>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  id="btn-get-started"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-orange-500 px-6 text-sm font-semibold text-white transition hover:bg-orange-400"
                >
                  Get Started
                  <ArrowRight size={16} />
                </button>
                <button
                  id="btn-sign-in"
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/5 px-6 text-sm font-semibold text-white transition hover:bg-white/10"
                >
                  Sign In
                </button>
              </div>
            </div>

            <aside className="rounded-2xl border border-white/10 bg-[#101827]/80 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <h2 className="text-sm uppercase tracking-[0.16em] text-white/45">Live Library Snapshot</h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/50">Books</p>
                  <p className="mt-1 text-2xl font-semibold text-orange-300">{stats?.books ?? '--'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/50">Authors</p>
                  <p className="mt-1 text-2xl font-semibold text-emerald-300">{stats?.authors ?? '--'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/50">Members</p>
                  <p className="mt-1 text-2xl font-semibold text-sky-300">{stats?.members ?? '--'}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                  <p className="text-xs text-white/50">Available Copies</p>
                  <p className="mt-1 text-2xl font-semibold text-amber-300">{stats?.availableCopies ?? '--'}</p>
                </div>
              </div>
              <div className="mt-5 rounded-xl border border-white/10 bg-white/3 p-4 text-sm text-white/70">
                Data is pulled from your Supabase tables/views: <span className="text-white">book_details</span>, <span className="text-white">trending_books</span>, <span className="text-white">authors</span>, and <span className="text-white">users</span>.
              </div>
            </aside>
          </section>

          <section id="features" className="mx-auto max-w-7xl px-4 pb-14 sm:px-6 lg:px-10">
            <div className="grid gap-4 md:grid-cols-3">
              {featureCards.map((feature) => {
                const Icon = feature.icon
                return (
                  <article key={feature.title} className="rounded-2xl border border-white/10 bg-white/3 p-6">
                    <span className="inline-flex rounded-lg bg-orange-500/15 p-2 text-orange-300">
                      <Icon size={18} />
                    </span>
                    <h3 className="mt-4 font-display text-2xl italic text-white">{feature.title}</h3>
                    <p className="mt-3 text-sm leading-relaxed text-white/70">{feature.description}</p>
                  </article>
                )
              })}
            </div>
          </section>

          <section id="discover" className="mx-auto max-w-7xl space-y-12 px-4 pb-16 sm:px-6 lg:px-10">
            {loading ? (
              <div className="rounded-2xl border border-white/10 bg-white/3 p-8 text-center text-white/70">
                Loading catalog shelves...
              </div>
            ) : (
              <>
                <ShelfRow title="Trending This Week" books={trendingBooks} />
                <ShelfRow title="Recently Added" books={latestBooks} />
                <ShelfRow title="Academic & Textbooks" books={textbookBooks.length ? textbookBooks : latestBooks} />
              </>
            )}
          </section>

          <section id="borrow" className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-10">
            <div className="rounded-2xl border border-white/10 bg-linear-to-br from-orange-500/12 to-emerald-500/8 p-6 sm:p-8">
              <h2 className="font-display text-3xl italic text-white sm:text-4xl">How borrowing works</h2>
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <Search className="text-orange-300" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Find a book</p>
                  <p className="mt-1 text-xs text-white/65">Search title, author, or format across your live catalog.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <BookOpenText className="text-emerald-300" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Request borrow</p>
                  <p className="mt-1 text-xs text-white/65">Create a request and let the librarian confirm pickup.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <Users className="text-sky-300" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Collect at desk</p>
                  <p className="mt-1 text-xs text-white/65">Secure, role-based checkouts with audit visibility.</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                  <CalendarClock className="text-amber-300" size={18} />
                  <p className="mt-3 text-sm font-semibold text-white">Return on time</p>
                  <p className="mt-1 text-xs text-white/65">Track due dates and avoid overdue penalties.</p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  )
}
