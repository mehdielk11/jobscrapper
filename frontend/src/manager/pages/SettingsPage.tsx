import { useState, useEffect } from 'react'
import { useManagerOrg } from '../hooks/useManagerOrg'
import { RefreshCw, Copy, Check, Save } from 'lucide-react'
import { toast } from 'react-hot-toast'

export function SettingsPage() {
  const { org, updateOrg, regenerateInviteCode } = useManagerOrg()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [saving, setSaving] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (org) {
      setName(org.name || '')
      setDescription(org.description || '')
    }
  }, [org])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await updateOrg(name.trim(), description.trim())
      toast.success('Organisation updated')
    } catch (err: any) {
      toast.error(err.message || 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      await regenerateInviteCode()
      toast.success('Invite code regenerated')
    } catch (err: any) {
      toast.error(err.message || 'Failed to regenerate')
    } finally {
      setRegenerating(false)
    }
  }

  const copyCode = () => {
    if (!org?.invite_code) return
    navigator.clipboard.writeText(org.invite_code)
    setCopied(true)
    toast.success('Copied!')
    setTimeout(() => setCopied(false), 2000)
  }

  if (!org) return null

  return (
    <div className="space-y-8 pb-12 max-w-2xl">
      <div>
        <h1 className="text-xl font-bold text-foreground font-['Sora',sans-serif]">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your organisation details</p>
      </div>

      {/* Org info */}
      <form onSubmit={handleSave} className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-5">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Organisation Details</h2>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all"
            required
          />
        </div>

        <div>
          <label className="text-[10px] font-black text-muted-foreground uppercase tracking-widest mb-2 block">Description</label>
          <textarea
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
            className="w-full px-4 py-3 rounded-xl bg-muted/50 border border-border text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-emerald-500/30 transition-all resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </form>

      {/* Invite Code */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Invite Code</h2>
        <p className="text-xs text-muted-foreground">Students use this code to join your organisation.</p>

        <div className="flex items-center gap-3">
          <code className="flex-1 px-4 py-3 rounded-xl bg-muted/50 border border-border text-lg font-mono font-bold text-foreground tracking-[0.3em] text-center">
            {org.invite_code}
          </code>
          <button
            onClick={copyCode}
            className="p-3 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
          >
            {copied ? <Check size={18} /> : <Copy size={18} />}
          </button>
        </div>

        <button
          onClick={handleRegenerate}
          disabled={regenerating}
          className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={regenerating ? 'animate-spin' : ''} />
          Regenerate Code
        </button>
        <p className="text-[10px] text-muted-foreground/60">Warning: regenerating will invalidate the current code. Students who haven't joined yet will need the new code.</p>
      </div>
    </div>
  )
}
