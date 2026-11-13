import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/ui/Feedback";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { PublicHomePage } from "./pages/PublicHomePage";
import { InSpaExperiencePage } from "./pages/InSpaExperiencePage";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ChurnPage } from "./pages/ChurnPage";
import { AgentPage } from "./pages/AgentPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

function RequireSession({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingState label="Verificando sesion..." />;
  return session
    ? children
    : <Navigate to="/login" replace state={{ from: location }} />;
}

function LegacyStaffRedirect({ section }: { section: string }) {
  return <Navigate to={"/staff" + (section ? "/" + section : "")} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<PublicHomePage />} />
      <Route path="/experiencia" element={<InSpaExperiencePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/staff"
        element={<RequireSession><AppLayout /></RequireSession>}
      >
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="churn" element={<ChurnPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/staff" replace />} />
      </Route>

      {/* Preserve old internal URLs while moving the workspace under /staff. */}
      <Route path="/customers" element={<LegacyStaffRedirect section="customers" />} />
      <Route path="/churn" element={<LegacyStaffRedirect section="churn" />} />
      <Route path="/agent" element={<LegacyStaffRedirect section="agent" />} />
      <Route path="/campaigns" element={<LegacyStaffRedirect section="campaigns" />} />
      <Route path="/reports" element={<LegacyStaffRedirect section="reports" />} />
      <Route path="/settings" element={<LegacyStaffRedirect section="settings" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
