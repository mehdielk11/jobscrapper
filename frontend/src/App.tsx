import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from '@/components/layout'
import Home from '@/pages/home'
import Login from '@/pages/login'
import Profile from '@/pages/profile'
import Recommendations from '@/pages/recommendations'
import Account from '@/pages/account'
import { useAuth } from '@/context/auth-context'
import { AdminGuard } from '@/admin/AdminGuard'
import { AdminApp } from '@/admin/AdminApp'

function StudentGuard({ children }: { children: React.ReactNode }) {
  const { user, role, isAdmin, roleLoading } = useAuth()

  // Wait for role to be determined before deciding where to route
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f0f11]">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  // Administrators should not be in the student app
  if (isAdmin) {
    return <Navigate to="/admin/dashboard" replace />
  }

  // Only allowed if they are students or have no specific role yet (defaulting to student)
  return <>{children}</>
}

function App() {
  return (
    <Routes>
      {/* Admin panel — completely separate shell */}
      <Route
        path="/admin/*"
        element={
          <AdminGuard>
            <AdminApp />
          </AdminGuard>
        }
      />

      {/* Student-facing app */}
      <Route path="/" element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="login" element={<Login />} />
        
        {/* Protected Student Routes */}
        <Route path="profile" element={
          <StudentGuard>
            <Profile />
          </StudentGuard>
        } />
        <Route path="recommendations" element={
          <StudentGuard>
            <Recommendations />
          </StudentGuard>
        } />
        <Route path="account" element={
          <StudentGuard>
            <Account />
          </StudentGuard>
        } />
      </Route>
    </Routes>
  )
}

export default App
