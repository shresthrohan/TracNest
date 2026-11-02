import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { AuthConfig } from '@/types'

const field = (label: string, value: string, set: (v: string) => void, type = 'text') => (
  <div className="space-y-1.5" key={label}>
    <Label>{label}</Label>
    <Input className="h-8 font-mono text-xs" type={type} value={value} onChange={(e) => set(e.target.value)} autoComplete="off" />
  </div>
)

export function AuthEditor({ value, onChange }: { value: AuthConfig; onChange: (a: AuthConfig) => void }) {
  const setType = (t: AuthConfig['type']) =>
    onChange(
      t === 'none' ? { type: 'none' }
      : t === 'bearer' ? { type: 'bearer', token: '' }
      : t === 'basic' ? { type: 'basic', username: '', password: '' }
      : { type: 'apikey', key: '', value: '', in: 'header' },
    )
  return (
    <div className="max-w-md space-y-3">
      <div className="space-y-1.5">
        <Label>Type</Label>
        <Select value={value.type} onValueChange={(v) => setType(v as AuthConfig['type'])}>
          <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No auth</SelectItem>
            <SelectItem value="bearer">Bearer token</SelectItem>
            <SelectItem value="basic">Basic auth</SelectItem>
            <SelectItem value="apikey">API key</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {value.type === 'bearer' && field('Token', value.token, (token) => onChange({ ...value, token }), 'password')}
      {value.type === 'basic' && (
        <>
          {field('Username', value.username, (username) => onChange({ ...value, username }))}
          {field('Password', value.password, (password) => onChange({ ...value, password }), 'password')}
        </>
      )}
      {value.type === 'apikey' && (
        <>
          {field('Key name', value.key, (key) => onChange({ ...value, key }))}
          {field('Value', value.value, (v) => onChange({ ...value, value: v }), 'password')}
          <div className="space-y-1.5">
            <Label>Send in</Label>
            <Select value={value.in} onValueChange={(v) => onChange({ ...value, in: v as 'header' | 'query' })}>
              <SelectTrigger className="h-8 w-48"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="header">Header</SelectItem>
                <SelectItem value="query">Query parameter</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </>
      )}
      {value.type !== 'none' && (
        <p className="text-xs text-muted-foreground">Credentials are redacted before the request is stored in history.</p>
      )}
    </div>
  )
}
