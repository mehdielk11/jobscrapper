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

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  if (!user) {
    return <Navigate to="/login" replace />
  }
  return children
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
        <Route path="profile" element={
          <PrivateRoute>
            <Profile />
          </PrivateRoute>
        } />
        <Route path="recommendations" element={
          <PrivateRoute>
            <Recommendations />
          </PrivateRoute>
        } />
        <Route path="account" element={
          <PrivateRoute>
            <Account />
          </PrivateRoute>
        } />
      </Route>
    </Routes>
  )
}

export default App
