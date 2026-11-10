import { useEffect, useMemo, useState } from "react";
import { Check, ClipboardCopy, MessageCircle, RefreshCw, Sparkles, ThumbsUp, UserCheck } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { RiskBadge } from "../components/ui/RiskBadge";

type Recommendation = {
  usuarioKey: number; customerCode: string; name: string; segment: string;
  riskLevel: string; riskScore: number; riskReason: string; daysSinceLastPurchase: number;
  expectedIntervalDays: number | null; favoriteProduct: { name: string } | null;
  offerDiscount: number; offerTitle: string; personalizedMessage: string; aiGenerated?: boolean;
};
type Action = {
  action_id: string; usuario_key: number; status: string; offer_title: string;
  personalized_message: string; approved_at?: string; contacted_at?: string; reactivated_at?: string;
};
type AgentPayload = { migrationReady: boolean; migrationMessage?: string; recommendations: Recommendation[]; actions: Action[] };

const statusLabels: Record<string, string> = {
  proposed: "Pendiente de aprobacion", approved: "Aprobada", contacted: "Contacto registrado",
  responded: "Respondio", reactivated: "Reactivado", dismissed: "Descartada",
};

export function AgentPage() {
  const [data, setData] = useState<AgentPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setData(await api<AgentPayload>("/agent/recommendations")); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar las recomendaciones."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  async function runAnalysis() {
    setRunning(true); setError(""); setNotice("");
    try {
      const result = await api<{ assessedCustomers: number; recommendationsCreated: number; highRisk: number; mediumRisk: number; message: string; ai?: { used: boolean; model: string; generated: number; fallback: number; warning?: string } }>("/agent/analyze", { method: "POST", body: JSON.stringify({}) });
      setNotice(result.message + " Evaluados: " + result.assessedCustomers + ". Recomendaciones: " + result.recommendationsCreated + ". Mistral: " + (result.ai?.generated ?? 0) + " personalizadas; " + (result.ai?.fallback ?? 0) + " con plantilla." + (result.ai?.warning ? " " + result.ai.warning : ""));
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo ejecutar el agente."); }
    finally { setRunning(false); }
  }

  async function updateAction(actionId: string, status: string) {
    setError(""); setNotice("");
    try {
      await api("/agent/actions/" + actionId + "/status", { method: "PATCH", body: JSON.stringify({ status }) });
      setNotice("Accion actualizada: " + (statusLabels[status] ?? status) + ".");
      await load();
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo actualizar la accion."); }
  }

  const actionsByUser = useMemo(() => {
    const map = new Map<string, Action>();
    for (const action of data?.actions ?? []) {
      const key = String(action.usuario_key);
      if (!map.has(key)) map.set(key, action);
    }
    return map;
  }, [data]);

  return <>
    <PageHeader eyebrow="Copiloto de retencion" title="El siguiente mejor paso, sugerido." description="Seren convierte señales de comportamiento en propuestas concretas. El equipo del spa mantiene el control y aprueba cada contacto." action={<button className="primary-button" onClick={() => void runAnalysis()} disabled={running}><RefreshCw size={15} className={running ? "animate-spin" : ""} /> {running ? "Analizando..." : "Ejecutar analisis"}</button>} />
    {notice && <div className="mb-4 rounded-xl border border-[#cdddcf] bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-forest">{notice}</div>}
    {error && <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div>}
    {loading && <LoadingState />}
    {data && !data.migrationReady && <div className="mb-5 rounded-xl border border-[#e9d8b7] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#80633b]">{data.migrationMessage ?? "Ejecuta la migracion operativa para guardar las evaluaciones y acciones."}</div>}
    {data && <>
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#eaf0e9] p-4">
        <div className="rounded-xl bg-white p-2 text-forest"><Sparkles size={18} /></div>
        <div><p className="text-xs font-bold text-ink">Como decide Seren</p><p className="mt-1 text-[11px] leading-5 text-muted">El motor estadistico calcula el riesgo y el producto favorito. Mistral Small 4 personaliza las propuestas prioritarias (hasta 20 por ejecucion); si la API no esta disponible, se conserva una plantilla segura. Ningun mensaje se envia sin aprobacion humana.</p></div>
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.recommendations.map((item) => {
          const action = actionsByUser.get(String(item.usuarioKey));
          return <Panel key={item.usuarioKey} title={item.name} subtitle={"Customer #" + item.customerCode + " · " + item.segment} action={<RiskBadge level={item.riskLevel} />}>
            <div className="flex flex-wrap gap-2 text-[10px] text-muted"><span>{item.daysSinceLastPurchase} dias sin regresar</span><span>·</span><span>Intervalo habitual {item.expectedIntervalDays ?? "—"} dias</span><span>·</span><span>Indice {item.riskScore}/100</span></div>
            <div className="mt-4 rounded-xl bg-[#f8f8f4] p-3"><p className="text-[10px] font-bold uppercase tracking-wider text-forest/65">Senal detectada</p><p className="mt-1 text-xs leading-5 text-ink">{item.riskReason}</p></div>
            <div className="mt-3 flex items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Recomendacion</p><p className="mt-1 text-xs font-semibold text-ink">{item.offerTitle}</p><p className="mt-1 text-[10px] text-muted">Beneficio sugerido: {item.offerDiscount}% · Preferencia: {item.favoriteProduct?.name ?? "Por identificar"}</p></div><div className="rounded-xl bg-[#f3eee3] px-3 py-2 text-center"><p className="font-display text-xl font-bold text-[#96713e]">{item.offerDiscount}%</p><p className="text-[9px] font-bold uppercase text-[#96713e]">Oferta</p></div></div>
            <div className="mt-4 rounded-xl border border-line bg-white p-3"><div className="mb-2 flex items-center justify-between"><div className="flex items-center gap-2"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Mensaje personalizado</p>{item.aiGenerated && <span className="rounded-full bg-[#eaf0e9] px-2 py-1 text-[9px] font-bold text-forest">Mistral AI</span>}</div><button className="inline-flex items-center gap-1 text-[10px] font-bold text-forest" onClick={() => void navigator.clipboard?.writeText(item.personalizedMessage)}><ClipboardCopy size={12} /> Copiar</button></div><p className="text-xs leading-6 text-ink">{item.personalizedMessage}</p></div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <span className="text-[10px] font-semibold text-muted">{action ? statusLabels[action.status] ?? action.status : "Aun no guardada"}</span>
              {action ? <div className="flex flex-wrap gap-2">
                {action.status === "proposed" && <button className="secondary-button" onClick={() => void updateAction(action.action_id, "approved")}><Check size={13} /> Aprobar</button>}
                {action.status === "approved" && <button className="secondary-button" onClick={() => void updateAction(action.action_id, "contacted")}><MessageCircle size={13} /> Registrar contacto</button>}
                {action.status === "contacted" && <button className="primary-button" onClick={() => void updateAction(action.action_id, "reactivated")}><UserCheck size={13} /> Marcar reactivado</button>}
              </div> : <span className="text-[10px] text-muted">Ejecuta el analisis para guardar</span>}
            </div>
          </Panel>;
        })}
      </div>
      {!data.recommendations.length && !loading && <div className="surface-card p-10 text-center"><ThumbsUp className="mx-auto text-forest" size={22} /><p className="mt-3 font-display text-sm font-bold text-ink">No hay recomendaciones pendientes</p><p className="mt-1 text-xs text-muted">La cartera no presenta riesgo medio o alto con las reglas actuales.</p></div>}
    </>}
  </>;
}
