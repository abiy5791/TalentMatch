import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { Layout } from './components/Layout'
import { PortalLayout } from './components/PortalLayout'
import { CandidateLayout } from './components/CandidateLayout'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { CandidatesPage } from './pages/CandidatesPage'
import { JobsPage } from './pages/JobsPage'
import { ApplicationsPage } from './pages/ApplicationsPage'
import { MatchingPage } from './pages/MatchingPage'
import { PipelinePage } from './pages/PipelinePage'
import { PlacementsPage } from './pages/PlacementsPage'
import { AnalyticsPage } from './pages/AnalyticsPage'
import { SettingsPage } from './pages/SettingsPage'
import { PortalOverviewPage } from './pages/portal/PortalOverviewPage'
import { PortalCandidatesPage } from './pages/portal/PortalCandidatesPage'
import { PortalRolesPage } from './pages/portal/PortalRolesPage'
import { PortalPlacementsPage } from './pages/portal/PortalPlacementsPage'
import { PortalTeamPage } from './pages/portal/PortalTeamPage'
import { CareersPage } from './pages/public/CareersPage'
import { JobDetailPage } from './pages/public/JobDetailPage'
import { MyApplicationsPage } from './pages/candidate/MyApplicationsPage'
import { MyProfilePage } from './pages/candidate/MyProfilePage'
import {
  ProtectedRoute, RequirePermission, RequireSurface, homePathFor,
} from './components/ProtectedRoute'
import { PERMISSIONS as P } from './lib/permissions'

/** Sends each account to the surface it belongs on. */
function Home() {
  const { user } = useAuth()
  return <Navigate to={homePathFor(user)} replace />
}

/**
 * An unknown URL means one of two things: a signed-in user mistyped, or a
 * visitor followed a stale link. The first goes home, the second to the board —
 * never to a login wall for a page that is public anyway.
 */
function NotFound() {
  const { user, isLoading } = useAuth()
  if (isLoading) return null
  return <Navigate to={user ? homePathFor(user) : '/careers'} replace />
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ---- Public job board — no session required ---- */}
          <Route path="/careers" element={<CareersPage />} />
          <Route path="/careers/:slug" element={<JobDetailPage />} />

          <Route path="/login" element={<LoginPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/" element={<Home />} />

            {/* ---- Recruiter console ---- */}
            <Route element={<RequireSurface surface="console" />}>
              <Route element={<Layout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/settings" element={<SettingsPage />} />

                {/* Each section is gated on the permission its API calls require. */}
                <Route element={<RequirePermission permission={P.COMPANIES_READ} />}>
                  <Route path="/companies" element={<CompaniesPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.CANDIDATES_READ} />}>
                  <Route path="/candidates" element={<CandidatesPage />} />
                  <Route path="/applications" element={<ApplicationsPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.JOBS_READ} />}>
                  <Route path="/jobs" element={<JobsPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.MATCHING_READ} />}>
                  <Route path="/matching" element={<MatchingPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.PIPELINE_READ} />}>
                  <Route path="/pipeline" element={<PipelinePage />} />
                </Route>
                <Route element={<RequirePermission permission={P.PLACEMENTS_READ} />}>
                  <Route path="/placements" element={<PlacementsPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.ANALYTICS_READ} />}>
                  <Route path="/analytics" element={<AnalyticsPage />} />
                </Route>
              </Route>
            </Route>

            {/* ---- Client portal ---- */}
            <Route element={<RequireSurface surface="portal" />}>
              <Route element={<PortalLayout />}>
                <Route path="/portal" element={<PortalOverviewPage />} />
                <Route path="/portal/candidates" element={<PortalCandidatesPage />} />
                <Route path="/portal/roles" element={<PortalRolesPage />} />
                <Route path="/portal/placements" element={<PortalPlacementsPage />} />
                <Route element={<RequirePermission permission={P.PORTAL_TEAM_READ} />}>
                  <Route path="/portal/team" element={<PortalTeamPage />} />
                </Route>
              </Route>
            </Route>

            {/* ---- Applicant area ---- */}
            <Route element={<RequireSurface surface="candidate" />}>
              <Route element={<CandidateLayout />}>
                <Route element={<RequirePermission permission={P.ME_APPLICATIONS_READ} />}>
                  <Route path="/me" element={<MyApplicationsPage />} />
                </Route>
                <Route element={<RequirePermission permission={P.ME_PROFILE_READ} />}>
                  <Route path="/me/profile" element={<MyProfilePage />} />
                </Route>
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App
