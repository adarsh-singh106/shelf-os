import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Navigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../hooks/useAuth'
import type { TableRow } from '../../types/db'

// Typed from database.types.ts — action is string in DB (NOTIFY, INSERT, UPDATE, DELETE)
type ActionType = 'INSERT' | 'UPDATE' | 'DELETE' | 'NOTIFY'
type AuditRow = TableRow<'audit_log'> & { action: ActionType }

export default function AdminAuditLogPage() {
  const { isAdmin } = useAuth()
  const [liveRows, setLiveRows] = useState<AuditRow[]>([])
  const [actionFilter, setActionFilter] = useState<'ALL' | ActionType>('ALL')
  const [tableFilter, setTableFilter] = useState('ALL')
  const [expandedRowIds, setExpandedRowIds] = useState<number[]>([])

  const { data: initialRows = [] } = useQuery<AuditRow[]>({
    queryKey: ['auditLog'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_log')
        .select('*')
        .order('changed_at', { ascending: false })
        .limit(100)
        .returns<AuditRow[]>()
      if (error) throw error
      return (data ?? []) as AuditRow[]
    },
  })

  useEffect(() => {
    const channel = supabase
      .channel('audit-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'audit_log' }, (payload) => {
        setLiveRows((current) => [payload.new as AuditRow, ...current].slice(0, 100))
      })
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [])

  const mergedRows = useMemo(() => {
    const unique = new Map<number, AuditRow>()
    for (const row of [...liveRows, ...initialRows]) {
      if (typeof row.id === 'number' && !unique.has(row.id)) {
        unique.set(row.id, row)
      }
    }
    return [...unique.values()].slice(0, 100)
  }, [initialRows, liveRows])
  const tableOptions = useMemo(() => ['ALL', ...new Set(mergedRows.map((row) => row.table_name))], [mergedRows])

  const filteredRows = mergedRows.filter((row) => {
    const byAction = actionFilter === 'ALL' ? true : row.action === actionFilter
    const byTable = tableFilter === 'ALL' ? true : row.table_name === tableFilter
    return byAction && byTable
  })

  if (!isAdmin) return <Navigate to="/discover" replace />

  return (
    <main className="min-h-screen bg-void" style={{ padding: '28px 32px' }}>
      <style>{`
        @keyframes pulse-live {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.4); opacity: 0.4; }
          100% { transform: scale(1); opacity: 1; }
        }
        @keyframes slideIn {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <header className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="font-display text-[28px] italic text-white">Audit Log</h1>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] text-ok">
            <span className="h-2 w-2 rounded-full bg-ok" style={{ animation: 'pulse-live 2s infinite' }} /> Live
          </span>
        </div>

        <div className="flex items-center gap-2">
          <select value={actionFilter} onChange={(event) => setActionFilter(event.target.value as 'ALL' | ActionType)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-white">
            <option value="ALL">All Actions</option>
            <option value="INSERT">INSERT</option>
            <option value="UPDATE">UPDATE</option>
            <option value="DELETE">DELETE</option>
            <option value="NOTIFY">NOTIFY</option>
          </select>

          <select value={tableFilter} onChange={(event) => setTableFilter(event.target.value)} className="h-9 rounded-lg border border-border bg-surface px-3 text-sm text-white">
            {tableOptions.map((table) => (
              <option key={table} value={table}>{table === 'ALL' ? 'All Tables' : table}</option>
            ))}
          </select>

          {(actionFilter !== 'ALL' || tableFilter !== 'ALL') ? (
            <button type="button" onClick={() => { setActionFilter('ALL'); setTableFilter('ALL') }} className="inline-flex h-9 items-center gap-1 rounded-lg border border-border px-3 text-sm text-muted transition-colors duration-150 hover:bg-white/6">
              <X size={13} /> Clear
            </button>
          ) : null}
        </div>
      </header>

      <section className="overflow-hidden rounded-card border border-border bg-surface font-mono text-xs">
        <div className="grid grid-cols-[1.3fr_.8fr_1fr_.8fr_2fr] bg-white/4 px-5 py-2.5 uppercase tracking-[0.08em] text-muted">
          <p>Timestamp</p>
          <p>Action</p>
          <p>Table</p>
          <p>Row ID</p>
          <p>Details</p>
        </div>

        {filteredRows.map((row) => {
          const expanded = expandedRowIds.includes(row.id)

          return (
            <div
              key={row.id}
              className="border-b border-border/60 px-5 py-3 hover:bg-white/2"
              style={{ animation: 'slideIn 300ms ease' }}
            >
              <div className="grid grid-cols-[1.3fr_.8fr_1fr_.8fr_2fr] items-center">
                <p className="text-muted">
                  {row.changed_at
                    ? `${new Date(row.changed_at).toLocaleTimeString()} · ${new Date(row.changed_at).toLocaleDateString()}`
                    : '—'}
                </p>
                <span className={`w-fit rounded px-2 py-0.5 text-[11px] ${
                  row.action === 'INSERT' ? 'bg-ok/15 text-ok'
                    : row.action === 'UPDATE' ? 'bg-warn/15 text-warn'
                    : row.action === 'DELETE' ? 'bg-danger/15 text-danger'
                    : 'bg-waitlist/15 text-waitlist'
                }`}>{row.action}</span>
                <p className="text-accent">{row.table_name}</p>
                <p className="truncate text-muted">{row.row_id ?? '—'}</p>
                <button
                  type="button"
                  onClick={() => setExpandedRowIds((current) =>
                    expanded ? current.filter((id) => id !== row.id) : [...current, row.id]
                  )}
                  className="justify-self-start text-muted hover:text-white transition-colors duration-[150ms]"
                >
                  {(row.new_data as Record<string, unknown>)?.title
                    ? String((row.new_data as Record<string, unknown>).title)
                    : (row.new_data as Record<string, unknown>)?.status
                      ? `status: ${String((row.new_data as Record<string, unknown>).status)}`
                      : 'View ↗'}
                </button>
              </div>

              {expanded ? (
                <pre className="mt-2 overflow-x-auto rounded-md bg-white/4 p-3 text-[11px] text-muted">
{JSON.stringify({ old_data: row.old_data, new_data: row.new_data }, null, 2)}
                </pre>
              ) : null}
            </div>
          )
        })}
      </section>
    </main>
  )
}
