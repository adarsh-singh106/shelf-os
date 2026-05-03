import { BookOpen, ClipboardList, Home, Package, Settings, Shield, User } from 'lucide-react'
import type { ComponentType } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
  { label: 'Admin', to: '/admin', icon: Settings, admin: true },
  { label: 'Requests', to: '/admin/requests', icon: ClipboardList, admin: true },
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
  const initials = (username || role || 'U')
    .split(' ')
    .slice(0, 2)
    .map((segment) => segment[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2)

  return (
    <aside
      className={`fixed left-0 top-0 z-40 flex h-screen flex-col border-r border-border bg-base transition-[width] duration-200 ease ${
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
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
            {initials || 'U'}
          </div>
          <div
            className={`transition-all duration-150 ${expanded ? 'opacity-100' : 'pointer-events-none w-0 overflow-hidden opacity-0'}`}
          >
            <p className="max-w-[132px] truncate text-xs text-white">{username}</p>
            <span className="inline-flex rounded-full bg-white/10 px-2 py-0.5 text-[10px] uppercase text-muted">{role}</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
