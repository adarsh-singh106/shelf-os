import { CheckCircle, RefreshCw, X } from 'lucide-react'
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
    if (!window.confirm(`Confirm handover of "${row.title}" to ${row.username}?`)) return
    
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

  const reject = async (row: PendingRequest) => {
    if (!row.borrow_id) return
    if (!window.confirm(`Are you sure you want to reject the request for "${row.title}"?`)) return

    setBusyId(row.borrow_id)
    const { error } = await supabase.rpc('reject_borrow', { 
      p_borrow_id: row.borrow_id 
    })
    setBusyId(null)

    if (error) {
      setToast(error.message)
      return
    }

    setToast('Request rejected successfully')
    void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
  }

  return (
    <main className="min-h-screen bg-void px-4 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-12">
      <header className="mb-10 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-warn">
            <RefreshCw size={12} className={isFetching ? 'animate-spin' : ''} />
            Queue Management
          </div>
          <h1 className="font-display text-4xl italic text-white lg:text-5xl">Borrow Requests</h1>
          <p className="max-w-md text-sm text-muted">
            Process incoming borrow requests. Verify member eligibility and authorize physical handovers.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <span className="inline-flex items-center gap-2 rounded-2xl border border-warn/20 bg-warn/5 px-4 py-2 text-xs font-bold text-warn shadow-lg shadow-warn/5">
            <div className="h-1.5 w-1.5 rounded-full bg-warn animate-pulse" />
            {requests.length} Requests Pending
          </span>
          <button
            type="button"
            onClick={() => void refetch()}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/5 bg-surface text-muted transition-all hover:bg-white/10 hover:text-white active:scale-95 shadow-inner"
            title="Refresh Queue"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
          </button>
        </div>
      </header>

      <section className="overflow-hidden rounded-[32px] border border-border bg-surface/50 backdrop-blur-md">
        {requests.length === 0 ? (
          <div className="flex h-[400px] flex-col items-center justify-center text-center p-8">
            <div className="mb-6 rounded-full bg-ok/10 p-6 text-ok">
              <CheckCircle size={48} strokeWidth={1.5} />
            </div>
            <h3 className="text-xl font-display italic text-white">Queue Cleared</h3>
            <p className="mt-2 text-sm text-muted max-w-xs">
              All incoming borrow requests have been processed. New requests will appear here in real-time.
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white/4 text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border">
                    <th className="px-8 py-5">Student Member</th>
                    <th className="px-8 py-5">Requested Volume</th>
                    <th className="px-8 py-5">Timestamp</th>
                    <th className="px-8 py-5 text-right">Verification</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {requests.map((row) => (
                    <tr key={row.borrow_id} className="hover:bg-white/2 transition-colors group">
                      <td className="px-8 py-5">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent font-black text-xs border border-accent/20">
                            {row.username?.[0]?.toUpperCase() ?? 'U'}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white leading-tight">{row.username ?? '—'}</p>
                            <p className="truncate text-[11px] text-muted mt-0.5">{row.email ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <div className="flex items-center gap-3">
                          <div
                            className="flex h-12 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-white/5 font-display text-lg italic text-white shadow-lg"
                            style={{
                              background: FALLBACK_GRADIENTS[(row.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length],
                            }}
                          >
                            {(row.title ?? 'B')[0]?.toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors leading-tight">{row.title ?? '—'}</p>
                            <p className="text-[10px] text-muted mt-0.5 font-mono uppercase">ID #{row.book_id ?? '—'}</p>
                          </div>
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <div className="font-mono text-[11px] text-muted flex flex-col">
                          <span className="text-white/80">{row.requested_at ? new Date(row.requested_at).toLocaleDateString() : '—'}</span>
                          <span className="text-[9px] uppercase tracking-tighter">{row.requested_at ? new Date(row.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                        </div>
                      </td>

                      <td className="px-8 py-5">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => void confirm(row)}
                            disabled={busyId === row.borrow_id}
                            className="h-9 px-4 rounded-xl bg-accent text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-accent/20"
                          >
                            {busyId === row.borrow_id ? '...' : 'Authorize'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void reject(row)}
                            disabled={busyId === row.borrow_id}
                            className="h-9 w-9 flex items-center justify-center rounded-xl border border-danger/30 text-danger transition-all hover:bg-danger/10 active:scale-95 disabled:opacity-50"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-border/40">
              {requests.map((row) => (
                <div key={row.borrow_id} className="p-6 space-y-5 hover:bg-white/2 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-white font-black text-sm">
                        {row.username?.[0]?.toUpperCase() ?? 'U'}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-white">{row.username ?? '—'}</p>
                        <p className="truncate text-[10px] text-muted">{row.email ?? '—'}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-mono text-white/80">{row.requested_at ? new Date(row.requested_at).toLocaleDateString() : '—'}</p>
                      <p className="text-[9px] font-mono text-muted uppercase">{row.requested_at ? new Date(row.requested_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 bg-white/5 rounded-2xl p-4">
                    <div
                      className="flex h-16 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-white/5 font-display text-xl italic text-white shadow-xl"
                      style={{
                        background: FALLBACK_GRADIENTS[(row.title?.charCodeAt(0) || 0) % FALLBACK_GRADIENTS.length],
                      }}
                    >
                      {(row.title ?? 'B')[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-sm font-bold text-white leading-tight">{row.title ?? '—'}</p>
                      <p className="text-[10px] text-muted mt-1.5 font-mono uppercase bg-white/5 inline-block px-1.5 py-0.5 rounded">ID #{row.book_id ?? '—'}</p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => void confirm(row)}
                      disabled={busyId === row.borrow_id}
                      className="flex-1 h-11 flex items-center justify-center rounded-xl bg-accent text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-accent/20"
                    >
                      {busyId === row.borrow_id ? 'Processing...' : 'Authorize Handover'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void reject(row)}
                      disabled={busyId === row.borrow_id}
                      className="h-11 w-11 flex items-center justify-center rounded-xl border border-danger/30 text-danger"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {toast && (
        <div className="fixed bottom-8 right-8 z-[200] flex items-center gap-3 overflow-hidden rounded-2xl border border-accent/20 bg-surface p-4 shadow-2xl animate-in slide-in-from-right-10 duration-300">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-accent/10 text-accent">
            <RefreshCw size={14} className="animate-spin" />
          </div>
          <p className="text-sm font-bold text-white pr-4">{toast}</p>
        </div>
      )}
    </main>
  )
}
