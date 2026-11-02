import { createContext, useContext, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '@/lib/api'
import type { User } from '@/types'

type Ctx = {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (name: string, email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}
const AuthContext = createContext<Ctx | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const me = useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try { return await api<User>('/auth/me') } catch (e) {
        if (e instanceof ApiError && e.status === 401) return null
        throw e
      }
    },
    retry: false,
    staleTime: Infinity,
  })
  const set = (u: User | null) => qc.setQueryData(['me'], u)
  const loginM = useMutation({ mutationFn: (b: { email: string; password: string }) => api<User>('/auth/login', { body: b }), onSuccess: set })
  const regM = useMutation({ mutationFn: (b: { name: string; email: string; password: string }) => api<User>('/auth/register', { body: b }), onSuccess: set })
  const outM = useMutation({
    mutationFn: () => api('/auth/logout', { method: 'POST' }),
    onSuccess: () => { set(null); qc.removeQueries({ predicate: (q) => q.queryKey[0] !== 'me' }) },
  })

  const value: Ctx = {
    user: me.data ?? null,
    loading: me.isLoading,
    login: async (email, password) => { await loginM.mutateAsync({ email, password }) },
    register: async (name, email, password) => { await regM.mutateAsync({ name, email, password }) },
    logout: async () => { await outM.mutateAsync() },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const c = useContext(AuthContext)
  if (!c) throw new Error('useAuth must be used within AuthProvider')
  return c
}
