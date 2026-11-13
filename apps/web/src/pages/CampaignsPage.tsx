import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Search, Sparkles, UserCheck } from "lucide-react";
import { api, formatDate, formatNumber } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";

type Action = {
  action_id: string; usuario_key: number; status: string; offer_title: string;
  personalized_message: string; offer_discount_pct?: number; ai_generated?: boolean;
  created_at: string; approved_at?: string; contacted_at?: string; reactivated_at?: string;
};
type Recommendation = { usuarioKey: number; name: string; customerCode: string };

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

const labels: Record<string, string> = {
  proposed: "Pendiente", approved: "Aprobada", contacted: "Contactado",
  responded: "Respondio", reactivated: "Reactivado", dismissed: "Descartada",
};
const styles: Record<string, string> = {
  proposed: "bg-[#f5efdf] text-[#96713e]", approved: "bg-[#e8edf1] text-[#5d7681]",
  contacted: "bg-[#e7efe8] text-[#416c52]", reactivated: "bg-[#e7efe8] text-[#416c52]",
  responded: "bg-[#e8edf1] text-[#5d7681]", dismissed: "bg-[#f1eeec] text-[#7d7772]",
};

export function CampaignsPage() {
  const [actions, setActions] = useState<Action[]>([]);
  const [customers, setCustomers] = useState<Recommendation[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const data = await api<{ actions: Action[]; recommendations: Recommendation[] }>("/agent/recommendations");
      setActions(data.actions); setCustomers(data.recommendations);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cargar el seguimiento."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("seren:data-updated", refresh);
    return () => window.removeEventListener("seren:data-updated", refresh);
  }, []);

  const names = new Map(customers.map((item) => [String(item.usuarioKey), item]));
  const term = normalizeSearch(search.trim());
  const filteredActions = actions.filter((action) => {
    const person = names.get(String(action.usuario_key));
    const fallbackName = "Customer #" + action.usuario_key;
    return !term ||
      normalizeSearch(person?.name ?? fallbackName).includes(term) ||
      normalizeSearch(person?.customerCode ?? "").includes(term) ||
      normalizeSearch(String(action.usuario_key)).includes(term);
  });
  const contacted = actions.filter((item) => ["contacted", "responded", "reactivated"].includes(item.status)).length;
  const reactivated = actions.filter((item) => item.status === "reactivated").length;

  return <>
    <PageHeader eyebrow="Customer success" title="De la recomendacion al regreso." description="Registra la aprobacion, el contacto y la reactivacion. Seren AI no envia mensajes automaticamente en esta etapa." />
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <div className="surface-card p-5"><Clock3 className="text-[#96713e]" size={18} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Acciones registradas</p><p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(actions.length)}</p></div>
      <div className="surface-card p-5"><MessageSquareText className="text-[#5d7681]" size={18} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Contactos registrados</p><p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(contacted)}</p></div>
      <div className="surface-card p-5"><UserCheck className="text-forest" size={18} /><p className="mt-3 text-[10px] font-bold uppercase tracking-wider text-muted">Clientes reactivados</p><p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(reactivated)}</p></div>
    </div>
    <Panel title="Seguimiento de acciones" subtitle="Historial operativo del agente">
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && !actions.length && <div className="py-12 text-center"><CheckCircle2 className="mx-auto text-forest" size={24} /><p className="mt-3 text-sm font-semibold text-ink">Aun no hay acciones registradas</p><p className="mt-1 text-xs text-muted">Ejecuta el analisis en Agente Seren para generar propuestas.</p></div>}
      {!loading && !error && actions.length > 0 && <>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative min-w-0 flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input-control pl-10"
              placeholder="Buscar cliente por nombre o codigo..."
              aria-label="Buscar cliente por nombre o codigo"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <span className="text-[10px] text-muted">{filteredActions.length} de {actions.length} acciones</span>
        </div>
        {filteredActions.length > 0 ? (
          <div className="overflow-x-auto"><table className="data-table"><thead><tr><th>Customer</th><th>Oferta y mensaje</th><th>Descuento</th><th>Estado</th><th>Creada</th><th>Ultimo avance</th><th>Asistente</th></tr></thead><tbody>
            {filteredActions.map((action) => {
              const person = names.get(String(action.usuario_key));
              const updated = action.reactivated_at ?? action.contacted_at ?? action.approved_at ?? action.created_at;
              return <tr key={action.action_id}>
                <td><div className="font-semibold text-ink">{person?.name ?? "Customer #" + action.usuario_key}</div><div className="text-[10px] text-muted">{person?.customerCode ?? ""}</div></td>
                <td><div className="max-w-[360px] font-semibold text-ink">{action.offer_title}</div><p className="mt-1 max-w-[360px] text-[10px] leading-4 text-muted">{action.personalized_message}</p></td>
                <td className="font-semibold text-forest">{Number(action.offer_discount_pct ?? 0)}%</td>
                <td><span className={"rounded-full px-2.5 py-1 text-[10px] font-bold " + (styles[action.status] ?? styles.proposed)}>{labels[action.status] ?? action.status}</span></td>
                <td>{formatDate(action.created_at)}</td><td>{formatDate(updated)}</td>
                <td><button type="button" className="inline-flex items-center gap-1.5 text-[10px] font-bold text-forest hover:underline" onClick={() => window.dispatchEvent(new CustomEvent("seren:select-customer", { detail: { customerKey: action.usuario_key, customerLabel: person?.name ?? "Cliente seleccionado" } }))}><Sparkles size={12} /> Seren</button></td>
              </tr>;
            })}
          </tbody></table></div>
        ) : (
          <div className="py-10 text-center text-xs text-muted">No se encontraron acciones para ese nombre o codigo de cliente.</div>
        )}
      </>}
    </Panel>
  </>;
}
