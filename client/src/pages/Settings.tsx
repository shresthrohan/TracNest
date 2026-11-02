import { useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2, LogOut } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { useAuth } from '@/hooks/useAuth'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { User } from '@/types'

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border bg-surface">
      <h2 className="border-b px-4 py-2.5 text-xs font-medium text-muted-foreground">{title}</h2>
      <div className="p-4">{children}</div>
    </section>
  )
}

export default function Settings() {
  const { user, logout } = useAuth()
  const qc = useQueryClient()
  const [name, setName] = useState(user?.name ?? '')
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const ai = useQuery({ queryKey: ['ai-status'], queryFn: () => api<{ enabled: boolean }>('/ai/status'), staleTime: 60_000 })

  const patch = useMutation({
    mutationFn: (body: object) => api<User>('/auth/me', { method: 'PATCH', body }),
    onError: (e: Error) => toast.error(e.message),
  })
  const saveName = () => patch.mutate({ name: name.trim() }, { onSuccess: (u) => { qc.setQueryData(['me'], u); toast.success('Profile updated') } })
  const savePw = () => patch.mutate({ currentPassword: cur, newPassword: next }, { onSuccess: () => { setCur(''); setNext(''); setConfirm(''); toast.success('Password changed') } })
  const nameDirty = !!name.trim() && name.trim() !== user?.name
  const pwOk = cur && next.length >= 8 && next === confirm

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-6">
      <h1 className="text-base font-semibold">Settings</h1>

      <Section title="Profile">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (nameDirty) saveName() }}>
          <div className="space-y-1.5"><Label htmlFor="s-name">Name</Label><Input id="s-name" value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-email">Email</Label><Input id="s-email" value={user?.email ?? ''} disabled /></div>
          <Button type="submit" size="sm" disabled={!nameDirty || patch.isPending}>Save changes</Button>
        </form>
      </Section>

      <Section title="Change password">
        <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (pwOk) savePw() }}>
          <div className="space-y-1.5"><Label htmlFor="s-cur">Current password</Label><Input id="s-cur" type="password" autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-new">New password</Label><Input id="s-new" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} aria-describedby="s-hint" /><p id="s-hint" className="text-xs text-muted-foreground">At least 8 characters.</p></div>
          <div className="space-y-1.5"><Label htmlFor="s-conf">Confirm new password</Label><Input id="s-conf" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!confirm && confirm !== next} /></div>
          <Button type="submit" size="sm" disabled={!pwOk || patch.isPending}>{patch.isPending && <Loader2 className="animate-spin" />}Change password</Button>
        </form>
      </Section>

      <Section title="AI assistant">
        {ai.isLoading ? <p className="text-muted-foreground">Checking</p> : ai.isError ? <p className="text-destructive">{ai.error.message}</p> : ai.data?.enabled ? (
          <p>Enabled. Use <span className="font-medium">Explain with AI</span> on a response to get likely causes and suggested assertions. Authorization headers, cookies and query values are never sent.</p>
        ) : (
          <p className="text-muted-foreground">Not configured. Set <span className="font-mono text-xs">ANTHROPIC_API_KEY</span> on the server to enable AI explanations.</p>
        )}
      </Section>

      <Section title="Session">
        <Button variant="outline" size="sm" onClick={() => logout()}><LogOut />Sign out</Button>
      </Section>
    </div>
  )
}
