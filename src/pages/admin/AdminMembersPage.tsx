import { History, Search, User, X, Check, Clock, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { TableRow, ViewRow } from '../../types/db'

type Profile = TableRow<'users'> & { tier?: { name: string, max_borrows: number } }
type ReadingHistory = ViewRow<'user_reading_history'> & { 
  id?: number, 
  book_id?: number, 
  fine_amount?: number, 
  fine_status?: string,
  title?: string,
  cover_url?: string | null
}
type WaitlistEntry = TableRow<'waitlist'> & { books: { title: string, cover_url: string | null } | null }

export default function AdminMembersPage() {
  const { isAdmin } = useAuth()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const { data: members = [], isLoading: loadingMembers } = useQuery<Profile[]>({
    queryKey: ['admin-members', search],
    queryFn: async () => {
      const query = supabase
        .from('users')
        .select('*, tier:membership_tiers(name, max_borrows)')
        .order('username', { ascending: true })
        .limit(50)

      if (search.trim()) {
        void query.or(`username.ilike.%${search}%,email.ilike.%${search}%`)
      }

      const { data, error } = await query
      if (error) throw error
      return (data as Profile[]) ?? []
    },
  })

  const { data: history = [], isLoading: loadingHistory } = useQuery<ReadingHistory[]>({
    queryKey: ['admin-member-history', selectedUser?.id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('borrow_history')
        .select('*, books(title, cover_url)')
        .eq('user_id', selectedUser!.id)
        .order('borrowed_at', { ascending: false })
      
      if (error) throw error
      
      return (data ?? []).map(row => {
        const book = row.books as { title: string, cover_url: string | null } | null
        return {
          user_id: row.user_id,
          book_id: row.book_id,
          borrowed_at: row.borrowed_at,
          returned_at: row.returned_at,
          due_date: row.due_date,
          status: row.status,
          fine_amount: row.fine_amount,
          fine_status: row.fine_status,
          title: book?.title,
          cover_url: book?.cover_url,
          id: row.id
        }
      }) as ReadingHistory[]
    },
  })

  const { data: waitlist = [] } = useQuery<WaitlistEntry[]>({
    queryKey: ['admin-member-waitlist', selectedUser?.id],
    enabled: !!selectedUser,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('waitlist')
        .select('*, books(title, cover_url)')
        .eq('user_id', selectedUser!.id)
        .order('joined_at', { ascending: true })
        .returns<WaitlistEntry[]>()
      
      if (error) throw error
      return data ?? []
    },
  })

  if (!isAdmin) return <Navigate to="/discover" replace />

  const handleReturn = async (bookId: number, userId: string) => {
    if (!window.confirm('Mark this book as returned?')) return
    
    setBusyId(`${bookId}-${userId}`)
    try {
      const { data, error } = await supabase.rpc('return_book', {
        p_book_id: bookId,
        p_user_id: userId
      })
      if (error) throw error
      
      alert(data === 'RETURNED_WITH_FINE' ? '✓ Book returned. A fine has been recorded.' : '✓ Book returned successfully.')
      
      void queryClient.invalidateQueries({ queryKey: ['admin-member-history', userId] })
      void queryClient.invalidateQueries({ queryKey: ['inventory-books'] })
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const handlePayFine = async (borrowId: number, userId: string) => {
    try {
      const { error } = await supabase
        .from('borrow_history')
        .update({ fine_status: 'paid' })
        .eq('id', borrowId)
      
      if (error) throw error
      void queryClient.invalidateQueries({ queryKey: ['admin-member-history', userId] })
    } catch (err) {
      alert((err as Error).message)
    }
  }

  return (
    <main className="min-h-screen bg-void px-4 py-6 sm:px-8 sm:py-7 lg:px-10 lg:py-12">
      <header className="mb-10">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-accent mb-2">
          <User size={12} />
          Directory Management
        </div>
        <h1 className="font-display text-4xl italic text-white lg:text-5xl">Library Members</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Search students, audit their borrow history, and manage active obligations within the library ecosystem.
        </p>
      </header>

      <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[380px_1fr] xl:gap-12">
        <section className="space-y-6">
          <div className="relative group">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted transition-colors group-focus-within:text-accent" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter by name or email..."
              className="h-12 w-full rounded-2xl border border-white/5 bg-surface pl-11 pr-4 text-sm text-white outline-none ring-accent/20 transition-all focus:border-accent/40 focus:ring-4 shadow-inner"
            />
          </div>

          <div className="overflow-hidden rounded-[28px] border border-border bg-surface/50 backdrop-blur-md">
            <div className="bg-white/4 px-6 py-4 text-[10px] font-bold uppercase tracking-widest text-muted border-b border-border">
              Directory Listing
            </div>
            <div className="divide-y divide-border/40 max-h-[600px] overflow-y-auto scrollbar-hide">
              {loadingMembers ? (
                <div className="p-12 text-center text-sm text-muted italic">Querying records...</div>
              ) : members.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted italic">No matching records found.</div>
              ) : (
                members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedUser(member)}
                    className={`flex w-full items-center gap-4 px-6 py-4 text-left transition-all hover:bg-white/4 ${
                      selectedUser?.id === member.id ? 'bg-accent/10' : ''
                    }`}
                  >
                    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent/20 text-accent font-black text-sm border border-accent/20 shadow-lg shadow-accent/5">
                      {member.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors">{member.username}</p>
                      <p className="truncate text-[11px] text-muted">{member.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-8">
          {selectedUser ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* User Info Card */}
              <div className="rounded-[32px] border border-border bg-surface overflow-hidden shadow-2xl shadow-black/40">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border bg-white/4 px-6 py-6 sm:px-8">
                  <div className="flex items-center gap-5">
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-accent text-xl font-black text-white shadow-xl shadow-accent/20">
                      {selectedUser.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <h2 className="text-xl font-display italic text-white leading-tight">{selectedUser.username}</h2>
                      <div className="flex flex-wrap items-center gap-3 mt-1">
                        <p className="text-xs text-muted">{selectedUser.email}</p>
                        <span className="rounded-lg bg-accent/10 border border-accent/20 px-2 py-0.5 text-[9px] uppercase font-black tracking-widest text-accent">
                          {selectedUser.tier?.name ?? 'Standard'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="self-end sm:self-center rounded-xl p-2.5 text-muted hover:bg-white/6 hover:text-white transition-colors"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 divide-x divide-border border-b border-border bg-base/40">
                  <div className="p-6 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Allowance</p>
                    <p className="mt-2 text-2xl font-display italic text-white">{selectedUser.tier?.max_borrows ?? 5}</p>
                    <p className="text-[9px] text-muted uppercase mt-0.5">Maximum Volumes</p>
                  </div>
                  <div className="p-6 text-center">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted">Enrollment</p>
                    <p className="mt-2 text-sm font-bold text-white">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                    </p>
                    <p className="text-[9px] text-muted uppercase mt-0.5">Registration Date</p>
                  </div>
                </div>

                <div className="p-6 sm:p-8">
                  {/* Waitlist Section */}
                  {waitlist.length > 0 && (
                    <div className="mb-8 rounded-2xl border border-warn/20 bg-warn/5 p-5">
                      <div className="mb-4 flex items-center gap-2 text-warn font-black text-xs uppercase tracking-widest">
                        <Clock size={14} className="animate-pulse" />
                        Active Waitlist Obligations ({waitlist.length})
                      </div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {waitlist.map((item) => (
                          <div key={item.id} className="flex items-center gap-3 rounded-xl border border-warn/10 bg-black/20 p-3">
                            <div className="h-10 w-7 shrink-0 overflow-hidden rounded border border-border bg-white/5 shadow-lg">
                              {item.books?.cover_url ? (
                                <img src={item.books.cover_url} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <div className="grid h-full place-items-center text-[10px] italic text-muted">?</div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-bold text-white leading-none">{item.books?.title}</p>
                              <p className="text-[10px] text-muted mt-1 uppercase tracking-tighter">Joined {new Date(item.joined_at!).toLocaleDateString()}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Borrowing History */}
                  <div className="flex items-center gap-2 text-white font-bold text-sm uppercase tracking-widest mb-6 px-1">
                    <History size={16} className="text-accent" />
                    Operational History
                  </div>

                  {loadingHistory ? (
                    <div className="py-20 text-center text-sm text-muted italic">Retrieving archive data...</div>
                  ) : history.length === 0 ? (
                    <div className="rounded-[24px] border border-dashed border-border py-20 text-center">
                      <p className="text-sm text-muted">No operational history found for this member.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-1 xl:grid-cols-2">
                      {history.map((item, idx) => (
                        <div key={idx} className="flex gap-4 rounded-2xl border border-border/60 bg-white/2 p-4 transition-all hover:border-white/10 hover:bg-white/4 group">
                          <div className="h-20 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-white/5 shadow-xl transition-transform group-hover:scale-105">
                            {item.cover_url ? (
                              <img src={item.cover_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center bg-accent/10 font-display text-lg italic text-accent">
                                {item.title?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0">
                                <p className="truncate text-sm font-bold text-white group-hover:text-accent transition-colors">{item.title}</p>
                                {item.fine_amount && item.fine_amount > 0 ? (
                                  <div className="mt-1.5 flex items-center gap-2">
                                    <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[9px] font-black uppercase tracking-widest ${
                                      item.fine_status === 'paid' ? 'bg-ok/10 text-ok border border-ok/20' : 'bg-danger/10 text-danger border border-danger/20'
                                    }`}>
                                      ₹{item.fine_amount} {item.fine_status === 'paid' ? 'Paid ✓' : 'UNSETTLED !!'}
                                    </span>
                                    {item.fine_status === 'unpaid' && (
                                      <button 
                                        onClick={() => item.id && handlePayFine(item.id, selectedUser.id)}
                                        className="text-[9px] uppercase font-black tracking-widest text-accent hover:text-white transition-colors"
                                      >
                                        [ Clear Fine ]
                                      </button>
                                    )}
                                  </div>
                                ) : (
                                  <span className="mt-1.5 inline-flex rounded-lg bg-white/5 border border-white/5 px-2 py-0.5 text-[8px] font-bold uppercase tracking-widest text-muted">
                                    No Penalties
                                  </span>
                                )}
                              </div>
                              <span className={`shrink-0 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-widest ${
                                item.status === 'active' ? 'bg-ok/10 text-ok border border-ok/20' :
                                item.status === 'overdue' ? 'bg-danger/10 text-danger border border-danger/20 animate-pulse' :
                                'bg-white/5 text-muted border border-white/5'
                              }`}>
                                {item.status}
                              </span>
                            </div>

                            <div className="mt-4 flex items-end justify-between">
                              <div className="grid grid-cols-2 gap-4 text-[10px]">
                                <div>
                                  <p className="font-bold uppercase tracking-tighter text-muted">Released</p>
                                  <p className="font-mono text-white/90">{item.borrowed_at ? new Date(item.borrowed_at).toLocaleDateString() : '—'}</p>
                                </div>
                                <div>
                                  <p className="font-bold uppercase tracking-tighter text-muted">{item.status === 'returned' ? 'Secured' : 'Obligation'}</p>
                                  <p className="font-mono text-white/90">
                                    {item.status === 'returned' 
                                      ? (item.returned_at ? new Date(item.returned_at).toLocaleDateString() : '—')
                                      : (item.due_date ? new Date(item.due_date).toLocaleDateString() : '—')
                                    }
                                  </p>
                                </div>
                              </div>
                              
                              {(item.status === 'active' || item.status === 'overdue') && (
                                <button
                                  onClick={() => item.book_id && item.user_id && handleReturn(item.book_id, item.user_id)}
                                  disabled={busyId === `${item.book_id}-${item.user_id}`}
                                  className="flex h-8 items-center gap-1.5 rounded-xl bg-ok/10 px-3 text-[9px] font-black uppercase tracking-widest text-ok transition-all hover:bg-ok/20 active:scale-95 disabled:opacity-50"
                                >
                                  {busyId === `${item.book_id}-${item.user_id}` ? <Loader2 size={10} className="animate-spin" /> : <Check size={12} />}
                                  Return
                                </button>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex h-[500px] flex-col items-center justify-center rounded-[40px] border border-dashed border-white/10 bg-surface/30 text-center p-12">
              <div className="mb-6 rounded-full bg-white/5 p-8 text-muted/30">
                <User size={64} strokeWidth={1} />
              </div>
              <h3 className="text-2xl font-display italic text-white">Focus Required</h3>
              <p className="mt-3 max-w-[320px] text-sm leading-relaxed text-muted">
                Select a member from the directory to initialize their comprehensive borrowing dossier.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
