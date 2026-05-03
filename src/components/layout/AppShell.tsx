import { Bell, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import Sidebar from './Sidebar'
import CommandPalette from '../shared/CommandPalette'

interface AppShellProps {
  isAdmin: boolean
  user: { username: string; email: string }
  onSearchOpen: () => void
}

export default function AppShell({ isAdmin, user, onSearchOpen }: AppShellProps) {
  const navigate = useNavigate()
  const { signOut, profile } = useAuth()
  const [expanded, setExpanded] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false)

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setCommandPaletteOpen(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const displayUser = useMemo(() => {
    return {
      username: profile?.username ?? user.username ?? user.email.split('@')[0] ?? 'Member',
      email: profile?.email ?? user.email,
      role: profile?.role ?? (isAdmin ? 'admin' : 'member'),
    }
  }, [profile?.email, profile?.role, profile?.username, user.email, user.username, isAdmin])

  const initials = displayUser.username
    .split(' ')
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  return (
    <div className="min-h-screen bg-void text-white">
      <Sidebar
        isAdmin={isAdmin}
        expanded={expanded}
        onExpandedChange={setExpanded}
        username={displayUser.username}
        role={displayUser.role}
      />

      <header className="fixed left-[52px] right-0 top-0 z-30 h-[52px] border-b border-border bg-base">
        <div className="flex h-full items-center justify-between px-4 sm:px-5">
          <button
            type="button"
            onClick={() => {
              onSearchOpen()
              setCommandPaletteOpen(true)
            }}
            className="flex h-[34px] w-full max-w-[320px] items-center gap-2 rounded-lg border border-border bg-surface px-3 text-left"
          >
            <Search size={15} className="text-muted" />
            <span className="flex-1 text-sm text-ghost">Search books...</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-muted">
              <kbd className="rounded border border-border px-1 py-0.5">Ctrl</kbd>
              <kbd className="rounded border border-border px-1 py-0.5">K</kbd>
            </span>
          </button>

          <div className="relative flex items-center gap-3">
            <button
              type="button"
              className="text-muted transition-colors duration-150 hover:text-white"
              aria-label="Open shelf activity"
              onClick={() => navigate('/shelf')}
            >
              <Bell size={20} />
            </button>
            <span className="h-5 w-px bg-border" />

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2"
              aria-label="Open user menu"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
                {initials || 'U'}
              </div>
              <span className="hidden text-sm text-muted sm:block">{displayUser.username}</span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-10 w-40 rounded-lg border border-border bg-raised p-1 shadow-2xl shadow-black/50">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/space')
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-muted transition-colors duration-150 hover:bg-white/8"
                >
                  My Space
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    void signOut()
                    navigate('/')
                  }}
                  className="w-full rounded-md px-3 py-2 text-left text-sm text-muted transition-colors duration-150 hover:bg-white/8"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-void pl-[52px] pt-[52px]">
        <div className="px-8 py-7">
          <Outlet />
        </div>
      </main>

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onBookSelect={(book) => {
          setCommandPaletteOpen(false)
          navigate('/discover', { state: { focusBookId: book.id } })
        }}
      />
    </div>
  )
}
