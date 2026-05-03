import { BookOpen, Loader2, X, Trash2, Clock } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../hooks/useAuth'
import { useCancelRequest } from '../hooks/useBorrow'
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

  const handleCancel = async (borrowId: number) => {
    if (!user?.id) return
    if (!window.confirm('Are you sure you want to cancel this borrow request?')) return

    try {
      await cancelRequest.mutateAsync({ borrowId, userId: user.id })
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
    <main className="min-h-screen bg-void px-8 py-7">
      <header className="mb-8">
        <h1 className="font-display text-[32px] italic text-white">My Shelf</h1>
        <p className="text-sm text-muted">Your books, borrows and reading history</p>
      </header>

      <div className="mb-6 flex flex-wrap gap-2">
        {[
          { id: 'active' as const, label: `Active (${activeCount})` },
          { id: 'history' as const, label: 'History' },
          { id: 'waitlist' as const, label: `Waitlist (${waitlistCount})` },
        ].map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={`rounded-lg px-4 py-2 text-sm transition duration-150 ${
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
        <section className="grid place-items-center rounded-card border border-border bg-surface py-16 text-center">
          <BookOpen size={48} className="text-ghost" />
          <p className="mt-3 text-[15px] text-white/80">No active borrows</p>
          <p className="text-[13px] text-muted">Browse the library to request your first book</p>
          <button type="button" onClick={() => navigate('/discover')} className="mt-3 text-sm text-accent transition-colors duration-150 hover:text-white">
            Go to Discover →
          </button>
        </section>
      ) : null}

      {!currentLoading && !currentError && tab === 'active' ? (
        <div className="space-y-3">
          {activeCards.map(({ row, ratio, daysLeft }) => {
            const author = row.books?.authors?.[0]?.authors?.name ?? 'Unknown Author'
            const daysLabel = daysLeft === null ? '' : daysLeft >= 0 ? `${daysLeft} days left` : `${Math.abs(daysLeft)} days overdue`
            const progressColor = ratio < 70 ? 'bg-ok' : ratio <= 90 ? 'bg-warn' : 'bg-danger'
            const gradient = FALLBACK_GRADIENTS[(row.books?.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length]

            return (
              <article key={row.id} className="flex gap-4 rounded-card border border-border bg-surface px-6 py-5">
                <div className="relative h-[90px] w-[60px] overflow-hidden rounded-md border border-border bg-white/8">
                  <div className="absolute inset-0 grid place-items-center font-display text-lg italic text-white" style={{ background: gradient }}>
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

                <div className="flex-1">
                  <h3 className="font-display text-base italic text-white">{row.books?.title ?? 'Unknown Book'}</h3>
                  <p className="text-xs text-muted">{author}</p>

                  <div className="mt-2 flex items-center gap-2">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[11px] ${statusChip(row.status)}`}>
                      {row.status === 'requested' ? 'Awaiting Confirmation' : row.status === 'active' ? 'Borrowed' : 'OVERDUE'}
                    </span>
                    {row.fine_amount && row.fine_amount > 0 ? (
                      <span className="inline-flex rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-mono text-danger">
                        Fine: ₹{row.fine_amount} ({row.fine_status})
                      </span>
                    ) : null}
                  </div>

                  {row.status !== 'requested' ? (
                    <>
                      <div className="mt-2 h-[3px] w-full rounded bg-white/10">
                        <div className={`h-full rounded ${progressColor}`} style={{ width: `${ratio}%` }} />
                      </div>
                      <div className="mt-1 flex items-center justify-between">
                        <p className="text-[11px] text-muted">{daysLabel}</p>
                        <CountdownTimer dueDate={row.due_date} />
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-muted">Visit library counter to collect</p>
                  )}
                </div>

                <div className="flex flex-col items-end gap-3 self-start">
                  <div className="rounded bg-white/7 px-2 py-1 font-mono text-[10px] text-muted">
                    Copy #{row.copy_id ?? '—'}
                  </div>
                  {row.status === 'requested' && (
                    <button
                      type="button"
                      onClick={() => handleCancel(row.id)}
                      disabled={cancelRequest.isPending}
                      className="flex items-center gap-1 rounded-md border border-border bg-white/4 px-2 py-1 text-[10px] font-semibold text-muted transition duration-150 hover:border-danger/40 hover:bg-danger/10 hover:text-danger disabled:opacity-50"
                      title="Cancel request"
                    >
                      {cancelRequest.isPending ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                      Cancel
                    </button>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : null}

      {!currentLoading && !currentError && tab === 'history' ? (
        historyRows.length === 0 ? (
          <p className="text-center text-sm text-muted">No reading history yet</p>
        ) : (
          <div className="space-y-3">
            {historyRows.map((row, idx) => (
              <article key={idx} className="rounded-card border border-border bg-surface px-6 py-5 flex items-center justify-between">
                <div>
                  <h3 className="font-display text-base italic text-white">{row.title ?? 'Unknown Book'}</h3>
                  <p className="mt-1 text-xs text-muted">
                    {row.status === 'returned' 
                      ? `Borrowed ${row.borrowed_at ? new Date(row.borrowed_at).toLocaleDateString() : '—'} · Returned ${row.returned_at ? new Date(row.returned_at).toLocaleDateString() : '—'}`
                      : 'Request was cancelled'
                    }
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  {row.fine_amount && row.fine_amount > 0 ? (
                    <span className="rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-mono text-danger">
                      Fine: ₹{row.fine_amount} ({row.fine_status})
                    </span>
                  ) : null}
                  <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                    row.status === 'returned' ? 'bg-ok/12 text-ok' : 'bg-white/8 text-muted'
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
          <p className="text-center text-sm text-muted">You're not waiting for any books</p>
        ) : (
          <div className="space-y-3">
            {waitlistRows.map((row, index) => (
              <article key={row.id} className="flex items-center justify-between rounded-card border border-border bg-surface px-6 py-5">
                <div>
                  <h3 className="font-display text-base italic text-white">{row.books?.title ?? 'Unknown Book'}</h3>
                  <p className="text-xs text-muted">Joined {row.joined_at ? new Date(row.joined_at).toLocaleDateString() : '—'}</p>
                </div>

                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm text-waitlist">#{row.position ?? index + 1} in queue</span>
                  <button
                    type="button"
                    onClick={async () => {
                      await supabase.from('waitlist').delete().eq('id', row.id)
                      await queryClient.invalidateQueries({ queryKey: ['shelf-waitlist', user?.id] })
                      await queryClient.invalidateQueries({ queryKey: ['books'] })
                      await queryClient.invalidateQueries({ queryKey: ['trending'] })
                    }}
                    className="rounded border border-border p-1.5 text-muted transition duration-150 hover:border-danger/40 hover:text-danger"
                  >
                    <X size={14} />
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
