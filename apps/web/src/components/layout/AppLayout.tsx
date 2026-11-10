import { NavLink, Outlet, useLocation } from "react-router-dom";
import {
  Activity, ChartNoAxesCombined, CircleHelp, LayoutDashboard,
  LogOut, MessageSquareText, Settings2, Sparkles, Users,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";

const navigation = [
  { to: "/", label: "Resumen", icon: LayoutDashboard, end: true },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/churn", label: "Riesgo de churn", icon: Activity },
  { to: "/agent", label: "Agente Seren", icon: Sparkles },
  { to: "/campaigns", label: "Reactivaciones", icon: MessageSquareText },
  { to: "/reports", label: "Reportes BI", icon: ChartNoAxesCombined },
];
const titles: Record<string, string> = {
  "/": "Resumen ejecutivo",
  "/customers": "Customers",
  "/churn": "Centro de riesgo",
  "/agent": "Agente Seren AI",
  "/campaigns": "Reactivaciones",
  "/reports": "Inteligencia de negocio",
  "/settings": "Configuracion del sistema",
};

export function AppLayout() {
  const { session, signOut } = useAuth();
  const location = useLocation();
  const email = session?.user.email ?? "Usuario";
  const firstName = String(session?.user.user_metadata?.full_name ?? email.split("@")[0]).split(" ")[0];

  return (
    <div className="min-h-screen bg-canvas lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="sidebar-shell hidden lg:flex lg:flex-col">
        <div className="flex items-center gap-3 px-6 pb-8 pt-7">
          <div className="brand-mark"><Sparkles size={19} /></div>
          <div>
            <p className="font-display text-[17px] font-extrabold tracking-tight text-white">seren<span className="text-[#c8a978]">.</span></p>
            <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-white/45">Intelligence for care</p>
          </div>
        </div>
        <div className="mx-4 mb-7 rounded-2xl border border-white/10 bg-white/[0.06] px-3.5 py-3">
          <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-white/40">Workspace</p>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#d9e4da] text-[11px] font-bold text-forest">O</div>
            <div><p className="text-xs font-semibold text-white">Origen Spa</p><p className="text-[10px] text-white/45">Customers · Fase 4</p></div>
          </div>
        </div>
        <div className="px-6 pb-3 text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Workspace</div>
        <nav className="space-y-1 px-3">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "nav-link " + (isActive ? "nav-link-active" : "")}>
              <Icon size={17} strokeWidth={1.8} /><span>{item.label}</span>
              {item.to === "/churn" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#d7a46e]" />}
            </NavLink>;
          })}
        </nav>
        <div className="px-6 pb-3 pt-8 text-[9px] font-bold uppercase tracking-[0.2em] text-white/35">Administracion</div>
        <nav className="space-y-1 px-3">
          <NavLink to="/settings" className={({ isActive }) => "nav-link " + (isActive ? "nav-link-active" : "")}><Settings2 size={17} /><span>Configuracion</span></NavLink>
        </nav>
        <div className="mt-auto p-4">
          <div className="rounded-2xl bg-[#304c43] p-4">
            <div className="flex items-center gap-2 text-[#d9c19c]"><CircleHelp size={15} /><span className="text-[10px] font-bold uppercase tracking-[0.12em]">Centro de ayuda</span></div>
            <p className="mt-2 text-[11px] leading-5 text-white/65">Seren identifica señales. Tu equipo decide como recuperar la relacion.</p>
          </div>
          <button onClick={() => void signOut()} className="mt-4 flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-xs font-semibold text-white/55 transition hover:bg-white/10 hover:text-white">
            <LogOut size={16} /> Cerrar sesion
          </button>
        </div>
      </aside>
      <main className="min-w-0">
        <header className="sticky top-0 z-20 flex h-[72px] items-center justify-between border-b border-line/80 bg-canvas/90 px-5 backdrop-blur-xl sm:px-8">
          <div className="flex items-center gap-3">
            <div className="brand-mark lg:hidden"><Sparkles size={17} /></div>
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">Origen Spa <span className="px-1 text-[#c5b89f]">/</span> {titles[location.pathname] ?? "Seren AI"}</p>
              <p className="mt-0.5 font-display text-sm font-bold text-ink">Hola, {firstName}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-xs font-semibold text-ink">{email}</p><p className="text-[10px] text-muted">Sesion autenticada</p></div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">{email.slice(0, 1).toUpperCase()}</div>
          </div>
        </header>
        <nav className="mobile-nav lg:hidden">
          {navigation.map((item) => {
            const Icon = item.icon;
            return <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => "mobile-nav-link " + (isActive ? "mobile-nav-link-active" : "")}>
              <Icon size={15} /><span>{item.label}</span>
            </NavLink>;
          })}
        </nav>
        <div className="mx-auto max-w-[1440px] px-5 py-7 sm:px-8 lg:px-10"><Outlet /></div>
        <footer className="px-5 pb-7 text-center text-[10px] text-muted sm:px-8">Seren AI · Inteligencia de retencion proactiva · Origen Spa</footer>
      </main>
    </div>
  );
}
