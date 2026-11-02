import { useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Loader2, Waypoints } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/hooks/useAuth'

export default function AuthForm({ mode }: { mode: 'login' | 'register' }) {
  const { user, login, register } = useAuth()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const isReg = mode === 'register'
  if (user) return <Navigate to="/" replace />

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = new FormData(e.currentTarget)
    const email = String(f.get('email')), password = String(f.get('password'))
    setBusy(true); setError('')
    try {
      if (isReg) await register(String(f.get('name')), email, password)
      else await login(email, password)
      nav('/', { replace: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Something went wrong'
      setError(msg); toast.error(msg)
    } finally { setBusy(false) }
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <Waypoints className="size-6 text-primary" />
          <span className="text-lg font-semibold tracking-tight">TraceNest</span>
        </div>
        <form onSubmit={submit} className="space-y-4 rounded-lg border bg-surface p-5">
          <div>
            <h1 className="text-base font-semibold">{isReg ? 'Create your account' : 'Log in'}</h1>
            <p className="mt-0.5 text-muted-foreground">{isReg ? 'Test, diff and monitor your APIs.' : 'Welcome back.'}</p>
          </div>
          {isReg && (
            <div className="space-y-1.5"><Label htmlFor="name">Name</Label><Input id="name" name="name" required autoComplete="name" /></div>
          )}
          <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" name="email" type="email" required autoComplete="email" /></div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" required minLength={isReg ? 8 : undefined} autoComplete={isReg ? 'new-password' : 'current-password'} />
            {isReg && <p className="text-xs text-muted-foreground">At least 8 characters.</p>}
          </div>
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy && <Loader2 className="animate-spin" />}{isReg ? 'Create account' : 'Log in'}
          </Button>
        </form>
        <p className="mt-4 text-center text-muted-foreground">
          {isReg ? 'Already have an account?' : 'New to TraceNest?'}{' '}
          <Link className="text-primary hover:underline" to={isReg ? '/login' : '/register'}>{isReg ? 'Log in' : 'Create an account'}</Link>
        </p>
      </div>
    </div>
  )
}
