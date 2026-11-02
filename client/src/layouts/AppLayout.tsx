import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { FlaskConical, FolderOpen, GitCompareArrows, History, LayoutDashboard, Send } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { Sidebar, type NavItem } from '@/components/Sidebar'
import { Skeleton } from '@/components/ui/skeleton'
import { useAuth } from '@/hooks/useAuth'

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/playground', label: 'API Playground', icon: Send },
  { to: '/collections', label: 'Collections', icon: FolderOpen },
  { to: '/suites', label: 'Test Suites', icon: FlaskConical },
  { to: '/diff', label: 'Response Diff', icon: GitCompareArrows },
  { to: '/history', label: 'Request History', icon: History },
]

export default function AppLayout() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  if (loading) return <div className="p-6"><Skeleton className="h-8 w-48" /></div>
  if (!user) return <Navigate to="/login" replace />

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar items={NAV} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}
