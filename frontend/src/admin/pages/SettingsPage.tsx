import { Save, AlertTriangle } from 'lucide-react'
import { toast } from 'react-hot-toast'
import { useState } from 'react'
import { PageHeader } from '../components/shared/PageHeader'
import { ConfirmModal } from '../components/shared/ConfirmModal'
import { useAppConfig } from '../hooks/useAppConfig'
import { supabase } from '@/lib/supabase'

interface SectionProps {
  title: string
  children: React.ReactNode
}

const Section = ({ title, children }: SectionProps) => (
  <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-6">
    <h3 className="text-sm font-bold text-foreground font-['Sora',sans-serif] border-b border-border/50 pb-4 uppercase tracking-widest">{title}</h3>
    {children}
  </div>
)

interface ToggleProps {
  label: string
  description?: string
  value: boolean
  onChange: (v: boolean) => void
}

const Toggle = ({
  label,
  description,
  value,
  onChange,
}: ToggleProps) => (
  <div className="flex items-center justify-between py-2">
    <div>
      <p className="text-sm font-bold text-foreground">{label}</p>
      {description && <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1 opacity-70">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-all duration-300 shadow-inner ${value ? 'bg-primary' : 'bg-muted'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${value ? 'translate-x-5' : ''}`} />
    </button>
  </div>
)

/**
 * SettingsPage — global platform configuration with danger zone.
 * Reads/writes Supabase app_config table via useAppConfig hook.
 */
export function SettingsPage() {
  const { config, loading, saving, updateConfig, saveConfig } = useAppConfig()
  const [clearJobsOpen, setClearJobsOpen] = useState(false)
  const [resetSkillsOpen, setResetSkillsOpen] = useState(false)

  const handleSave = async () => {
    await saveConfig()
    toast.success('Settings saved')
  }

  const clearAllJobs = async () => {
    const { error } = await supabase.from('jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Failed to clear jobs')
    } else {
      toast.success('All jobs cleared')
      setClearJobsOpen(false)
    }
  }

  const resetAllSkills = async () => {
    const { error } = await supabase.from('student_skills').delete().neq('id', '00000000-0000-0000-0000-000000000000')
    if (error) {
      toast.error('Failed to reset skills')
    } else {
      toast.success('All student skills reset')
      setResetSkillsOpen(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1,2,3].map(i => (
          <div key={i} className="h-24 bg-muted border border-border rounded-2xl animate-pulse" />
        ))}
      </div>
    )
  }


  return (
    <div>
      <PageHeader
        title="Settings"
        description="Configure global platform behavior"
        action={
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
          >
            <Save size={16} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      <div className="space-y-4">
        {/* Scraper settings */}
        <Section title="⚙️ Scraper Settings">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Default jobs per source</label>
              <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md text-center min-w-[2.5rem]">{config.scraper_limit_per_source}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={config.scraper_limit_per_source}
              onChange={e => updateConfig('scraper_limit_per_source', Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer appearance-none"
            />
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Delay between requests</label>
              <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md text-center min-w-[2.5rem]">{config.scraper_delay_seconds}s</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={config.scraper_delay_seconds}
              onChange={e => updateConfig('scraper_delay_seconds', Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer appearance-none"
            />
          </div>
          <Toggle
            label="Auto-run NLP after scrape"
            description="Automatically extract skills from newly scraped jobs"
            value={config.auto_run_nlp}
            onChange={v => updateConfig('auto_run_nlp', v)}
          />
        </Section>

        {/* NLP settings */}
        <Section title="🧠 NLP Settings">
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Minimum keyword confidence</label>
              <span className="text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded-md text-center min-w-[2.5rem]">{config.nlp_confidence_threshold}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={config.nlp_confidence_threshold}
              onChange={e => updateConfig('nlp_confidence_threshold', Number(e.target.value))}
              className="w-full h-1.5 bg-muted rounded-full accent-primary cursor-pointer appearance-none"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Language mode</label>
            <div className="flex gap-2">
              {(['french', 'english', 'both'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => updateConfig('nlp_language', lang)}
                  className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm ${
                    config.nlp_language === lang
                      ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/20 scale-105'
                      : 'bg-muted/50 text-muted-foreground hover:bg-muted border border-border'
                  }`}
                >
                  {lang}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* Auth settings */}
        <Section title="🔐 Auth Settings">
          <Toggle
            label="Allow new student registrations"
            description="When disabled, new sign-ups will be blocked"
            value={config.allow_registrations}
            onChange={v => updateConfig('allow_registrations', v)}
          />
        </Section>

        {/* Danger zone */}
        <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 space-y-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-red-400" />
            <h3 className="text-sm font-semibold text-red-400 font-['Sora',sans-serif]">Danger Zone</h3>
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">Clear All Jobs</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1 opacity-70">Permanently deletes all job records from the database</p>
            </div>
            <button
              onClick={() => setClearJobsOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest border border-destructive/20 hover:bg-destructive hover:text-white transition-all shadow-sm"
            >
              Clear Jobs
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-border/10 pt-4">
            <div>
              <p className="text-sm font-bold text-foreground">Reset All Student Skills</p>
              <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest mt-1 opacity-70">Removes all skill entries from student profiles</p>
            </div>
            <button
              onClick={() => setResetSkillsOpen(true)}
              className="px-5 py-2.5 rounded-xl bg-destructive/10 text-destructive text-[10px] font-black uppercase tracking-widest border border-destructive/20 hover:bg-destructive hover:text-white transition-all shadow-sm"
            >
              Reset Skills
            </button>
          </div>
        </div>
      </div>

      <ConfirmModal
        isOpen={clearJobsOpen}
        onConfirm={clearAllJobs}
        onCancel={() => setClearJobsOpen(false)}
        title="Clear All Jobs"
        message="This will permanently delete ALL job records. This cannot be undone."
        confirmLabel="Clear All Jobs"
        variant="danger"
        requireTyping="DELETE"
      />

      <ConfirmModal
        isOpen={resetSkillsOpen}
        onConfirm={resetAllSkills}
        onCancel={() => setResetSkillsOpen(false)}
        title="Reset Student Skills"
        message="This will remove all extracted skills from every student profile."
        confirmLabel="Reset Skills"
        variant="danger"
      />
    </div>
  )
}
