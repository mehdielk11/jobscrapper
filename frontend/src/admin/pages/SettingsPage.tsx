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
  <div className="bg-[#1a1a1f] border border-white/5 rounded-2xl p-5 space-y-5">
    <h3 className="text-sm font-semibold text-zinc-300 font-['Sora',sans-serif] border-b border-white/5 pb-3">{title}</h3>
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
  <div className="flex items-center justify-between">
    <div>
      <p className="text-sm text-zinc-300">{label}</p>
      {description && <p className="text-xs text-zinc-600 mt-0.5">{description}</p>}
    </div>
    <button
      onClick={() => onChange(!value)}
      className={`relative w-10 h-5 rounded-full transition-colors ${value ? 'bg-indigo-500' : 'bg-zinc-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${value ? 'translate-x-5' : ''}`} />
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
          <div key={i} className="h-24 bg-[#1a1a1f] rounded-2xl animate-pulse" />
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
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save Changes'}
          </button>
        }
      />

      <div className="space-y-4">
        {/* Scraper settings */}
        <Section title="⚙️ Scraper Settings">
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm text-zinc-400">Default jobs per source</label>
              <span className="text-sm font-mono text-zinc-300">{config.scraper_limit_per_source}</span>
            </div>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={config.scraper_limit_per_source}
              onChange={e => updateConfig('scraper_limit_per_source', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <div className="flex justify-between mb-1">
              <label className="text-sm text-zinc-400">Delay between requests (seconds)</label>
              <span className="text-sm font-mono text-zinc-300">{config.scraper_delay_seconds}s</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={5}
              step={0.5}
              value={config.scraper_delay_seconds}
              onChange={e => updateConfig('scraper_delay_seconds', Number(e.target.value))}
              className="w-full accent-indigo-500"
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
            <div className="flex justify-between mb-1">
              <label className="text-sm text-zinc-400">Minimum keyword confidence</label>
              <span className="text-sm font-mono text-zinc-300">{config.nlp_confidence_threshold}</span>
            </div>
            <input
              type="range"
              min={0.3}
              max={0.9}
              step={0.05}
              value={config.nlp_confidence_threshold}
              onChange={e => updateConfig('nlp_confidence_threshold', Number(e.target.value))}
              className="w-full accent-indigo-500"
            />
          </div>
          <div>
            <label className="text-sm text-zinc-400 block mb-2">Language mode</label>
            <div className="flex gap-2">
              {(['french', 'english', 'both'] as const).map(lang => (
                <button
                  key={lang}
                  onClick={() => updateConfig('nlp_language', lang)}
                  className={`px-3 py-1.5 rounded-lg text-xs capitalize transition-colors ${
                    config.nlp_language === lang
                      ? 'bg-indigo-500 text-white'
                      : 'bg-white/5 text-zinc-400 hover:bg-white/10'
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
              <p className="text-sm text-zinc-300">Clear All Jobs</p>
              <p className="text-xs text-zinc-600">Permanently deletes all job records from the database</p>
            </div>
            <button
              onClick={() => setClearJobsOpen(true)}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors"
            >
              Clear Jobs
            </button>
          </div>
          <div className="flex items-center justify-between border-t border-red-500/10 pt-4">
            <div>
              <p className="text-sm text-zinc-300">Reset All Student Skills</p>
              <p className="text-xs text-zinc-600">Removes all skill entries from student profiles</p>
            </div>
            <button
              onClick={() => setResetSkillsOpen(true)}
              className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 text-sm border border-red-500/20 hover:bg-red-500/20 transition-colors"
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
