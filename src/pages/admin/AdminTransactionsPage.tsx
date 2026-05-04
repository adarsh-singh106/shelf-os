import { 
  CheckCircle, RefreshCw, Clock, AlertCircle, Book, Search, Check, X, 
  Info, Calendar, Hash, ArrowUpRight, ShieldCheck, CreditCard, 
  LayoutGrid, List
} from 'lucide-react'
import { useState, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import ConfirmModal from '../../components/shared/ConfirmModal'
import type { ViewRow, TableRow } from '../../types/db'

type PendingRequest = ViewRow<'pending_requests'>
type OverdueBorrow = ViewRow<'overdue_borrows'> & { id?: number, book_id?: number, user_id?: string, fine_amount?: number, fine_status?: string, daily_fine_rate?: number, borrowed_at?: string }
type ActiveBorrow = TableRow<'borrow_history'> & { 
  books: { title: string, cover_url: string | null } | null,
  users: { username: string, email: string, tier?: { daily_fine_rate: number } } | null
}

interface TransactionHandlers {
  handleConfirmHandover: (borrowId: number, title: string, username: string) => void
  handleRejectRequest: (borrowId: number, title: string) => void
  handleReturn: (book_id: number, user_id: string, title: string) => void
  handlePayFine: (borrowId: number, username: string, amount: number) => void
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

type Tab = 'pending' | 'active' | 'overdue'
type ViewMode = 'grid' | 'list'

interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

export default function AdminTransactionsPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const activeTab = (searchParams.get('tab') as Tab) || 'pending'
  
  const [toasts, setToasts] = useState<Toast[]>([])
  const [busyId, setBusyId] = useState<string | number | null>(null)
  const [search, setSearch] = useState('')
  const [viewMode, setViewMode] = useState<ViewMode>('grid')

  // Modal State
  const [confirmConfig, setConfirmConfig] = useState<{
    isOpen: boolean
    title: string
    message: string
    onConfirm: () => void
    variant: 'danger' | 'accent' | 'ok'
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
    variant: 'accent'
  })

  const addToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = crypto.randomUUID()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(current => current.filter(t => t.id !== id))
    }, 4000)
  }

  // Queries
  const { data: pending = [], isFetching: fetchingPending, refetch: refetchPending } = useQuery<PendingRequest[]>({
    queryKey: ['admin-transactions-pending'],
    enabled: activeTab === 'pending',
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

  const { data: active = [], isFetching: fetchingActive, refetch: refetchActive } = useQuery<ActiveBorrow[]>({
    queryKey: ['admin-transactions-active'],
    enabled: activeTab === 'active',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrow_history')
        .select('*, books(title, cover_url), users(username, email, tier:membership_tiers(daily_fine_rate))')
        .eq('status', 'active')
        .order('borrowed_at', { ascending: false })
      if (error) throw error
      return (data as unknown as ActiveBorrow[]) ?? []
    },
  })

  const { data: overdue = [], isFetching: fetchingOverdue, refetch: refetchOverdue } = useQuery<OverdueBorrow[]>({
    queryKey: ['admin-transactions-overdue'],
    enabled: activeTab === 'overdue',
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrow_history')
        .select('*, books(title, cover_url), users(username, email, tier:membership_tiers(daily_fine_rate))')
        .eq('status', 'overdue')
        .order('due_date', { ascending: true })
      
      if (error) throw error
      
      const rows = data as unknown as (TableRow<'borrow_history'> & { 
        books: { title: string, cover_url: string | null } | null,
        users: { username: string, email: string, tier: { daily_fine_rate: number } | null } | null
      })[]

      return rows.map(row => ({
        id: row.id,
        book_id: row.book_id,
        user_id: row.user_id,
        title: row.books?.title,
        username: row.users?.username,
        email: row.users?.email,
        due_date: row.due_date,
        borrowed_at: row.borrowed_at,
        fine_amount: row.fine_amount,
        fine_status: row.fine_status,
        daily_fine_rate: row.users?.tier?.daily_fine_rate || 10,
        overdue_by: 'N/A'
      })) as OverdueBorrow[]
    },
  })

  const isFetching = fetchingPending || fetchingActive || fetchingOverdue
  const refetch = activeTab === 'pending' ? refetchPending : activeTab === 'active' ? refetchActive : refetchOverdue

  // Handlers
  const handleConfirmHandover = (borrowId: number, title: string, username: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Authorize Handover',
      message: `You are about to hand over "${title}" to ${username}. This starts the official loan period. Confirm physical handover?`,
      variant: 'accent',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        setBusyId(borrowId)
        const { error } = await supabase.rpc('confirm_borrow', { p_borrow_id: borrowId })
        setBusyId(null)
        if (error) return addToast(error.message, 'error')
        addToast(`Successfully authorized handover for ${username}`)
        void queryClient.invalidateQueries({ queryKey: ['admin-transactions-pending'] })
        void queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
      }
    })
  }

  const handleRejectRequest = (borrowId: number, title: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Reject Request',
      message: `Are you sure you want to decline the request for "${title}"? This cannot be reversed.`,
      variant: 'danger',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        setBusyId(borrowId)
        const { error } = await supabase.rpc('reject_borrow', { p_borrow_id: borrowId })
        setBusyId(null)
        if (error) return addToast(error.message, 'error')
        addToast('Request declined', 'info')
        void queryClient.invalidateQueries({ queryKey: ['admin-transactions-pending'] })
        void queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
      }
    })
  }

  const handleReturn = (book_id: number, user_id: string, title: string) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Process Return',
      message: `Scanning in "${title}". Any accrued penalties will be finalized. Continue?`,
      variant: 'ok',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        setBusyId(`${book_id}-${user_id}`)
        try {
          const { data, error } = await supabase.rpc('return_book', { p_book_id: book_id, p_user_id: user_id })
          if (error) throw error
          addToast(data === 'RETURNED_WITH_FINE' ? '✓ Book returned. Penalty recorded.' : '✓ Book returned successfully.')
          void queryClient.invalidateQueries({ queryKey: ['admin-transactions-active'] })
          void queryClient.invalidateQueries({ queryKey: ['admin-transactions-overdue'] })
          void queryClient.invalidateQueries({ queryKey: ['libraryStats'] })
        } catch (err) {
          addToast((err as Error).message, 'error')
        } finally {
          setBusyId(null)
        }
      }
    })
  }

  const handlePayFine = (borrowId: number, username: string, amount: number) => {
    setConfirmConfig({
      isOpen: true,
      title: 'Clear Penalty',
      message: `Record payment of ₹${amount} from ${username}? This will clear their record.`,
      variant: 'ok',
      onConfirm: async () => {
        setConfirmConfig(prev => ({ ...prev, isOpen: false }))
        setBusyId(borrowId)
        try {
          const { error } = await supabase.from('borrow_history').update({ fine_status: 'paid' }).eq('id', borrowId)
          if (error) throw error
          addToast(`✓ Penalty cleared for ${username}`)
          void queryClient.invalidateQueries({ queryKey: ['admin-transactions-overdue'] })
        } catch (err) {
          addToast((err as Error).message, 'error')
        } finally {
          setBusyId(null)
        }
      }
    })
  }

  const filteredData = useMemo(() => {
    const s = search.toLowerCase().trim()
    const raw: (PendingRequest | ActiveBorrow | OverdueBorrow)[] = 
      activeTab === 'pending' ? pending : activeTab === 'active' ? active : overdue
    
    return raw.filter(r => {
      const isAct = 'books' in r && r.status === 'active'
      const t = isAct ? (r as ActiveBorrow).books?.title : (r as PendingRequest | OverdueBorrow).title
      const u = isAct ? (r as ActiveBorrow).users?.username : (r as PendingRequest | OverdueBorrow).username
      const e = isAct ? (r as ActiveBorrow).users?.email : (r as PendingRequest | OverdueBorrow).email
      return t?.toLowerCase().includes(s) || u?.toLowerCase().includes(s) || e?.toLowerCase().includes(s)
    })
  }, [search, activeTab, pending, active, overdue])

  if (!isAdmin) return <Navigate to="/discover" replace />

  return (
    <main className="min-h-screen bg-void px-4 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-12">
      <header className="mb-10 flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent">
            <ShieldCheck size={12} />
            Librarian Command
          </div>
          <h1 className="font-display text-4xl italic text-white lg:text-5xl">Inventory Flow</h1>
          <p className="max-w-md text-sm leading-relaxed text-muted">
            Orchestrate the movement of knowledge. Verify handovers, process returns, and manage member obligations.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative group flex-1 sm:flex-none">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by title, student..."
              className="h-12 w-full sm:w-64 rounded-2xl border border-white/5 bg-surface pl-11 pr-4 text-sm text-white outline-none ring-accent/20 transition-all focus:border-accent/40 focus:ring-4 lg:w-80 shadow-inner"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="flex rounded-2xl border border-white/5 bg-surface p-1 shadow-inner">
              <button 
                onClick={() => setViewMode('grid')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'}`}
                title="Grid View"
              >
                <LayoutGrid size={18} />
              </button>
              <button 
                onClick={() => setViewMode('list')}
                className={`p-2.5 rounded-xl transition-all ${viewMode === 'list' ? 'bg-white/10 text-white shadow-lg' : 'text-muted hover:text-white'}`}
                title="List View"
              >
                <List size={18} />
              </button>
            </div>
            <button
              onClick={() => void refetch()}
              className="flex h-12 w-12 items-center justify-center rounded-2xl border border-white/5 bg-surface text-muted transition-all hover:bg-white/10 hover:text-white active:scale-95 shadow-inner"
              title="Refresh Records"
            >
              <RefreshCw size={18} className={isFetching ? 'animate-spin text-accent' : ''} />
            </button>
          </div>
        </div>
      </header>

      {/* Modern Tabs */}
      <nav className="mb-8 flex gap-3 overflow-x-auto pb-4 scrollbar-hide">
        {[
          { id: 'pending', label: 'Incoming Requests', icon: Clock, color: 'text-warn', bg: 'bg-warn/10', count: pending.length },
          { id: 'active', label: 'In Circulation', icon: Book, color: 'text-accent', bg: 'bg-accent/10', count: active.length },
          { id: 'overdue', label: 'Overdue Penalties', icon: AlertCircle, color: 'text-danger', bg: 'bg-danger/10', count: overdue.length },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSearchParams({ tab: tab.id })}
            className={`group relative flex shrink-0 items-center gap-3 rounded-2xl border px-6 py-3.5 text-sm font-bold transition-all ${
              activeTab === tab.id 
                ? 'border-accent/20 bg-accent/5 text-white shadow-[0_0_25px_rgba(79,142,247,0.1)]' 
                : 'border-white/5 bg-surface text-muted hover:border-white/10 hover:bg-white/5 hover:text-white'
            }`}
          >
            <tab.icon size={18} className={activeTab === tab.id ? tab.color : 'text-muted/60 transition-colors group-hover:text-white'} />
            <span className="whitespace-nowrap">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-lg px-1.5 text-[10px] font-black ${
                activeTab === tab.id ? tab.bg + ' ' + tab.color : 'bg-white/5 text-muted'
              }`}>
                {tab.count}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute -bottom-[1px] left-1/2 h-1 w-6 -translate-x-1/2 rounded-full bg-accent animate-in fade-in zoom-in-50" />
            )}
          </button>
        ))}
      </nav>

      {/* Results Section */}
      {filteredData.length === 0 ? (
        <div className="flex h-[400px] flex-col items-center justify-center rounded-[40px] border border-dashed border-white/10 bg-surface/30 text-center p-8">
          <div className="mb-6 rounded-full bg-white/5 p-8 text-muted/30">
            <ShieldCheck size={64} strokeWidth={1} />
          </div>
          <h3 className="text-2xl font-display italic text-white">System Clear</h3>
          <p className="mt-3 text-sm text-muted max-w-[280px] leading-relaxed">
            No active entries found in the {activeTab} queue matching your criteria.
          </p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 animate-in fade-in duration-500">
          {filteredData.map((row, idx) => (
            <TransactionCard 
              key={idx} 
              row={row} 
              activeTab={activeTab} 
              busyId={busyId} 
              handlers={{ handleConfirmHandover, handleRejectRequest, handleReturn, handlePayFine }} 
            />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-[32px] border border-white/5 bg-surface/50 backdrop-blur-md animate-in fade-in duration-500 overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="border-b border-white/5 bg-white/2 text-[10px] font-bold uppercase tracking-widest text-muted">
                <th className="px-8 py-6">Item Details</th>
                <th className="px-8 py-6">Member</th>
                <th className="px-8 py-6">Temporal Status</th>
                <th className="px-8 py-6 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredData.map((row, idx) => (
                <TransactionRow 
                  key={idx} 
                  row={row} 
                  activeTab={activeTab} 
                  busyId={busyId} 
                  handlers={{ handleConfirmHandover, handleRejectRequest, handleReturn, handlePayFine }} 
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Notifications */}
      <div className="fixed bottom-8 right-8 z-[200] flex flex-col gap-3">
        {toasts.map(toast => (
          <div 
            key={toast.id} 
            className={`group flex items-center gap-4 overflow-hidden rounded-2xl border border-white/10 bg-surface p-4 pr-6 shadow-2xl animate-in slide-in-from-right-10 duration-300 ${
              toast.type === 'error' ? 'border-danger/20' : toast.type === 'info' ? 'border-accent/20' : 'border-ok/20'
            }`}
          >
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              toast.type === 'error' ? 'bg-danger/10 text-danger' : 
              toast.type === 'info' ? 'bg-accent/10 text-accent' : 
              'bg-ok/10 text-ok'
            }`}>
              {toast.type === 'error' ? <X size={20} /> : toast.type === 'info' ? <Info size={20} /> : <Check size={20} />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-white leading-tight">{toast.message}</p>
              <p className="text-[10px] text-muted mt-0.5 uppercase tracking-tighter">System Message • Just now</p>
            </div>
          </div>
        ))}
      </div>

      <ConfirmModal 
        isOpen={confirmConfig.isOpen}
        title={confirmConfig.title}
        message={confirmConfig.message}
        onConfirm={confirmConfig.onConfirm}
        onCancel={() => setConfirmConfig(prev => ({ ...prev, isOpen: false }))}
        variant={confirmConfig.variant}
        confirmLabel="Execute Authority"
        cancelLabel="Discard Action"
      />
    </main>
  )
}

function TransactionCard({ row, activeTab, busyId, handlers }: { row: PendingRequest | ActiveBorrow | OverdueBorrow, activeTab: Tab, busyId: string | number | null, handlers: TransactionHandlers }) {
  const isPending = activeTab === 'pending'
  const isActive = activeTab === 'active'
  const isOverdue = activeTab === 'overdue'

  const isAct = 'books' in row && row.status === 'active'
  const title = isAct ? (row as ActiveBorrow).books?.title : (row as PendingRequest | OverdueBorrow).title
  const coverUrl = isAct ? (row as ActiveBorrow).books?.cover_url : null
  const username = isAct ? (row as ActiveBorrow).users?.username : (row as PendingRequest | OverdueBorrow).username
  const email = isAct ? (row as ActiveBorrow).users?.email : (row as PendingRequest | OverdueBorrow).email
  const dateValue = isPending ? (row as PendingRequest).requested_at : isActive ? (row as ActiveBorrow).borrowed_at : (row as OverdueBorrow).due_date
  
  const overdueDays = isOverdue && dateValue ? 
    Math.max(1, Math.floor((new Date().getTime() - new Date(dateValue).getTime()) / 86400000)) : 0
  
  const dailyRate = isAct ? ((row as ActiveBorrow).users?.tier?.daily_fine_rate || 10) : 
                   isOverdue ? ((row as OverdueBorrow).daily_fine_rate || 10) : 0
  
  const fineAmount = isOverdue ? ((row as OverdueBorrow).fine_amount || (overdueDays * dailyRate)) : 0
  const fineStatus = isOverdue ? (row as OverdueBorrow).fine_status : null
  const isBusy = busyId === (isPending ? (row as PendingRequest).borrow_id : (row as ActiveBorrow | OverdueBorrow).id) || busyId === `${(row as ActiveBorrow | OverdueBorrow).book_id}-${(row as ActiveBorrow | OverdueBorrow).user_id}`

  return (
    <div className="group relative flex flex-col rounded-[28px] border border-white/5 bg-surface/50 p-5 transition-all hover:border-white/10 hover:bg-surface/80 hover:shadow-2xl">
      <div className="flex gap-4">
        <div className="relative h-32 w-24 shrink-0 overflow-hidden rounded-xl bg-white/5 shadow-2xl transition-transform group-hover:scale-[1.02]">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <div 
              className="flex h-full w-full items-center justify-center font-display text-2xl italic text-white"
              style={{ background: FALLBACK_GRADIENTS[(title?.charCodeAt(0) || 0) % 8] }}
            >
              {title?.[0]}
            </div>
          )}
          {isOverdue && (
            <div className="absolute inset-x-0 bottom-0 bg-danger/90 px-1 py-0.5 text-center text-[8px] font-black uppercase tracking-tighter text-white">
              Critical
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col justify-between py-1">
          <div className="min-w-0">
            <h4 className="line-clamp-2 text-sm font-black leading-tight text-white group-hover:text-accent transition-colors">
              {title}
            </h4>
            <div className="mt-2 flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-accent/10 text-accent">
                <Hash size={12} />
              </span>
              <span className="font-mono text-[10px] font-bold text-muted">ID: {(row as ActiveBorrow | OverdueBorrow).book_id || (row as PendingRequest).book_id}</span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-muted">
            <Calendar size={12} className="text-accent/60" />
            {dateValue ? new Date(dateValue).toLocaleDateString() : '—'}
          </div>
        </div>
      </div>

      <div className="my-5 h-px bg-white/5" />

      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/5 bg-surface text-sm font-black text-white group-hover:bg-accent group-hover:text-white transition-all">
              {username?.[0]?.toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-white">{username}</p>
              <p className="truncate text-[10px] text-muted">{email}</p>
            </div>
          </div>
          <ArrowUpRight size={16} className="text-muted/20 group-hover:text-accent transition-colors" />
        </div>

        {isOverdue && (
          <div className="rounded-2xl border border-danger/20 bg-danger/5 p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-black uppercase tracking-[0.15em] text-danger/80">Obligation Status</span>
              <span className="flex items-center gap-1 text-[10px] font-bold text-danger">
                <Clock size={10} /> {overdueDays}d Late
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted">Accrued Penalty</span>
                <span className="font-display text-xl italic text-white leading-none mt-1">₹{fineAmount}</span>
              </div>
              <span className={`rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                fineStatus === 'paid' ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-danger/20 text-danger border border-danger/30 animate-pulse'
              }`}>
                {fineStatus || 'Unsettled'}
              </span>
            </div>
          </div>
        )}

        {isActive && (
          <div className="flex items-center justify-between rounded-2xl bg-white/5 px-4 py-3">
            <span className="text-[10px] font-bold text-muted uppercase">Penalty Factor</span>
            <div className="flex items-center gap-1.5">
              <CreditCard size={12} className="text-accent" />
              <span className="text-xs font-black text-white">₹{dailyRate}<span className="text-[10px] font-normal text-muted">/day</span></span>
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-1">
          {isPending && (
            <>
              <button
                onClick={() => handlers.handleConfirmHandover((row as PendingRequest).borrow_id!, title!, username!)}
                disabled={isBusy}
                className="flex-1 h-11 flex items-center justify-center gap-2 rounded-xl bg-accent text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-accent/20"
              >
                {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <ShieldCheck size={16} />}
                Authorize
              </button>
              <button
                onClick={() => handlers.handleRejectRequest((row as PendingRequest).borrow_id!, title!)}
                disabled={isBusy}
                className="h-11 w-11 flex items-center justify-center rounded-xl border border-danger/30 text-danger transition-all hover:bg-danger/10 active:scale-95 disabled:opacity-50"
              >
                <X size={18} />
              </button>
            </>
          )}
          {(isActive || isOverdue) && (
            <div className="flex w-full flex-col gap-2">
              <button
                onClick={() => handlers.handleReturn((row as ActiveBorrow | OverdueBorrow).book_id!, (row as ActiveBorrow | OverdueBorrow).user_id!, title!)}
                disabled={isBusy}
                className="w-full h-11 flex items-center justify-center gap-2 rounded-xl border border-ok/40 bg-ok/5 text-[10px] font-black uppercase tracking-widest text-ok transition-all hover:bg-ok/10 active:scale-95 disabled:opacity-50"
              >
                {isBusy ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle size={16} />}
                Secure Return
              </button>
              {isOverdue && fineAmount > 0 && fineStatus !== 'paid' && (
                <button
                  onClick={() => handlers.handlePayFine((row as OverdueBorrow).id!, username!, fineAmount)}
                  disabled={isBusy}
                  className="w-full h-11 flex items-center justify-center gap-2 rounded-xl bg-warn text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-warn/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-warn/20"
                >
                  <CreditCard size={16} />
                  Collect ₹{fineAmount}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function TransactionRow({ row, activeTab, busyId, handlers }: { row: PendingRequest | ActiveBorrow | OverdueBorrow, activeTab: Tab, busyId: string | number | null, handlers: TransactionHandlers }) {
  const isPending = activeTab === 'pending'
  const isActive = activeTab === 'active'
  const isOverdue = activeTab === 'overdue'

  const isAct = 'books' in row && row.status === 'active'
  const title = isAct ? (row as ActiveBorrow).books?.title : (row as PendingRequest | OverdueBorrow).title
  const coverUrl = isAct ? (row as ActiveBorrow).books?.cover_url : null
  const username = isAct ? (row as ActiveBorrow).users?.username : (row as PendingRequest | OverdueBorrow).username
  const email = isAct ? (row as ActiveBorrow).users?.email : (row as PendingRequest | OverdueBorrow).email
  const dateValue = isPending ? (row as PendingRequest).requested_at : isActive ? (row as ActiveBorrow).borrowed_at : (row as OverdueBorrow).due_date
  const overdueDays = isOverdue && dateValue ? Math.max(1, Math.floor((new Date().getTime() - new Date(dateValue).getTime()) / 86400000)) : 0
  const dailyRate = isAct ? ((row as ActiveBorrow).users?.tier?.daily_fine_rate || 10) : 
                   isOverdue ? ((row as OverdueBorrow).daily_fine_rate || 10) : 0
  const fineAmount = isOverdue ? ((row as OverdueBorrow).fine_amount || (overdueDays * dailyRate)) : 0
  const fineStatus = isOverdue ? (row as OverdueBorrow).fine_status : null
  const isBusy = busyId === (isPending ? (row as PendingRequest).borrow_id : (row as ActiveBorrow | OverdueBorrow).id) || busyId === `${(row as ActiveBorrow | OverdueBorrow).book_id}-${(row as ActiveBorrow | OverdueBorrow).user_id}`

  return (
    <tr className="group hover:bg-white/[0.03] transition-colors">
      <td className="px-8 py-4">
        <div className="flex items-center gap-4 min-w-[240px]">
          <div className="h-12 w-9 shrink-0 overflow-hidden rounded border border-white/5 bg-white/5">
            {coverUrl ? <img src={coverUrl} alt="" className="h-full w-full object-cover" /> : <div className="grid h-full place-items-center text-[10px] italic text-muted">?</div>}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-white leading-tight">{title}</p>
            <p className="mt-0.5 font-mono text-[9px] text-muted">#{(row as ActiveBorrow | OverdueBorrow).book_id || (row as PendingRequest).book_id}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-white/5 flex items-center justify-center text-xs font-black text-muted group-hover:text-white transition-colors">
            {username?.[0]?.toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-bold text-white">{username}</p>
            <p className="truncate text-[10px] text-muted">{email}</p>
          </div>
        </div>
      </td>
      <td className="px-8 py-4 font-mono text-[11px]">
        {isOverdue ? (
          <div className="flex flex-col gap-1">
            <span className="text-danger font-bold uppercase tracking-tighter">{overdueDays}d LATE</span>
            <span className="text-warn font-black italic">₹{fineAmount} {fineStatus === 'paid' ? '✓' : '!!'}</span>
          </div>
        ) : (
          <span className="text-muted">{dateValue ? new Date(dateValue).toLocaleDateString() : '—'}</span>
        )}
      </td>
      <td className="px-8 py-4">
        <div className="flex items-center justify-end gap-2">
          {isPending && (
            <>
              <button 
                onClick={() => handlers.handleConfirmHandover((row as PendingRequest).borrow_id!, title!, username!)} 
                disabled={isBusy} 
                className="h-9 px-4 rounded-xl bg-accent text-[10px] font-black uppercase tracking-widest text-white transition-all hover:bg-accent/90 active:scale-95 disabled:opacity-50 shadow-lg shadow-accent/20"
              >
                {isBusy ? <RefreshCw size={12} className="animate-spin" /> : 'Authorize'}
              </button>
              <button 
                onClick={() => handlers.handleRejectRequest((row as PendingRequest).borrow_id!, title!)} 
                disabled={isBusy} 
                className="h-9 w-9 flex items-center justify-center rounded-xl border border-danger/30 text-danger transition-all hover:bg-danger/10 disabled:opacity-50"
              >
                <X size={16} />
              </button>
            </>
          )}
          {(isActive || isOverdue) && (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => handlers.handleReturn((row as ActiveBorrow | OverdueBorrow).book_id!, (row as ActiveBorrow | OverdueBorrow).user_id!, title!)} 
                disabled={isBusy} 
                className="h-9 px-4 rounded-xl border border-ok/40 bg-ok/5 text-[10px] font-black uppercase tracking-widest text-ok transition-all hover:bg-ok/10 active:scale-95 disabled:opacity-50"
              >
                {isBusy && busyId === `${(row as ActiveBorrow | OverdueBorrow).book_id}-${(row as ActiveBorrow | OverdueBorrow).user_id}` ? <RefreshCw size={12} className="animate-spin" /> : 'Return'}
              </button>
              {isOverdue && fineAmount > 0 && fineStatus !== 'paid' && (
                <button 
                  onClick={() => handlers.handlePayFine((row as OverdueBorrow).id!, username!, fineAmount)} 
                  disabled={isBusy} 
                  className="h-9 px-4 rounded-xl bg-warn text-[10px] font-black uppercase tracking-widest text-black transition-all hover:bg-warn/90 disabled:opacity-50"
                >
                  {isBusy && busyId === (row as OverdueBorrow).id ? <RefreshCw size={12} className="animate-spin" /> : 'Collect'}
                </button>
              )}
            </div>
          )}
        </div>
      </td>
    </tr>
  )
}
