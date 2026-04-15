import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AdminSidebar } from './components/layout/AdminSidebar'
import { AdminTopbar } from './components/layout/AdminTopbar'
import { AdminBreadcrumb } from './components/layout/AdminBreadcrumb'
import { DashboardPage } from './pages/DashboardPage'
import { ScrapersPage } from './pages/ScrapersPage'
import { JobsPage } from './pages/JobsPage'
import { StudentsPage } from './pages/StudentsPage'
import { SkillsPage } from './pages/SkillsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

/**
 * Admin router shell — renders sidebar + topbar layout with nested page routes.
 * All sub-routes live under /admin/*.
 */
export function AdminApp() {
  return (
    <div className="flex h-screen bg-[#0f0f11] font-['Inter',sans-serif] overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1a1a1f',
            color: '#e4e4e7',
            border: '1px solid rgba(255,255,255,0.08)',
            fontSize: '13px',
          },
        }}
      />

      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <AdminTopbar />

        <main className="flex-1 overflow-y-auto bg-[#0f0f11]">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <AdminBreadcrumb />

            <Routes>
              <Route index element={<Navigate to="dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="scrapers" element={<ScrapersPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="students" element={<StudentsPage />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
