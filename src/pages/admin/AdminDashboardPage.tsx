import { ArrowRight, ClipboardCheck, PackagePlus, ScrollText, Users, AlertCircle, Book, CheckCircle, Clock } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuditLog, usePendingRequests, useLibraryStats } from '../../hooks/useAdmin'

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

export default function AdminDashboardPage() {
  const queryClient = useQueryClient()
  const { data: pending = [] } = usePendingRequests()
  const { data: audit = [] } = useAuditLog()
  const { data: stats, isLoading: statsLoading } = useLibraryStats()
  const [lastUpdated, setLastUpdated] = useState(new Date())
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 3000)
    return () => clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_history' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
        void queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
        setLastUpdated(new Date())
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['auditLog'] })
        setLastUpdated(new Date())
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  const confirmRequest = async (borrowId: number) => {
    const { error } = await supabase.rpc('confirm_borrow', { p_borrow_id: borrowId })
    if (error) {
      setToast(`Error: ${error.message}`)
    } else {
      setToast('✓ Borrow request confirmed')
      void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
      void queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
    }
  }

  return (
    <div className="space-y-8 pb-10">
      {/* Header & Stats */}
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-accent">Control Center</p>
          <h1 className="mt-1 font-display text-4xl italic text-white">Librarian Overview</h1>
          <p className="mt-1 text-sm text-muted">
            Last synced at {lastUpdated.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            to="/admin/inventory"
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-accent/90"
          >
            <PackagePlus size={16} />
            Add Book
          </Link>
          <button
            onClick={() => {
              void queryClient.invalidateQueries()
              setLastUpdated(new Date())
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm text-white transition hover:bg-white/5"
          >
            <Clock size={16} className="text-muted" />
            Refresh Data
          </button>
        </div>
      </header>

      {/* Metrics Row */}
      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pending Requests', value: pending.length, icon: ClipboardCheck, color: 'text-warn', bg: 'bg-warn/10', border: 'border-warn/20', link: '/admin/transactions?tab=pending' },
          { label: 'Active Borrows', value: stats?.activeBorrows ?? 0, icon: Book, color: 'text-accent', bg: 'bg-accent/10', border: 'border-accent/20', link: '/admin/transactions?tab=active' },
          { label: 'Overdue Books', value: stats?.overdueCount ?? 0, icon: AlertCircle, color: 'text-danger', bg: 'bg-danger/10', border: 'border-danger/20', link: '/admin/transactions?tab=overdue' },
          { label: 'Total Members', value: stats?.totalMembers ?? 0, icon: Users, color: 'text-ok', bg: 'bg-ok/10', border: 'border-ok/20', link: '/admin/members' },
        ].map((stat) => (
          <Link
            key={stat.label}
            to={stat.link}
            className={`flex flex-col rounded-card border ${stat.border} ${stat.bg} p-5 transition-transform hover:-translate-y-1`}
          >
            <div className="flex items-center justify-between">
              <stat.icon size={20} className={stat.color} />
              {stat.value > 0 && stat.color === 'text-danger' && (
                <span className="flex h-2 w-2 rounded-full bg-danger animate-pulse" />
              )}
            </div>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted">{stat.label}</p>
            <p className="mt-1 font-display text-3xl italic text-white">
              {statsLoading && stat.label !== 'Pending Requests' ? '...' : stat.value}
            </p>
          </Link>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main Column: Pending Requests Queue */}
        <section className="lg:col-span-2">
          <div className="mb-4 flex items-center justify-between px-2">
            <h2 className="font-display text-xl italic text-white">Pending Requests Queue</h2>
            <Link to="/admin/transactions?tab=pending" className="text-xs text-accent hover:underline">View all requests</Link>
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-surface">
            {pending.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-ok/10 text-ok">
                  <CheckCircle size={24} />
                </div>
                <p className="mt-4 text-sm font-medium text-white">All caught up!</p>
                <p className="mt-1 text-xs text-muted">No pending borrow requests to process.</p>
              </div>
            ) : (
              <div className="divide-y divide-border/50">
                {pending.slice(0, 5).map((req) => (
                  <div key={req.borrow_id} className="flex items-center justify-between p-4 hover:bg-white/2 transition">
                    <div className="flex items-center gap-4">
                      <div
                        className="flex h-12 w-8 shrink-0 items-center justify-center rounded bg-white/10 font-display text-sm italic text-white"
                        style={{ background: FALLBACK_GRADIENTS[(req.title?.charCodeAt(0) || 0) % 8] }}
                      >
                        {req.title?.[0]}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-white">{req.title}</p>
                        <p className="truncate text-xs text-muted">Requested by {req.username}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => req.borrow_id && confirmRequest(req.borrow_id)}
                        className="rounded-lg bg-accent/10 px-3 py-1.5 text-xs font-bold text-accent transition hover:bg-accent hover:text-white"
                      >
                        Confirm
                      </button>
                    </div>
                  </div>
                ))}
                {pending.length > 5 && (
                  <Link to="/admin/transactions?tab=pending" className="block py-3 text-center text-xs text-muted hover:bg-white/2 hover:text-white">
                    And {pending.length - 5} more requests...
                  </Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Right Column: Quick Links & Recent Audit */}
        <section className="space-y-6">
          <div>
            <h2 className="mb-4 px-2 font-display text-xl italic text-white">Management</h2>
            <div className="grid gap-2">
              {[
                { label: 'Manage Members', to: '/admin/members', icon: Users, desc: 'Search and update profiles' },
                { label: 'System Audit', to: '/admin/audit', icon: ScrollText, desc: 'Realtime database logs' },
                { label: 'Book Inventory', to: '/admin/inventory', icon: PackagePlus, desc: 'Catalog management' },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center gap-4 rounded-card border border-border bg-surface p-4 transition hover:border-accent/50 hover:bg-accent/5"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted transition group-hover:bg-accent/20 group-hover:text-accent">
                    <link.icon size={18} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-white">{link.label}</p>
                    <p className="truncate text-xs text-muted">{link.desc}</p>
                  </div>
                  <ArrowRight size={14} className="ml-auto text-muted transition group-hover:translate-x-1 group-hover:text-accent" />
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-4 flex items-center justify-between px-2">
              <h2 className="font-display text-xl italic text-white">Recent Audit</h2>
              <Link to="/admin/audit" className="text-xs text-accent hover:underline">View Log</Link>
            </div>
            <div className="space-y-2">
              {audit.slice(0, 4).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border/50 bg-surface/50 p-3 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`font-bold uppercase tracking-tighter ${
                      entry.action === 'INSERT' ? 'text-ok' : entry.action === 'DELETE' ? 'text-danger' : 'text-warn'
                    }`}>
                      {entry.action}
                    </span>
                    <span className="text-[10px] text-muted">{new Date(entry.changed_at!).toLocaleTimeString()}</span>
                  </div>
                  <p className="text-white truncate">
                    <span className="text-muted">on</span> {entry.table_name}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      {toast && (
        <div className="fixed bottom-6 right-6 z-50 animate-in fade-in slide-in-from-bottom-4 rounded-card border border-border bg-surface px-4 py-3 text-sm text-white shadow-2xl">
          {toast}
        </div>
      )}
    </div>
  )
}
