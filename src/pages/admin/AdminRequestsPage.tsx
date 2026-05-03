import { CheckCircle, RefreshCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { FunctionReturn, ViewRow } from '../../types/db'

// Typed from database.types.ts pending_requests view
// Columns: borrow_id, username, email, title, book_id, requested_at
type PendingRequest = ViewRow<'pending_requests'>

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

export default function AdminRequestsPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [toast, setToast] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<number | null>(null)

  const { data: requests = [], isFetching, refetch } = useQuery<PendingRequest[]>({
    queryKey: ['pending_requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_requests')
        .select('*')
        .order('requested_at', { ascending: true })
        .returns<PendingRequest[]>()
      if (error) throw error
      return (data ?? []) as PendingRequest[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('borrow-request-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_history' }, (payload) => {
        const row = payload.new as { status?: string }
        if (payload.eventType === 'DELETE' || row.status === 'requested' || row.status === 'active') {
          void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
          setToast(row.status === 'requested' ? 'New borrow request received' : 'Borrow requests updated')
        }
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 4000)
    return () => window.clearTimeout(timer)
  }, [toast])

  if (!isAdmin) return <Navigate to="/discover" replace />

  const confirm = async (row: PendingRequest) => {
    if (!row.borrow_id) return
    setBusyId(row.borrow_id)
    const { data, error } = await supabase.rpc('confirm_borrow', { p_borrow_id: row.borrow_id })
    setBusyId(null)

    if (error) {
      setToast(error.message)
      return
    }

    const response = (data ?? '') as FunctionReturn<'confirm_borrow'>
    setToast(response || `✓ Book handed over to ${row.username ?? 'member'}`)
    void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
  }

  // Cancel = delete the borrow_history row (no 'cancelled' status in schema)
  const cancel = async (row: PendingRequest) => {
    if (!row.borrow_id) return
    setBusyId(row.borrow_id)
    const { error } = await supabase
      .from('borrow_history')
      .delete()
      .eq('id', row.borrow_id)
    setBusyId(null)

    if (error) {
      setToast(error.message)
      return
    }

    setToast('Request cancelled')
    void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
  }

  return (
    <main className="min-h-screen bg-void" style={{ padding: '28px 32px' }}>
      <header className="mb-5 flex items-center justify-between">
        <div>
          <h1 className="font-display text-[28px] italic text-white">Borrow Requests</h1>
          <span className="mt-1 inline-flex rounded-full bg-warn/20 px-2 py-0.5 text-sm text-warn">
            {requests.length} pending
          </span>
        </div>
        <button
          type="button"
          onClick={() => void refetch()}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted transition-colors duration-[150ms] hover:bg-white/6"
        >
          <RefreshCw size={14} className={isFetching ? 'animate-spin' : ''} /> Refresh
        </button>
      </header>

      <section className="overflow-hidden rounded-card border border-border bg-surface">
        <div className="grid grid-cols-[2fr_2fr_1fr_1.4fr] bg-white/4 px-5 py-3 text-xs font-semibold uppercase tracking-[0.05em] text-muted">
          <p>Student</p>
          <p>Book</p>
          <p>Requested At</p>
          <p>Action</p>
        </div>

        {requests.length === 0 ? (
          <div className="grid place-items-center py-14 text-center">
            <CheckCircle size={48} className="text-ok" />
            <p className="mt-3 text-base text-white">All caught up!</p>
            <p className="text-sm text-muted">No pending borrow requests</p>
          </div>
        ) : (
          requests.map((row) => (
            <div
              key={row.borrow_id}
              className="grid grid-cols-[2fr_2fr_1fr_1.4fr] items-center border-b border-border/60 px-5 py-4 hover:bg-white/2"
            >
              <div>
                <p className="text-sm text-white">{row.username ?? '—'}</p>
                <p className="text-xs text-muted">{row.email ?? '—'}</p>
              </div>

              <div className="flex items-center gap-2">
                {/* book_details view doesn't expose cover_url from pending_requests — show letter avatar */}
                <div
                  className="flex h-[54px] w-9 items-center justify-center overflow-hidden rounded bg-white/10 font-display text-lg italic text-white"
                  style={{
                    background: FALLBACK_GRADIENTS[(row.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length],
                  }}
                >
                  {(row.title ?? 'B')[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="max-w-[220px] truncate text-sm text-white">{row.title ?? '—'}</p>
                  <span className="font-mono rounded-full bg-white/8 px-2 py-0.5 text-[10px] text-muted">
                    ID #{row.book_id ?? '—'}
                  </span>
                </div>
              </div>

              <p className="font-mono text-xs text-muted">
                {row.requested_at ? new Date(row.requested_at).toLocaleString() : '—'}
              </p>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void confirm(row)}
                  disabled={busyId === row.borrow_id}
                  className="h-9 rounded-lg bg-accent px-3 text-sm font-semibold text-white disabled:opacity-60 transition-colors duration-[150ms]"
                >
                  {busyId === row.borrow_id ? '...' : 'Confirm Handover'}
                </button>
                <button
                  type="button"
                  onClick={() => void cancel(row)}
                  disabled={busyId === row.borrow_id}
                  className="h-9 rounded-lg border border-danger/35 px-3 text-sm text-danger disabled:opacity-60 transition-colors duration-[150ms]"
                >
                  Cancel
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      {toast ? (
        <div className="fixed bottom-6 right-6 z-[200] rounded-card border border-border bg-surface px-4 py-3 text-sm text-white shadow-2xl shadow-black/50">
          {toast}
        </div>
      ) : null}
    </main>
  )
}
