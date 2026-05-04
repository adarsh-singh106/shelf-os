import type { ReactElement } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import { useAuth } from '../hooks/useAuth'
import AdminDashboardPage from '../pages/admin/AdminDashboardPage'
import AdminAuditLogPage from '../pages/admin/AdminAuditLogPage'
import AdminInventoryPage from '../pages/admin/AdminInventoryPage'
import AdminMembersPage from '../pages/admin/AdminMembersPage'
import AdminRequestsPage from '../pages/admin/AdminRequestsPage'
import AdminTransactionsPage from '../pages/admin/AdminTransactionsPage'
import DiscoverPage from '../pages/DiscoverPage'
import LandingPage from '../pages/LandingPage'
import MyShelfPage from '../pages/MyShelfPage'
import MySpacePage from '../pages/MySpacePage'

function RequireAuth({ children }: { children: ReactElement }) {
  const { user, isLoading } = useAuth()

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-void text-muted">Loading session...</main>
  }

  if (!user) {
    return <Navigate to="/" replace />
  }

  return children
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-void text-muted">Checking permissions...</main>
  }

  if (!isAdmin) {
    return <Navigate to="/discover" replace />
  }

  return children
}

function LandingRoute() {
  const { user, isAdmin, isLoading } = useAuth()

  if (isLoading) {
    return <main className="grid min-h-screen place-items-center bg-void text-muted">Loading session...</main>
  }

  if (user) {
    return <Navigate to={isAdmin ? '/admin' : '/discover'} replace />
  }

  return <LandingPage />
}

export default function AppRoutes() {
  const { isAdmin, profile, user } = useAuth()

  return (
    <Routes>
      <Route path="/" element={<LandingRoute />} />

      <Route
        element={
          <RequireAuth>
            <AppShell
              isAdmin={Boolean(isAdmin)}
              user={{
                username: profile?.username ?? user?.email?.split('@')[0] ?? 'Member',
                email: profile?.email ?? user?.email ?? 'member@library.local',
              }}
              onSearchOpen={() => {
                // handled internally by AppShell
              }}
            />
          </RequireAuth>
        }
      >
        <Route path="/discover" element={<DiscoverPage />} />
        <Route path="/shelf" element={<MyShelfPage />} />
        <Route path="/my-shelf" element={<Navigate to="/shelf" replace />} />
        <Route path="/space" element={<MySpacePage />} />

        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminDashboardPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/requests"
          element={
            <RequireAdmin>
              <AdminRequestsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/transactions"
          element={
            <RequireAdmin>
              <AdminTransactionsPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/members"
          element={
            <RequireAdmin>
              <AdminMembersPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/audit"
          element={
            <RequireAdmin>
              <AdminAuditLogPage />
            </RequireAdmin>
          }
        />
        <Route
          path="/admin/inventory"
          element={
            <RequireAdmin>
              <AdminInventoryPage />
            </RequireAdmin>
          }
        />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
