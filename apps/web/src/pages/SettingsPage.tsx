import { useEffect, useState } from "react";
import { CheckCircle2, Database, KeyRound, LockKeyhole, Server, ShieldCheck } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { LoadingState } from "../components/ui/Feedback";

type Health = { status: string; service: string; databaseConfigured: boolean; timestamp: string };

export function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Health>("/health").then(setHealth).catch(() => setHealth(null)).finally(() => setLoading(false));
  }, []);

  return <>
    <PageHeader eyebrow="Workspace administration" title="Configuracion y conexiones." description="Estado de los servicios y requisitos para operar Seren AI con acceso protegido." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Panel title="Servicios conectados" subtitle="Estado reportado por la API">
        {loading && <LoadingState label="Comprobando servicio..." />}
        {!loading && <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl bg-[#f8f8f4] p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-white p-2 text-forest"><Server size={17} /></div><div><p className="text-xs font-semibold text-ink">Seren AI API</p><p className="text-[10px] text-muted">Node.js · Express</p></div></div><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (health?.status === "ok" ? "bg-[#e7efe8] text-[#416c52]" : "bg-[#f7e8e3] text-[#a85543]")}>{health?.status === "ok" ? "En linea" : "Sin verificar"}</span></div>
          <div className="flex items-center justify-between rounded-xl bg-[#f8f8f4] p-4"><div className="flex items-center gap-3"><div className="rounded-xl bg-white p-2 text-forest"><Database size={17} /></div><div><p className="text-xs font-semibold text-ink">Supabase PostgreSQL</p><p className="text-[10px] text-muted">OLTP + DataMart + esquema operativo</p></div></div><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (health?.databaseConfigured ? "bg-[#e7efe8] text-[#416c52]" : "bg-[#f5efdf] text-[#96713e]")}>{health?.databaseConfigured ? "Credenciales configuradas" : "Pendiente"}</span></div>
          {health?.timestamp && <p className="text-right text-[10px] text-muted">Ultima comprobacion: {new Date(health.timestamp).toLocaleString("es-PE")}</p>}
        </div>}
      </Panel>
      <Panel title="Seguridad de acceso" subtitle="Principios aplicados en esta version">
        <div className="space-y-4">
          <div className="flex gap-3"><ShieldCheck size={18} className="mt-0.5 shrink-0 text-forest" /><div><p className="text-xs font-semibold text-ink">Autenticacion con Supabase Auth</p><p className="mt-1 text-[11px] leading-5 text-muted">La API valida el JWT de la sesion antes de permitir consultas o cambios.</p></div></div>
          <div className="flex gap-3"><KeyRound size={18} className="mt-0.5 shrink-0 text-forest" /><div><p className="text-xs font-semibold text-ink">Service role solo en backend</p><p className="mt-1 text-[11px] leading-5 text-muted">La clave privilegiada nunca se incluye en el bundle del navegador.</p></div></div>
          <div className="flex gap-3"><LockKeyhole size={18} className="mt-0.5 shrink-0 text-forest" /><div><p className="text-xs font-semibold text-ink">Esquemas separados</p><p className="mt-1 text-[11px] leading-5 text-muted">OLTP y DataMart conservan sus esquemas; seren_ai almacena evaluaciones y acciones.</p></div></div>
        </div>
      </Panel>
    </div>
    <Panel title="Configuracion pendiente de Supabase" subtitle="Se requiere una unica preparacion antes de habilitar todas las funciones" className="mt-4">
      <ol className="space-y-3 text-xs leading-5 text-muted">
        <li className="flex gap-3"><span className="step-number">1</span><span>Ejecutar el archivo <b className="text-ink">database/seren_ai_operations.sql</b> en el SQL Editor del proyecto.</span></li>
        <li className="flex gap-3"><span className="step-number">2</span><span>En la configuracion de API/Data API, incluir <b className="text-ink">oltp_origen_spa</b>, <b className="text-ink">datamart_origen_spa</b> y <b className="text-ink">seren_ai</b> entre los esquemas expuestos al backend.</span></li>
        <li className="flex gap-3"><span className="step-number">3</span><span>Crear un usuario administrador en Authentication → Users. La aplicacion utiliza email y contrasena de Supabase Auth.</span></li>
        <li className="flex gap-3"><span className="step-number">4</span><span>Configurar en Render la URL del proyecto y la clave <b className="text-ink">service_role</b> como secreto del servicio API. Nunca usar esa clave en el frontend.</span></li>
      </ol>
      <div className="mt-5 flex items-start gap-2 rounded-xl bg-[#edf4ee] p-3 text-[10px] leading-5 text-forest"><CheckCircle2 size={14} className="mt-0.5 shrink-0" />No se requieren cambios en las tablas OLTP ni en el esquema estrella ya validado.</div>
    </Panel>
  </>;
}
