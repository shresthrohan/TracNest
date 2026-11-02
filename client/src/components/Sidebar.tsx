import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { ChevronsLeft, ChevronsRight, LogOut, Waypoints, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

export type NavItem = { to: string; label: string; icon: LucideIcon }
const KEY = 'tracenest.sidebar.collapsed'

export function Sidebar({ items }: { items: NavItem[] }) {
  const { user, logout } = useAuth()
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(KEY) === '1' } catch { return false }
  })
  const toggle = () => {
    setCollapsed(!collapsed)
    try { localStorage.setItem(KEY, collapsed ? '0' : '1') } catch { /* storage unavailable */ }
  }

  return (
    <aside className={cn('flex shrink-0 flex-col border-r bg-sidebar transition-[width] duration-150', collapsed ? 'w-14' : 'w-56')}>
      <div className="flex h-12 items-center gap-2 border-b px-3.5">
        <Waypoints className="size-5 shrink-0 text-primary" />
        {!collapsed && <span className="text-sm font-semibold tracking-tight">TraceNest</span>}
      </div>
      <nav className="flex flex-1 flex-col gap-0.5 p-2">
        {items.map(({ to, label, icon: Icon }) => {
          const link = (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn('flex h-8 items-center gap-2.5 rounded-md px-2.5 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
                  isActive && 'bg-sidebar-accent text-foreground')}
            >
              <Icon className="size-4 shrink-0" />
              {!collapsed && <span>{label}</span>}
            </NavLink>
          )
          return collapsed ? (
            <Tooltip key={to}><TooltipTrigger asChild>{link}</TooltipTrigger><TooltipContent side="right">{label}</TooltipContent></Tooltip>
          ) : link
        })}
      </nav>
      <div className="flex flex-col gap-1 border-t p-2">
        {!collapsed && user && (
          <div className="px-2.5 py-1">
            <p className="truncate text-xs font-medium">{user.name}</p>
            <p className="truncate text-xs text-muted-foreground">{user.email}</p>
          </div>
        )}
        <Button variant="ghost" size="sm" className="justify-start gap-2.5 px-2.5 text-muted-foreground" onClick={() => logout()}>
          <LogOut className="size-4 shrink-0" />{!collapsed && 'Log out'}
        </Button>
        <Button variant="ghost" size="sm" className="justify-start gap-2.5 px-2.5 text-muted-foreground" onClick={toggle} aria-label="Toggle sidebar">
          {collapsed ? <ChevronsRight className="size-4" /> : <><ChevronsLeft className="size-4" />Collapse</>}
        </Button>
      </div>
    </aside>
  )
}
