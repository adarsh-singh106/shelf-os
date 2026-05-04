import { BookOpen, Loader2, X, Trash2, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCancelRequest, useLeaveWaitlist } from '../hooks/useBorrow'
import type { TableRow, ViewRow } from '../types/db'

type Tab = 'active' | 'history' | 'waitlist'

type BorrowStatus = TableRow<'borrow_history'>['status']
type BorrowHistoryRow = TableRow<'borrow_history'> & {
  books: {
    id: number
    title: string
    cover_url: string | null
    isbn: string | null
    authors: Array<{ authors?: { name: string } | null }> | null
  } | null
}

type ReadingHistoryRow = ViewRow<'user_reading_history'> & {
  fine_amount?: number | null
  fine_status?: string | null
}

type WaitlistRow = TableRow<'waitlist'> & {
  books: {
    id: number
    title: string
    cover_url: string | null
    isbn: string | null
    authors: Array<{ authors?: { name: string } | null }> | null
  } | null
  position?: number
}

function CountdownTimer({ dueDate }: { dueDate: string | null }) {
  const [timeLeft, setTimeLeft] = useState<{ d: number; h: number; m: number; s: number } | null>(null)

  useEffect(() => {
    if (!dueDate) return

    const target = new Date(dueDate).getTime()

    const update = () => {
      const now = new Date().getTime()
      const diff = target - now

      if (diff <= 0) {
        setTimeLeft({ d: 0, h: 0, m: 0, s: 0 })
        return
      }

      setTimeLeft({
        d: Math.floor(diff / (1000 * 60 * 60 * 24)),
        h: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        m: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        s: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }

    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [dueDate])

  if (!timeLeft) return <span className="text-muted text-[10px]">Calculating...</span>
  
  const isOverdue = timeLeft.d === 0 && timeLeft.h === 0 && timeLeft.m === 0 && timeLeft.s === 0

  return (
    <div className={`flex items-center gap-1.5 font-mono text-[10px] ${isOverdue ? 'text-danger' : 'text-accent'}`}>
      <Clock size={11} />
      <span>
        {timeLeft.d}d {timeLeft.h}h {timeLeft.m}m {timeLeft.s}s
      </span>
      {isOverdue && <span className="font-bold uppercase">Overdue</span>}
    </div>
  )
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

function statusChip(status: BorrowStatus) {
  if (status === 'requested') return 'bg-warn/20 text-warn'
  if (status === 'active') return 'bg-ok/20 text-ok'
  if (status === 'overdue') return 'bg-danger/20 text-danger'
  return 'bg-white/10 text-muted'
}

export default function MyShelfPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('active')
  const cancelRequest = useCancelRequest()
  const leaveWaitlist = useLeaveWaitlist()

  const handleCancel = async (borrowId: number) => {
    if (!user?.id) return
    if (!window.confirm('Are you sure you want to cancel this borrow request?')) return

    try {
      await cancelRequest.mutateAsync({ borrowId, userId: user.id })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const handleLeaveWaitlist = async (bookId: number) => {
    if (!user?.id) return
    if (!window.confirm('Leave the waitlist for this book?')) return

    try {
      await leaveWaitlist.mutateAsync({ bookId, userId: user.id })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  const { data: activeRows = [], isLoading: loadingActive, error: activeError } = useQuery<BorrowHistoryRow[]>({
    queryKey: ['shelf-active', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrow_history')
        .select('id, user_id, status, borrowed_at, due_date, returned_at, copy_id, fine_amount, fine_status, books(id, title, cover_url, isbn, authors:book_authors(authors(name)))')
        .eq('user_id', user!.id)
        .in('status', ['active', 'requested', 'overdue'])
        .order('borrowed_at', { ascending: false })
        .returns<BorrowHistoryRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const { data: historyRows = [], isLoading: loadingHistory, error: historyError } = useQuery<ReadingHistoryRow[]>({
    queryKey: ['shelf-history', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_reading_history')
        .select('*')
        .eq('user_id', user!.id)
        .in('status', ['returned', 'cancelled'])
        .order('returned_at', { ascending: false })
        .limit(20)
        .returns<ReadingHistoryRow[]>()
      if (error) throw error
      return data ?? []
    },
  })

  const { data: waitlistRows = [], isLoading: loadingWaitlist, error: waitlistError } = useQuery<WaitlistRow[]>({
    queryKey: ['shelf-waitlist', user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist')
        .select('id, user_id, book_id, joined_at, books(id, title, cover_url, isbn, authors:book_authors(authors(name)))')
        .eq('user_id', user!.id)
        .order('joined_at', { ascending: true })
        .returns<WaitlistRow[]>()
      if (error) throw error

      const rows = data ?? []
      const enriched = await Promise.all(
        rows.map(async (row) => {
          const { count } = await supabase
            .from('waitlist')
            .select('*', { count: 'exact', head: true })
            .eq('book_id', row.book_id!)
            .lt('joined_at', row.joined_at!)

          return { ...row, position: (count ?? 0) + 1 }
        }),
      )
      return enriched
    },
  })

  const activeCount = activeRows.length
  const waitlistCount = waitlistRows.length

  const currentLoading = tab === 'active' ? loadingActive : tab === 'history' ? loadingHistory : loadingWaitlist
  const currentError = tab === 'active' ? activeError : tab === 'history' ? historyError : waitlistError

  const activeCards = useMemo(() => {
    return activeRows.map((row) => {
      const borrowedAt = row.borrowed_at ? new Date(row.borrowed_at) : null
      const dueDate = row.due_date ? new Date(row.due_date) : null
      const now = new Date()
      const totalDays = borrowedAt && dueDate ? Math.max(1, (dueDate.getTime() - borrowedAt.getTime()) / 86400000) : 14
      const elapsedDays = borrowedAt ? Math.max(0, (now.getTime() - borrowedAt.getTime()) / 86400000) : 0
      const ratio = Math.min(100, Math.max(0, (elapsedDays / totalDays) * 100))
      const daysLeft = dueDate ? Math.ceil((dueDate.getTime() - now.getTime()) / 86400000) : null
      return { row, ratio, daysLeft }
    })
  }, [activeRows])

  useEffect(() => {
    if (!user?.id) return

    const borrowChannel = supabase
      .channel(`my-shelf-borrow-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'borrow_history', filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['shelf-active', user.id] })
          void queryClient.invalidateQueries({ queryKey: ['shelf-history', user.id] })
          void queryClient.invalidateQueries({ queryKey: ['books'] })
          void queryClient.invalidateQueries({ queryKey: ['trending'] })
        },
      )
      .subscribe()

    const waitlistChannel = supabase
      .channel(`my-shelf-waitlist-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'waitlist', filter: `user_id=eq.${user.id}` },
        () => {
          void queryClient.invalidateQueries({ queryKey: ['shelf-waitlist', user.id] })
          void queryClient.invalidateQueries({ queryKey: ['books'] })
          void queryClient.invalidateQueries({ queryKey: ['trending'] })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(borrowChannel)
      void supabase.removeChannel(waitlistChannel)
    }
  }, [queryClient, user?.id])

  return (
    <main className="min-h-screen bg-void px-4 pb-24 pt-7 sm:px-8 sm:pb-8">
      <header className="mb-8">
        <h1 className="font-display text-[28px] italic text-white sm:text-[32px]">My Shelf</h1>
        <p className="text-sm text-muted">Your books, borrows and reading history</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-1.5 sm:gap-2">
        {[
          { id: 'active' as const, label: `Active (${activeCount})` },
          { id: 'history' as const, label: 'History' },
          { id: 'waitlist' as const, label: `Waitlist (${waitlistCount})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-3 py-2 text-xs transition duration-150 sm:px-4 sm:text-sm ${
              tab === item.id ? 'border-b-2 border-accent bg-accent/12 text-accent' : 'text-muted hover:bg-white/6'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {currentLoading ? (
        <div className="inline-flex items-center gap-2 text-sm text-muted">
          <Loader2 size={14} className="animate-spin" /> Loading shelf...
        </div>
      ) : null}

      {!currentLoading && currentError ? (
        <div className="rounded-card border border-danger/20 bg-danger/10 px-4 py-3 text-sm text-danger">
          {(currentError as Error).message}
        </div>
      ) : null}

      {!currentLoading && !currentError && tab === 'active' && activeCards.length === 0 ? (
        <section className="grid place-items-center rounded-card border border-border bg-surface px-4 py-16 text-center">
          <BookOpen size={48} className="text-ghost opacity-50" />
          <p className="mt-3 text-[15px] text-white/80">No active borrows</p>
          <p className="text-[13px] text-muted">Browse the library to request your first book</p>
          <button type="button" onClick={() => navigate('/discover')} className="mt-4 text-sm font-bold text-accent transition-colors duration-150 hover:text-white">
            Go to Discover →
          </button>
        </section>
      ) : null}

      {!currentLoading && !currentError && tab === 'active' ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {activeCards.map(({ row, ratio, daysLeft }) => {
            const author = row.books?.authors?.[0]?.authors?.name ?? 'Unknown Author'
            const daysLabel = daysLeft === null ? '' : daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`
            const progressColor = ratio < 70 ? 'bg-ok' : ratio <= 90 ? 'bg-warn' : 'bg-danger'
            const gradient = FALLBACK_GRADIENTS[(row.books?.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length]

            return (
              <article key={row.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface px-5 py-4 sm:flex-row sm:px-6 sm:py-5">
                <div className="flex gap-4 sm:gap-6">
                  <div className="relative h-[100px] w-[70px] shrink-0 overflow-hidden rounded-md border border-border bg-white/8 shadow-xl">
                    <div className="absolute inset-0 grid place-items-center font-display text-xl italic text-white" style={{ background: gradient }}>
                      {row.books?.title?.[0] ?? 'B'}
                    </div>
                    {row.books?.cover_url ? (
                      <img
                        src={row.books.cover_url}
                        alt={row.books?.title ?? ''}
                        className="relative z-10 h-full w-full object-cover"
                        onError={(event) => {
                          event.currentTarget.style.display = 'none'
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="flex-1 min-w-0">
                    <h3 className="line-clamp-1 font-display text-base italic text-white sm:text-lg">{row.books?.title ?? 'Unknown Book'}</h3>
                    <p className="truncate text-xs text-muted">{author}</p>

                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${statusChip(row.status)}`}>
                        {row.status === 'requested' ? 'Pending' : row.status === 'active' ? 'Borrowed' : 'Overdue'}
                      </span>
                      {row.fine_amount && row.fine_amount > 0 ? (
                        <span className="inline-flex rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-mono font-bold text-danger border border-danger/20">
                          ₹{row.fine_amount}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="flex-1 flex flex-col justify-center sm:border-l sm:border-white/5 sm:pl-6">
                  {row.status !== 'requested' ? (
                    <>
                      <div className="mt-1 h-[4px] w-full rounded bg-white/5 overflow-hidden">
                        <div className={`h-full rounded ${progressColor} transition-all duration-1000`} style={{ width: `${ratio}%` }} />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-4">
                        <p className="text-[11px] font-medium text-muted">{daysLabel}</p>
                        <CountdownTimer dueDate={row.due_date} />
                      </div>
                    </>
                  ) : (
                    <div className="flex items-center justify-between">
                       <p className="text-[11px] text-muted italic">Awaiting pickup at desk</p>
                       <button
                          type="button"
                          onClick={() => handleCancel(row.id)}
                          disabled={cancelRequest.isPending}
                          className="flex items-center gap-1.5 rounded-lg border border-border bg-white/4 px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-muted transition-all hover:border-danger/30 hover:bg-danger/10 hover:text-danger active:scale-95 disabled:opacity-50"
                        >
                          {cancelRequest.isPending ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                          Discard
                        </button>
                    </div>
                  )}
                  {row.status !== 'requested' && (
                     <div className="mt-3 flex items-center justify-between border-t border-white/5 pt-3">
                        <span className="text-[10px] uppercase font-bold text-muted tracking-widest">Asset #{row.copy_id}</span>
                        <div className="h-1.5 w-1.5 rounded-full bg-ok animate-pulse" />
                     </div>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {!currentLoading && !currentError && tab === 'history' ? (
        historyRows.length === 0 ? (
          <div className="grid place-items-center py-16 text-muted border border-dashed border-white/10 rounded-card bg-surface/30">
             <p className="text-sm">No reading history yet</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {historyRows.map((row, idx) => (
              <article key={idx} className="rounded-card border border-border bg-surface px-5 py-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-base italic text-white">{row.title ?? 'Unknown Book'}</h3>
                  <p className="mt-1 text-[11px] text-muted leading-relaxed">
                    {row.status === 'returned' 
                      ? `Borrowed ${row.borrowed_at ? new Date(row.borrowed_at).toLocaleDateString() : '—'} · Returned ${row.returned_at ? new Date(row.returned_at).toLocaleDateString() : '—'}`
                      : 'Request was cancelled'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {row.fine_amount && row.fine_amount > 0 ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-mono text-danger border border-danger/20">
                      ₹{row.fine_amount} Paid
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider ${
                    row.status === 'returned' ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-white/5 text-muted border border-white/10'
                  }`}>
                    {row.status}
                  </span>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}

      {!currentLoading && !currentError && tab === 'waitlist' ? (
        waitlistRows.length === 0 ? (
          <div className="grid place-items-center py-16 text-muted border border-dashed border-white/10 rounded-card bg-surface/30">
            <p className="text-sm">You're not waiting for any books</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {waitlistRows.map((row, index) => (
              <article key={row.id} className="flex flex-col gap-4 rounded-card border border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="font-display text-base italic text-white sm:text-lg">{row.books?.title ?? 'Unknown Book'}</h3>
                  <p className="text-[11px] text-muted">Joined queue on {row.joined_at ? new Date(row.joined_at).toLocaleDateString() : '—'}</p>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6">
                  <div className="text-left sm:text-right">
                    <p className="font-mono text-lg text-accent font-black italic leading-none">#{row.position ?? index + 1}</p>
                    <p className="text-[9px] text-muted uppercase tracking-[0.2em] mt-1">Status: Waiting</p>
                  </div>
                  <button
                    type="button"
                    disabled={leaveWaitlist.isPending}
                    onClick={() => row.book_id && handleLeaveWaitlist(row.book_id)}
                    className="flex items-center gap-1.5 rounded-lg border border-border bg-white/4 px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-muted transition-all hover:border-danger/30 hover:bg-danger/10 hover:text-danger active:scale-95 disabled:opacity-50"
                  >
                    {leaveWaitlist.isPending ? <Loader2 size={12} className="animate-spin" /> : <X size={14} />}
                    Leave
                  </button>
                </div>
              </article>
            ))}
          </div>
        )
      ) : null}
    </main>
  )
}
