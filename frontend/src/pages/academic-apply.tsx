import { useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'
import {
  GraduationCap,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Building2,
  User,
  Mail,
  Globe,
  Users,
  FileText,
} from 'lucide-react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY || ''

const ORG_TYPES = [
  { value: 'university', label: 'University' },
  { value: 'bootcamp', label: 'Bootcamp' },
  { value: 'company', label: 'Company' },
  { value: 'other', label: 'Other' },
]

export default function AcademicApply() {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const { toast } = useToast()

  const [captchaToken, setCaptchaToken] = useState<string | null>(null)
  const captchaRef = useRef<TurnstileInstance>(null)

  // Step 1 fields
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [honeypot, setHoneypot] = useState('')

  // Step 2 fields
  const [orgName, setOrgName] = useState('')
  const [orgType, setOrgType] = useState('')
  const [orgDescription, setOrgDescription] = useState('')
  const [orgWebsite, setOrgWebsite] = useState('')
  const [expectedStudents, setExpectedStudents] = useState('')

  const canProceedStep1 = firstName.trim() && lastName.trim() && email.trim()
  const canSubmitStep2 = orgName.trim() && orgType && orgDescription.trim()

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const resp = await fetch(`${API_BASE}/api/applications/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim().toLowerCase(),
          org_name: orgName.trim(),
          org_type: orgType,
          org_description: orgDescription.trim(),
          org_website: orgWebsite.trim() || null,
          expected_students: expectedStudents ? parseInt(expectedStudents) : null,
          captcha_token: TURNSTILE_SITE_KEY ? captchaToken : 'dev-skip',
          honeypot,
        }),
      })

      if (resp.ok) {
        setSubmitted(true)
      } else if (resp.status === 429) {
        toast({
          title: 'Rate Limit Exceeded',
          description: 'You are submitting too many requests. Please wait a moment and try again.',
          variant: 'destructive',
        })
      } else {
        let errorDetail = 'Something went wrong. Please try again.'
        try {
          const data = await resp.json()
          if (data.detail) errorDetail = data.detail
        } catch {
          // Fallback if response is not JSON
        }
        toast({
          title: 'Application Error',
          description: errorDetail,
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Network Error',
        description: 'Could not reach the server. Please try again later.',
        variant: 'destructive',
      })
    }
    // Always reset captcha on error so they can try again.
    // If it succeeds, the component will unmount/show the success screen.
    if (!submitted) {
      captchaRef.current?.reset()
      setCaptchaToken(null)
    }
    setLoading(false)
  }

  // ── Submitted confirmation ────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] w-full max-w-lg mx-auto py-12 px-4">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-center space-y-6"
        >
          <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/20">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">
            Application Submitted
          </h1>
          <p className="text-slate-500 font-medium max-w-sm mx-auto">
            Thank you for applying! If your application is approved, you'll receive an email with your account setup link.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors mt-4"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[65vh] w-full max-w-lg mx-auto py-6 px-4">
      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center space-y-2 mb-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center mx-auto mb-2 shadow-2xl shadow-primary/20">
          <GraduationCap className="text-primary w-6 h-6" />
        </div>
        <h1 className="text-3xl font-black tracking-tighter text-slate-950 dark:text-white">
          Academic Manager
        </h1>
        <p className="text-xs text-slate-500 font-medium">
          Apply for an institution manager account.
        </p>
      </motion.div>

      {/* Step indicator */}
      <div className="flex items-center gap-3 mb-4 w-full max-w-xs mx-auto">
        <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 1 ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`} />
        <div className={`flex-1 h-1.5 rounded-full transition-colors ${step >= 2 ? 'bg-primary' : 'bg-slate-200 dark:bg-white/10'}`} />
      </div>

      {/* Form card */}
      <motion.div
        key={step}
        initial={{ x: step === 1 ? -20 : 20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.25 }}
        className="glass-card w-full p-6 rounded-[2rem] border-white/5 shadow-3xl"
      >
        {step === 1 ? (
          <>
            <h2 className="text-lg font-black text-slate-950 dark:text-white mb-6">
              Your Details
            </h2>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    placeholder="First name"
                    value={firstName}
                    onChange={e => setFirstName(e.target.value)}
                    maxLength={50}
                    required
                    className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                  />
                </div>
                <div className="relative group">
                  <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="text"
                    placeholder="Last name"
                    value={lastName}
                    onChange={e => setLastName(e.target.value)}
                    maxLength={50}
                    required
                    className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                  />
                </div>
              </div>

              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="email"
                  placeholder="Your email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                />
              </div>

              {/* Honeypot — hidden from humans, bots will fill it */}
              <div style={{ position: 'absolute', left: '-9999px', opacity: 0, height: 0, overflow: 'hidden' }} aria-hidden="true" tabIndex={-1}>
                <input
                  type="text"
                  name="website_url"
                  value={honeypot}
                  onChange={e => setHoneypot(e.target.value)}
                  autoComplete="off"
                  tabIndex={-1}
                />
              </div>
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={!canProceedStep1}
              className="w-full h-14 text-md font-black bg-primary text-white hover:opacity-90 rounded-xl shadow-2xl shadow-primary/20 atom-hover mt-4 disabled:opacity-40"
            >
              <div className="flex items-center gap-2">
                Continue
                <ArrowRight className="w-5 h-5 ml-1" />
              </div>
            </Button>

            <div className="mt-4 text-center pt-4 border-t border-slate-200/50 dark:border-white/5">
              <Link to="/login" className="text-sm font-bold text-primary/70 hover:text-primary transition-colors inline-flex items-center gap-2">
                <ArrowLeft className="w-4 h-4" />
                Already have an account? Login
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-lg font-black text-slate-950 dark:text-white mb-6">
              Your Organisation
            </h2>
            <div className="space-y-4">
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <Input
                  type="text"
                  placeholder="Organisation name"
                  value={orgName}
                  onChange={e => setOrgName(e.target.value)}
                  maxLength={100}
                  required
                  className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                />
              </div>

              {/* Org type select */}
              <div className="relative group">
                <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors pointer-events-none" />
                <select
                  value={orgType}
                  onChange={e => setOrgType(e.target.value)}
                  required
                  className="w-full h-14 pl-12 pr-4 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium appearance-none cursor-pointer"
                >
                  <option value="" disabled>Select type...</option>
                  {ORG_TYPES.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div className="relative group">
                <FileText className="absolute left-4 top-4 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                <textarea
                  placeholder="Why do you need an Academic Manager account? Describe your use case..."
                  value={orgDescription}
                  onChange={e => setOrgDescription(e.target.value)}
                  maxLength={1000}
                  required
                  rows={4}
                  className="w-full pl-12 pr-4 py-4 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700 resize-none text-sm"
                />
                <span className="absolute right-4 bottom-3 text-xs text-slate-400">
                  {orgDescription.length}/1000
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="relative group">
                  <Globe className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="url"
                    placeholder="Website (optional)"
                    value={orgWebsite}
                    onChange={e => setOrgWebsite(e.target.value)}
                    className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                  />
                </div>
                <div className="relative group">
                  <Users className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-600 group-focus-within:text-primary transition-colors" />
                  <Input
                    type="number"
                    placeholder="Users (optional)"
                    value={expectedStudents}
                    onChange={e => setExpectedStudents(e.target.value)}
                    min={1}
                    className="h-14 pl-12 bg-white/50 dark:bg-slate-950/50 border border-slate-200 dark:border-white/5 focus-visible:ring-primary/40 rounded-2xl text-slate-950 dark:text-white font-medium placeholder:text-slate-500 dark:placeholder:text-slate-700"
                  />
                </div>
              </div>
            </div>

            {TURNSTILE_SITE_KEY && (
              <div className="flex justify-center my-4 w-full">
                <Turnstile
                  ref={captchaRef}
                  siteKey={TURNSTILE_SITE_KEY}
                  onSuccess={setCaptchaToken}
                  options={{ size: 'normal' }}
                />
              </div>
            )}

            <div className="flex flex-col-reverse sm:flex-row gap-3 mt-4">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="w-full sm:w-auto h-14 px-6 rounded-xl border-slate-200 dark:border-white/10 font-black flex justify-center items-center"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>

              <Button
                onClick={handleSubmit}
                disabled={loading || !canSubmitStep2 || (!!TURNSTILE_SITE_KEY && !captchaToken)}
                className="w-full sm:flex-1 h-14 text-md font-black bg-primary text-white hover:opacity-90 rounded-xl shadow-2xl shadow-primary/20 atom-hover disabled:opacity-40 flex justify-center items-center"
              >
                {loading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-3 border-white border-t-transparent rounded-full animate-spin" />
                    Submitting...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    Submit Application
                    <ArrowRight className="w-5 h-5 ml-1" />
                  </div>
                )}
              </Button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  )
}
