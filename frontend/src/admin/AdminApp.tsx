import { Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AdminSidebar } from './components/layout/AdminSidebar'
import { AdminTopbar } from './components/layout/AdminTopbar'
import { AdminBreadcrumb } from './components/layout/AdminBreadcrumb'
import { DashboardPage } from './pages/DashboardPage'
import { ScrapersPage } from './pages/ScrapersPage'
import { JobsPage } from './pages/JobsPage'
import { UsersPage } from './pages/UsersPage'
import { SkillsPage } from './pages/SkillsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'

/**
 * Admin router shell — renders sidebar + topbar layout with nested page routes.
 * All sub-routes live under /admin/*.
 */
export function AdminApp() {
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

      <AdminSidebar />

      <div className="flex flex-col flex-1 min-w-0 overflow-hidden transition-all duration-300">
        <AdminTopbar />

        <main className="flex-1 overflow-y-auto bg-background/50 transition-colors duration-500">
          <div className="max-w-7xl mx-auto px-6 py-6">
            <AdminBreadcrumb />

            <Routes>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="scrapers" element={<ScrapersPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="students" element={<Navigate to="/admin/users" replace />} />
              <Route path="skills" element={<SkillsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<Navigate to="/admin/dashboard" replace />} />
            </Routes>
          </div>
        </main>
      </div>
    </div>
  )
}
