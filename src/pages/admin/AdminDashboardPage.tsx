import { ArrowRight, ClipboardCheck, PackagePlus, ScrollText, Users } from 'lucide-react'
import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useAuditLog, usePendingRequests } from '../../hooks/useAdmin'

const cards = [
  {
    to: '/admin/requests',
    title: 'Requests',
    description: 'Confirm borrow requests at the desk',
    icon: ClipboardCheck,
  },
  {
    to: '/admin/members',
    title: 'Members',
    description: 'Search students and view histories',
    icon: Users,
  },
  {
    to: '/admin/audit',
    title: 'Audit Log',
    description: 'Monitor realtime data changes',
    icon: ScrollText,
  },
  {
    to: '/admin/inventory',
    title: 'Inventory',
    description: 'Add new books with ISBN autofill',
    icon: PackagePlus,
  },
]

export default function AdminDashboardPage() {
  const queryClient = useQueryClient()
  const { data: pending = [] } = usePendingRequests()
  const { data: audit = [] } = useAuditLog()

  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'borrow_history' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['pending_requests'] })
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, () => {
        void queryClient.invalidateQueries({ queryKey: ['auditLog'] })
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return (
    <div className="space-y-6">
      <section className="rounded-card border border-border bg-surface px-6 py-5">
        <p className="text-xs uppercase tracking-[0.14em] text-accent">Admin Dashboard</p>
        <h1 className="mt-2 font-display text-4xl italic text-white">Librarian Control Center</h1>
        <p className="mt-2 text-sm text-muted">Manage requests, audit trail, and catalog inventory from one place.</p>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-card border border-border bg-base/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Pending requests</p>
            <p className="mt-1 font-display text-3xl italic text-white">{pending.length}</p>
          </div>
          <div className="rounded-card border border-border bg-base/60 px-4 py-3">
            <p className="text-xs uppercase tracking-[0.1em] text-muted">Recent audit rows</p>
            <p className="mt-1 font-display text-3xl italic text-white">{audit.length}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        {cards.map((card) => (
          <Link
            key={card.to}
            to={card.to}
            className="group rounded-card border border-border bg-surface px-6 py-5 transition duration-150 ease hover:-translate-y-1.5 hover:border-accent/30"
          >
            <card.icon size={18} className="text-accent" />
            <h2 className="mt-3 font-display text-2xl italic text-white">{card.title}</h2>
            <p className="mt-2 text-sm text-muted">{card.description}</p>
            <span className="mt-4 inline-flex items-center gap-1 text-sm text-accent">
              Open
              <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
            </span>
          </Link>
        ))}
      </section>
    </div>
  )
}
