import { History, Search, User, X, Check } from 'lucide-react'
import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { TableRow, ViewRow } from '../../types/db'

type Profile = TableRow<'users'> & { tier?: { name: string, max_borrows: number } }
type ReadingHistory = ViewRow<'user_reading_history'> & { book_id?: number, fine_amount?: number, fine_status?: string }
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
      return (data as any) ?? []
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
      
      return (data ?? []).map(row => ({
        user_id: row.user_id,
        book_id: row.book_id,
        borrowed_at: row.borrowed_at,
        returned_at: row.returned_at,
        due_date: row.due_date,
        status: row.status,
        fine_amount: row.fine_amount,
        fine_status: row.fine_status,
        title: (row.books as any)?.title,
        cover_url: (row.books as any)?.cover_url
      })) as ReadingHistory[]
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
    <main className="min-h-screen bg-void" style={{ padding: '28px 32px' }}>
      <header className="mb-8">
        <h1 className="font-display text-[32px] italic text-white">Library Members</h1>
        <p className="mt-1 text-sm text-muted">Search students, view their borrow history and current status.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.5fr]">
        <section className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by username or email..."
              className="h-11 w-full rounded-xl border border-border bg-surface pl-10 pr-4 text-sm text-white outline-none ring-accent/20 focus:ring-2"
            />
          </div>

          <div className="overflow-hidden rounded-card border border-border bg-surface">
            <div className="bg-white/4 px-4 py-2 text-[11px] uppercase tracking-wider text-muted">
              Matching Members
            </div>
            <div className="divide-y divide-border/40">
              {loadingMembers ? (
                <div className="p-8 text-center text-sm text-muted">Loading members...</div>
              ) : members.length === 0 ? (
                <div className="p-8 text-center text-sm text-muted">No members found.</div>
              ) : (
                members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => setSelectedUser(member)}
                    className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/4 ${
                      selectedUser?.id === member.id ? 'bg-accent/10' : ''
                    }`}
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/20 text-accent font-semibold">
                      {member.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{member.username}</p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="space-y-6">
          {selectedUser ? (
            <>
              {/* User Info Card */}
              <div className="rounded-card border border-border bg-surface overflow-hidden">
                <div className="flex items-center justify-between border-b border-border bg-white/4 px-6 py-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-semibold text-white">
                      {selectedUser.username?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div>
                      <h2 className="text-lg font-semibold text-white">{selectedUser.username}</h2>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-muted">{selectedUser.email}</p>
                        <span className="rounded-full bg-accent/10 px-2 py-0.5 text-[10px] uppercase font-bold text-accent">
                          {selectedUser.tier?.name ?? 'Student'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setSelectedUser(null)}
                    className="rounded-lg p-2 text-muted hover:bg-white/6 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="grid grid-cols-2 divide-x divide-border border-b border-border">
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Max Borrows</p>
                    <p className="mt-1 text-xl font-display italic text-white">{selectedUser.tier?.max_borrows ?? 5}</p>
                  </div>
                  <div className="p-4 text-center">
                    <p className="text-[10px] uppercase tracking-wider text-muted">Member Since</p>
                    <p className="mt-1 text-sm text-white">
                      {selectedUser.created_at ? new Date(selectedUser.created_at).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Waitlist Section */}
              {waitlist.length > 0 && (
                <div className="rounded-card border border-warn/20 bg-warn/5 p-6">
                  <div className="mb-4 flex items-center gap-2 text-warn">
                    <History size={18} />
                    <h3 className="font-semibold">Current Waitlist ({waitlist.length})</h3>
                  </div>
                  <div className="space-y-2">
                    {waitlist.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border border-warn/10 bg-black/20 p-3">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-7 overflow-hidden rounded border border-border bg-white/5">
                            {item.books?.cover_url ? (
                              <img src={item.books.cover_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center text-[10px] italic text-muted">?</div>
                            )}
                          </div>
                          <p className="text-sm text-white">{item.books?.title}</p>
                        </div>
                        <p className="text-[11px] text-muted">Joined {new Date(item.joined_at!).toLocaleDateString()}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Borrowing History Card */}
              <div className="rounded-card border border-border bg-surface overflow-hidden">
                <div className="border-b border-border bg-white/4 px-6 py-4">
                  <div className="flex items-center gap-2 text-white">
                    <History size={18} className="text-accent" />
                    <h3 className="font-semibold">Borrowing History</h3>
                  </div>
                </div>

                <div className="p-6">
                  {loadingHistory ? (
                    <div className="py-12 text-center text-sm text-muted">Loading history...</div>
                  ) : history.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border py-12 text-center">
                      <p className="text-sm text-muted">No borrowing history found for this member.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {history.map((item, idx) => (
                        <div key={idx} className="flex gap-4 rounded-xl border border-border/60 bg-white/2 p-4">
                          <div className="h-16 w-11 shrink-0 overflow-hidden rounded border border-border bg-white/5">
                            {item.cover_url ? (
                              <img src={item.cover_url} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="grid h-full place-items-center bg-accent/10 font-display text-xs italic text-accent">
                                {item.title?.[0]}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="truncate text-sm font-medium text-white">{item.title}</p>
                                {item.fine_amount && item.fine_amount > 0 && (
                                  <div className="mt-1 flex items-center gap-2">
                                    <span className="text-[10px] font-mono text-danger">Fine: ₹{item.fine_amount}</span>
                                    {item.fine_status === 'unpaid' && (
                                      <button 
                                        onClick={() => (item as any).id && handlePayFine((item as any).id, selectedUser.id)}
                                        className="text-[9px] uppercase font-bold text-accent hover:underline"
                                      >
                                        Mark Paid
                                      </button>
                                    )}
                                    {item.fine_status === 'paid' && (
                                      <span className="text-[9px] uppercase font-bold text-ok">Paid</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-col items-end gap-2">
                                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] uppercase font-bold ${
                                  item.status === 'active' ? 'bg-ok/20 text-ok' :
                                  item.status === 'overdue' ? 'bg-danger/20 text-danger' :
                                  'bg-white/10 text-muted'
                                }`}>
                                  {item.status}
                                </span>
                                {(item.status === 'active' || item.status === 'overdue') && (
                                  <button
                                    onClick={() => item.book_id && item.user_id && handleReturn(item.book_id, item.user_id)}
                                    disabled={busyId === `${item.book_id}-${item.user_id}`}
                                    className="flex items-center gap-1 rounded-full bg-ok/10 px-2 py-0.5 text-[10px] font-bold text-ok transition-colors hover:bg-ok/20 disabled:opacity-50"
                                  >
                                    <Check size={10} /> Mark Returned
                                  </button>
                                )}
                              </div>
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-4 text-[11px] text-muted">
                              <div>
                                <p className="uppercase tracking-wider">Borrowed</p>
                                <p className="text-white">{item.borrowed_at ? new Date(item.borrowed_at).toLocaleDateString() : '—'}</p>
                              </div>
                              <div>
                                <p className="uppercase tracking-wider">{item.status === 'returned' ? 'Returned' : 'Due Date'}</p>
                                <p className="text-white">
                                  {item.status === 'returned' 
                                    ? (item.returned_at ? new Date(item.returned_at).toLocaleDateString() : '—')
                                    : (item.due_date ? new Date(item.due_date).toLocaleDateString() : '—')
                                  }
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="flex h-[400px] flex-col items-center justify-center rounded-card border border-dashed border-border bg-surface/50 text-center p-8">
              <div className="mb-4 rounded-full bg-white/5 p-4 text-muted">
                <User size={32} />
              </div>
              <h3 className="text-lg font-medium text-white">No Member Selected</h3>
              <p className="mt-1 max-w-[260px] text-sm text-muted">
                Select a member from the list on the left to view their borrowing history and active books.
              </p>
            </div>
          )}
        </section>
      </div>
    </main>
  )
}
