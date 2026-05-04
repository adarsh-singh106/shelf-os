import { BookOpen, ClipboardList, Home, Package, Settings, Shield, User, LogOut } from 'lucide-react'
import type { ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

type SidebarProps = {
  isAdmin: boolean
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  username: string
  role: string
}

type NavItem = {
  label: string
  to: string
  icon: ComponentType<{ size?: number }>
  admin?: boolean
}

const navItems: NavItem[] = [
  { label: 'Discover', to: '/discover', icon: Home },
  { label: 'My Shelf', to: '/shelf', icon: BookOpen },
  { label: 'My Space', to: '/space', icon: User },
]

const adminItems: NavItem[] = [
  { label: 'Dashboard', to: '/admin', icon: Settings, admin: true },
  { label: 'Transactions', to: '/admin/transactions', icon: ClipboardList, admin: true },
  { label: 'Members', to: '/admin/members', icon: User, admin: true },
  { label: 'Audit Log', to: '/admin/audit', icon: Shield, admin: true },
  { label: 'Inventory', to: '/admin/inventory', icon: Package, admin: true },
]

function NavButton({ item, expanded, muted = false }: { item: NavItem; expanded: boolean; muted?: boolean }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)

  return (
    <button
      type="button"
      onClick={() => navigate(item.to)}
      className={`group relative flex h-11 w-full items-center overflow-hidden rounded-r-lg pl-3 pr-2 text-left transition-colors duration-150 ${
        isActive
          ? 'border-l-[3px] border-accent bg-accent/10 text-accent'
          : muted
            ? 'text-muted hover:bg-white/6 hover:text-white'
            : 'text-muted hover:bg-white/6 hover:text-white'
      }`}
    >
      <item.icon size={18} />
      <span
        className={`ml-3 text-sm transition-all duration-150 ${
          expanded ? 'translate-x-0 opacity-100' : 'pointer-events-none -translate-x-2 opacity-0'
        }`}
      >
        {item.label}
      </span>
    </button>
  )
}

export default function Sidebar({ isAdmin, expanded, onExpandedChange, username, role }: SidebarProps) {
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const { pathname } = useLocation()
  
  const initials = (username || role || 'U')
    .split(' ')
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  const mobileNavItems = isAdmin 
    ? [navItems[0], adminItems[0], adminItems[1], adminItems[4], navItems[2]]
    : [...navItems]

  return (
    <>
      {/* Desktop Sidebar */}
      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen flex-col border-r border-border bg-base transition-[width] duration-200 ease md:flex ${
          expanded ? 'w-[220px] backdrop-blur-[20px]' : 'w-[52px]'
        }`}
        onMouseEnter={() => onExpandedChange(true)}
        onMouseLeave={() => onExpandedChange(false)}
      >
        <div className="px-2 pt-2">
          <div className="mb-5 flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-semibold text-white">S</div>

          <nav className="space-y-1">
            {navItems.map((item) => (
              <NavButton key={item.to} item={item} expanded={expanded} />
            ))}
          </nav>

          {isAdmin ? <div className="my-3 h-px bg-border" /> : null}

          {isAdmin ? (
            <nav className="space-y-1">
              {adminItems.map((item) => (
                <NavButton key={item.to} item={item} expanded={expanded} muted />
              ))}
            </nav>
          ) : null}
        </div>

        <div className="mt-auto border-t border-border px-2 py-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white shrink-0">
              {initials || 'U'}
            </div>
            <div
              className={`transition-all duration-150 min-w-0 ${expanded ? 'opacity-100' : 'pointer-events-none w-0 overflow-hidden opacity-0'}`}
            >
              <p className="truncate text-xs text-white">{username}</p>
              <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-muted">{role}</span>
            </div>
          </div>
          {expanded && (
            <button
              onClick={() => {
                void signOut()
                navigate('/')
              }}
              className="mt-3 flex w-full items-center gap-3 rounded-lg px-2 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
            >
              <LogOut size={14} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-border bg-base/80 px-2 backdrop-blur-xl md:hidden">
        {mobileNavItems.map((item) => {
          const isActive = pathname === item.to || (item.to !== '/discover' && pathname.startsWith(item.to))
          return (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className={`flex flex-col items-center gap-1 transition-colors ${
                isActive ? 'text-accent' : 'text-muted hover:text-white'
              }`}
            >
              <item.icon size={20} />
              <span className="text-[10px] font-medium">{item.label}</span>
              {isActive && (
                <div className="absolute bottom-1.5 h-1 w-1 rounded-full bg-accent" />
              )}
            </button>
          )
        })}
      </nav>
    </>
  )
}
