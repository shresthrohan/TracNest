import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider } from '@/hooks/useAuth'
import { TooltipProvider } from '@/components/ui/tooltip'
import { Toaster } from '@/components/ui/sonner'
import { Skeleton } from '@/components/ui/skeleton'
import AppLayout from '@/layouts/AppLayout'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Playground = lazy(() => import('@/pages/Playground'))
const History = lazy(() => import('@/pages/History'))
const Collections = lazy(() => import('@/pages/Collections'))
const TestSuites = lazy(() => import('@/pages/TestSuites'))
const ResponseDiff = lazy(() => import('@/pages/ResponseDiff'))

const Monitoring = lazy(() => import('@/pages/Monitoring'))
const Settings = lazy(() => import('@/pages/Settings'))

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false } } })

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider delayDuration={200}>
          <BrowserRouter>
            <Suspense fallback={<div className="p-6"><Skeleton className="h-8 w-48" /></div>}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route element={<AppLayout />}>
                <Route index element={<Dashboard />} />
                <Route path="playground" element={<Playground />} />
                <Route path="collections" element={<Collections />} />
                <Route path="suites" element={<TestSuites />} />
                <Route path="diff" element={<ResponseDiff />} />
                <Route path="monitoring" element={<Monitoring />} />
                <Route path="settings" element={<Settings />} />
                <Route path="history" element={<History />} />
                <Route path="*" element={<Dashboard />} />
              </Route>
            </Routes>
            </Suspense>
          </BrowserRouter>
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
