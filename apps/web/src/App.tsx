import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/layout/AppLayout";
import { LoadingState } from "./components/ui/Feedback";
import { useAuth } from "./context/AuthContext";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { CustomersPage } from "./pages/CustomersPage";
import { ChurnPage } from "./pages/ChurnPage";
import { AgentPage } from "./pages/AgentPage";
import { CampaignsPage } from "./pages/CampaignsPage";
import { ReportsPage } from "./pages/ReportsPage";
import { SettingsPage } from "./pages/SettingsPage";

function RequireSession({ children }: { children: JSX.Element }) {
  const { session, loading } = useAuth();
  if (loading) return <LoadingState label="Verificando sesion..." />;
  return session ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireSession><AppLayout /></RequireSession>}>
        <Route index element={<DashboardPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="churn" element={<ChurnPage />} />
        <Route path="agent" element={<AgentPage />} />
        <Route path="campaigns" element={<CampaignsPage />} />
        <Route path="reports" element={<ReportsPage />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
