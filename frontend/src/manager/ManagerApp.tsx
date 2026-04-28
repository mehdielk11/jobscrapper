import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { ManagerSidebar } from './components/ManagerSidebar'
import { ManagerTopbar } from './components/ManagerTopbar'
import { OnboardingPage } from './pages/OnboardingPage'
import { DashboardPage } from './pages/DashboardPage'
import { MembersPage } from './pages/MembersPage'
import { SkillDemandPage } from './pages/SkillDemandPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { useManagerOrg } from './hooks/useManagerOrg'

/**
 * ManagerApp — Academic Manager panel shell.
 * If the manager has no org yet, force them to onboarding.
 */
export function ManagerApp() {
  const { org, loading } = useManagerOrg()

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // No org yet → force onboarding
  if (!org) {
    return (
      <Routes>
        <Route path="*" element={<OnboardingPage />} />
      </Routes>
    )
  }

  return (
    <div className="flex h-screen bg-background text-foreground font-['Inter',sans-serif] overflow-hidden transition-colors duration-500">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            border: '1px solid var(--border)',
            fontSize: '13px',
          },
        }}
      />

      <ManagerSidebar orgName={org.name} />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300">
        <ManagerTopbar orgName={org.name} />

        <main className="flex-1 overflow-y-auto bg-background/50 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <Routes>
              <Route index element={<Navigate to="/manager/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route path="skill-demand" element={<SkillDemandPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="onboarding" element={<Navigate to="/manager/dashboard" replace />} />
              <Route path="*" element={<Navigate to="/manager/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
