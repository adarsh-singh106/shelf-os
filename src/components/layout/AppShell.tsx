import { Sun, Moon, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useTheme } from '../../providers/ThemeProvider'
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
  const { theme, toggleTheme } = useTheme()
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
    <div className="min-h-screen bg-void text-foreground">
      <Sidebar
        isAdmin={isAdmin}
        expanded={expanded}
        onExpandedChange={setExpanded}
        username={displayUser.username}
        role={displayUser.role}
      />

      <header className="fixed left-0 right-0 top-0 z-30 h-[60px] border-b border-border bg-base/80 backdrop-blur-xl md:left-[52px] md:h-[52px]">
        <div className="flex h-full items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-3 md:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-sm font-black text-white shadow-lg shadow-accent/20">S</div>
          </div>

          <button
            type="button"
            onClick={() => {
              onSearchOpen()
              setCommandPaletteOpen(true)
            }}
            className="flex h-[38px] w-full max-w-[280px] items-center gap-2 rounded-xl border border-white/5 bg-surface px-3 text-left transition-all hover:border-accent/30 sm:max-w-[320px] md:h-[34px]"
          >
            <Search size={15} className="text-muted" />
            <span className="flex-1 truncate text-xs text-ghost sm:text-sm">Search library...</span>
            <span className="hidden items-center gap-1 text-[10px] text-muted lg:inline-flex">
              <kbd className="rounded border border-border px-1.5 py-0.5 font-sans bg-base/50">Ctrl</kbd>
              <kbd className="rounded border border-border px-1.5 py-0.5 font-sans bg-base/50">K</kbd>
            </span>
          </button>

          <div className="relative flex items-center gap-2 sm:gap-4">
            <button
              type="button"
              className="p-2 text-muted transition-colors duration-150 hover:text-accent"
              aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
              onClick={toggleTheme}
            >
              {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
            </button>
            <span className="h-5 w-px bg-border hidden sm:block" />

            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="inline-flex items-center gap-2 transition-opacity hover:opacity-80 active:scale-95"
              aria-label="Open user menu"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent text-[11px] font-black text-white shadow-lg shadow-accent/20 md:h-8 md:w-8">
                {initials || 'U'}
              </div>
              <span className="hidden max-w-[120px] truncate text-sm font-bold text-foreground/90 lg:block">{displayUser.username}</span>
            </button>

            {menuOpen ? (
              <div className="absolute right-0 top-11 w-44 rounded-xl border border-border bg-raised p-1.5 shadow-2xl shadow-black/60 animate-in fade-in zoom-in-95 duration-100">
                <div className="mb-1 border-b border-border px-3 py-2 lg:hidden">
                   <p className="truncate text-xs font-bold text-foreground">{displayUser.username}</p>
                   <p className="truncate text-[10px] text-muted">{displayUser.email}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false)
                    navigate('/space')
                  }}
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-muted transition-colors duration-150 hover:bg-white/8 hover:text-foreground"
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
                  className="w-full rounded-lg px-3 py-2.5 text-left text-sm text-danger transition-colors duration-150 hover:bg-danger/10"
                >
                  Sign Out
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="min-h-screen bg-void pb-20 pt-[60px] md:pb-0 md:pt-[52px] md:pl-[52px]">
        <div className="mx-auto max-w-(--breakpoint-2xl) px-4 py-6 sm:px-8 sm:py-7">
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
