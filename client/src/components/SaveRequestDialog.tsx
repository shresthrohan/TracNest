import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { Collection, RequestSpec, SavedRequest } from '@/types'

const NEW = '__new'

export function SaveRequestDialog({ open, onOpenChange, spec, defaultName, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; spec: RequestSpec; defaultName: string; onSaved: (r: SavedRequest) => void
}) {
  const qc = useQueryClient()
  const cols = useQuery({ queryKey: ['collections'], queryFn: () => api<Collection[]>('/collections'), enabled: open })
  const [name, setName] = useState('')
  const [col, setCol] = useState('')
  const [newCol, setNewCol] = useState('')

  useEffect(() => { if (open) { setName(defaultName); setNewCol('') } }, [open, defaultName])
  useEffect(() => {
    if (!cols.data) return
    if (cols.data.length === 0) setCol(NEW)
    else if (!cols.data.some((c) => c.id === col)) setCol(cols.data[0].id)
  }, [cols.data, col])

  const save = useMutation({
    mutationFn: async () => {
      const collectionId = col === NEW ? (await api<Collection>('/collections', { body: { name: newCol.trim() } })).id : col
      return api<SavedRequest>('/requests', { body: { collectionId, name: name.trim(), spec } })
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      qc.invalidateQueries({ queryKey: ['collection-requests'] })
      toast.success('Request saved')
      onOpenChange(false)
      onSaved(r)
    },
    onError: (e: Error) => toast.error(e.message),
  })
  const valid = name.trim() && (col !== NEW || newCol.trim())

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Save request</DialogTitle>
          <DialogDescription>Saved requests live in a collection and can be used by test suites.</DialogDescription>
        </DialogHeader>
        <form id="save-request" className="space-y-3" onSubmit={(e) => { e.preventDefault(); if (valid) save.mutate() }}>
          <div className="space-y-1.5"><Label htmlFor="sr-name">Name</Label><Input id="sr-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1.5">
            <Label>Collection</Label>
            {cols.isLoading ? <Input disabled placeholder="Loading" /> : (
              <Select value={col} onValueChange={setCol}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cols.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  <SelectItem value={NEW}>New collection</SelectItem>
                </SelectContent>
              </Select>
            )}
            {cols.isError && <p className="text-xs text-destructive">{cols.error.message}</p>}
          </div>
          {col === NEW && (
            <div className="space-y-1.5"><Label htmlFor="sr-col">New collection name</Label><Input id="sr-col" value={newCol} onChange={(e) => setNewCol(e.target.value)} /></div>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button type="submit" form="save-request" disabled={!valid || save.isPending}>{save.isPending && <Loader2 className="animate-spin" />}Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
