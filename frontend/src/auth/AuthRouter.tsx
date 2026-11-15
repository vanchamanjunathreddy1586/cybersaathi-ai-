import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import type { ReactNode } from 'react'
import App from '../App'
import { useAuth } from './AuthContext'
import {
  AuthCallbackPage,
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResetPasswordPage,
} from './AuthPages'
import { WelcomePage } from './WelcomePage'
import { PwaExperience } from '../components/PwaExperience'
import { sanitizeRedirectDestination } from './validation'

function AuthLoading() {
  return (
    <main className="auth-page">
      <p className="auth-loading" role="status">Restoring your secure session…</p>
    </main>
  )
}

function HomeRoute() {
  const { user, loading } = useAuth()
  if (loading) {
    return <AuthLoading />
  }
  return user ? <App /> : <WelcomePage />
}

function PublicAuthRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoading />
  }
  if (user) {
    const from = (location.state as { from?: string } | null)?.from
    const destination = sanitizeRedirectDestination(from)
    return <Navigate replace to={destination} />
  }
  return children
}

function DashboardRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return <AuthLoading />
  }
  if (!user) {
    const returnDestination = sanitizeRedirectDestination(
      location.pathname + location.search + location.hash,
    )
    return <Navigate replace to="/login" state={{ from: returnDestination }} />
  }
  return <App />
}

export function AuthRouter() {
  return (
    <>
    <PwaExperience />
    <Routes>
      <Route element={<HomeRoute />} path="/" />
      <Route element={<HomeRoute />} path="/welcome" />
      <Route element={<DashboardRoute />} path="/recovery" />
      <Route element={<DashboardRoute />} path="/recovery/:vectorId" />
      <Route element={<DashboardRoute />} path="/scanner" />
      <Route element={<DashboardRoute />} path="/app-security" />
      <Route element={<DashboardRoute />} path="/call-security" />
      <Route element={<DashboardRoute />} path="/family-safety" />
      <Route element={<DashboardRoute />} path="/history" />
      <Route element={<DashboardRoute />} path="/history/:id" />
      <Route element={<DashboardRoute />} path="/investigations" />
      <Route element={<DashboardRoute />} path="/investigations/:id" />
      <Route element={<DashboardRoute />} path="/community" />
      <Route element={<DashboardRoute />} path="/academy" />
      <Route element={<DashboardRoute />} path="/assistant" />
      <Route element={<DashboardRoute />} path="/security" />
      <Route element={<DashboardRoute />} path="/security/safety-score" />
      <Route element={<DashboardRoute />} path="/security/soc" />
      <Route element={<DashboardRoute />} path="/security/threats" />
      <Route element={<DashboardRoute />} path="/security/alerts" />
      <Route element={<DashboardRoute />} path="/security/insights" />
      <Route element={<DashboardRoute />} path="/security/analytics" />
      <Route element={<DashboardRoute />} path="/security/account" />
      <Route element={<DashboardRoute />} path="/settings/permissions" />
      <Route element={<AuthCallbackPage />} path="/auth/callback" />
      <Route
        element={<PublicAuthRoute><LoginPage /></PublicAuthRoute>}
        path="/login"
      />
      <Route
        element={<PublicAuthRoute><RegisterPage /></PublicAuthRoute>}
        path="/register"
      />
      <Route
        element={<PublicAuthRoute><ForgotPasswordPage /></PublicAuthRoute>}
        path="/forgot-password"
      />
      <Route element={<ResetPasswordPage />} path="/reset-password" />
      <Route element={<Navigate replace to="/" />} path="*" />
    </Routes>
    </>
  )
}
