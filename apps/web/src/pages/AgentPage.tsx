import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, MessageCircle, RefreshCw, Search, SlidersHorizontal, Sparkles, ThumbsUp, UserCheck } from "lucide-react";
import { api } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { RiskBadge } from "../components/ui/RiskBadge";

type Recommendation = {
  usuarioKey: number; customerCode: string; name: string; segment: string;
  riskLevel: string; riskScore: number; riskReason: string; daysSinceLastPurchase: number;
  expectedIntervalDays: number | null; favoriteProduct: { name: string } | null;
  offerDiscount: number; offerTitle: string; personalizedMessage: string; aiGenerated?: boolean; aiExplanation?: string | null;
};
type Action = {
  action_id: string; assessment_id?: string; usuario_key: number; status: string; offer_title: string;
  personalized_message: string; approved_at?: string; contacted_at?: string; reactivated_at?: string;
};
type AgentPayload = {
  migrationReady: boolean;
  migrationMessage?: string;
  recommendations: Recommendation[];
  activeBatchRecommendations?: Recommendation[];
  activeBatchActions?: Action[];
  activeBatchNumber?: number;
  activeBatchSize?: number;
  remainingCandidates?: number;
  actions: Action[];
  aiProvider?: { configured: boolean; model: string };
};
type NextBatchResult = {
  generated: number;
  batchNumber?: number;
  remainingCandidates?: number;
  waitingForApproval?: boolean;
  approvedCount?: number;
  batchSize?: number;
  queueComplete?: boolean;
  warning?: boolean;
  message?: string;
};

const PAGE_SIZE = 10;
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
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState("ALL");
  const [page, setPage] = useState(1);

  async function load() {
    setLoading(true); setError("");
    try { setData(await api<AgentPayload>("/agent/recommendations")); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar las recomendaciones."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("seren:data-updated", refresh);
    return () => window.removeEventListener("seren:data-updated", refresh);
  }, []);
  useEffect(() => { setPage(1); }, [search, riskFilter]);

  const activeRecommendations = useMemo(
    () => (data?.activeBatchRecommendations ?? []).filter((item) => item.aiGenerated === true),
    [data],
  );
  const filteredRecommendations = useMemo(() => {
    const term = search.trim().toLowerCase();
    return activeRecommendations.filter((item) => {
      const matchesSearch = !term ||
        item.name.toLowerCase().includes(term) ||
        item.customerCode.toLowerCase().includes(term);
      const matchesRisk = riskFilter === "ALL" || item.riskLevel === riskFilter;
      return matchesSearch && matchesRisk;
    });
  }, [activeRecommendations, search, riskFilter]);
  const totalPages = Math.max(1, Math.ceil(filteredRecommendations.length / PAGE_SIZE));
  const visibleRecommendations = useMemo(
    () => filteredRecommendations.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredRecommendations, page],
  );

  const actionsByUser = useMemo(() => {
    const map = new Map<string, Action>();
    for (const action of data?.activeBatchActions ?? []) {
      map.set(String(action.usuario_key), action);
    }
    return map;
  }, [data]);

  const pendingApprovalCount = (data?.activeBatchActions ?? []).filter((item) => item.status === "proposed").length;
  const hasPendingApprovals = pendingApprovalCount > 0;

  async function runAnalysis() {
    setRunning(true); setError(""); setNotice("");
    try {
      const result = await api<{
        assessedCustomers: number; recommendationsCreated: number; highRisk: number; mediumRisk: number;
        message: string; ai?: { used: boolean; model: string; generated: number; fallback: number; warning?: string };
      }>("/agent/analyze", { method: "POST", body: JSON.stringify({}) });
      const groqGenerated = result.ai?.generated ?? result.recommendationsCreated;
      const savedCards = result.recommendationsCreated;
      setNotice(
        result.message + " Clientes evaluados: " + result.assessedCustomers +
        ". Tarjetas de Groq guardadas: " + savedCards + "." +
        (groqGenerated !== savedCards
          ? " Groq valido " + groqGenerated + " propuestas, pero solo se guardaron " + savedCards + "."
          : "") +
        (result.ai?.warning ? " " + result.ai.warning : "")
      );
      setSearch("");
      setRiskFilter("ALL");
      setPage(1);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo ejecutar el agente.");
    } finally {
      setRunning(false);
    }
  }

  async function requestNextBatch() {
    setRunning(true); setError(""); setNotice("");
    try {
      const next = await api<NextBatchResult>("/agent/next-batch", {
        method: "POST",
        body: JSON.stringify({}),
      });
      if (next.generated > 0) {
        setNotice("Se genero el lote " + next.batchNumber + " con " + next.generated + " nuevas recomendaciones de Groq.");
        setSearch("");
        setRiskFilter("ALL");
        setPage(1);
      } else if (next.queueComplete) {
        setNotice(next.message ?? "No quedan mas clientes elegibles en esta ejecucion.");
      } else if (next.waitingForApproval) {
        setNotice("Aprobaciones del lote: " + next.approvedCount + " de " + next.batchSize + ".");
      } else {
        setNotice(next.message ?? "No se pudo generar el siguiente lote.");
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el siguiente lote.");
    } finally {
      setRunning(false);
    }
  }

  async function updateAction(actionId: string, status: string) {
    setError(""); setNotice("");
    try {
      await api("/agent/actions/" + actionId + "/status", {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });

      let message = "Accion actualizada: " + (statusLabels[status] ?? status) + ".";
      if (status === "approved") {
        try {
          const next = await api<NextBatchResult>("/agent/next-batch", {
            method: "POST",
            body: JSON.stringify({}),
          });
          if (next.generated > 0) {
            message = "Lote aprobado. Se genero el lote " + next.batchNumber +
              " con " + next.generated + " nuevas recomendaciones de Groq.";
            setSearch("");
            setRiskFilter("ALL");
            setPage(1);
          } else if (next.waitingForApproval) {
            message += " Aprobaciones del lote: " + next.approvedCount + " de " + next.batchSize + ".";
          } else if (next.queueComplete) {
            message += " No quedan mas clientes elegibles en esta ejecucion.";
          } else if (next.warning || next.message) {
            message += " " + (next.message ?? "Groq no pudo generar este lote; puedes reintentarlo.");
          }
        } catch (batchError) {
          message += " La aprobacion se guardo, pero no se pudo consultar el siguiente lote: " +
            (batchError instanceof Error ? batchError.message : "error inesperado");
        }
      }
      setNotice(message);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar la accion.");
    }
  }

  return <>
    <PageHeader
      eyebrow="Copiloto de retencion"
      title="El siguiente mejor paso, sugerido."
      description="Seren muestra exclusivamente recomendaciones generadas por Groq AI. Cada lote contiene hasta 20 clientes; al aprobar todas sus propuestas, se prepara automaticamente el siguiente."
      action={
        <button className="primary-button" onClick={() => void runAnalysis()} disabled={running || hasPendingApprovals}>
          <RefreshCw size={15} className={running ? "animate-spin" : ""} />
          {running ? "Analizando..." : hasPendingApprovals ? "Aprueba el lote actual" : "Ejecutar analisis"}
        </button>
      }
    />

    {notice && <div className="mb-4 rounded-xl border border-[#cdddcf] bg-[#edf4ee] px-4 py-3 text-xs leading-5 text-forest">{notice}</div>}
    {error && <div className="mb-4"><ErrorState message={error} onRetry={() => void load()} /></div>}
    {loading && <LoadingState />}
    {data && !data.migrationReady && <div className="mb-5 rounded-xl border border-[#e9d8b7] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#80633b]">{data.migrationMessage ?? "Ejecuta la migracion operativa para guardar las evaluaciones y acciones."}</div>}
    {data?.aiProvider && !data.aiProvider.configured && <div className="mb-5 rounded-xl border border-[#e9d8b7] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#80633b]">Groq aun no esta configurado en el backend. Agrega GROQ_API_KEY en el servicio API de Render para activar la personalizacion con IA.</div>}

    {data && data.migrationReady && <>
      <div className="mb-5 flex items-start gap-3 rounded-2xl bg-[#eaf0e9] p-4">
        <div className="rounded-xl bg-white p-2 text-forest"><Sparkles size={18} /></div>
        <div>
          <p className="text-xs font-bold text-ink">Como decide Seren</p>
          <p className="mt-1 text-[11px] leading-5 text-muted">
            El motor estadistico calcula el riesgo y la preferencia de consumo. Groq genera la explicacion y el mensaje de cada tarjeta visible. Las plantillas de respaldo no se muestran. Ningun mensaje se envia sin aprobacion humana.
          </p>
        </div>
      </div>

      {data.activeBatchSize ? (
        <div className="mb-4 flex flex-col gap-2 rounded-xl border border-line bg-white/70 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-bold text-ink">Lote {data.activeBatchNumber} · {data.activeBatchSize} recomendaciones de Groq</p>
            <p className="mt-1 text-xs text-muted">
              Pendientes de aprobacion: {pendingApprovalCount}. Clientes restantes por procesar: {data.remainingCandidates ?? 0}.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-[#eaf0e9] px-3 py-1.5 text-[10px] font-bold text-forest">Solo contenido generado por IA</span>
            {data.remainingCandidates !== undefined && data.remainingCandidates > 0 && pendingApprovalCount === 0 && (
              <button className="primary-button" onClick={() => void requestNextBatch()} disabled={running}>
                {running ? "Generando..." : "Procesar siguientes 20"}
              </button>
            )}
          </div>
        </div>
      ) : null}

      {activeRecommendations.length > 0 && <>
        <div className="mb-4 flex flex-col gap-3 md:flex-row">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              className="input-control pl-10"
              placeholder="Buscar por nombre o codigo de cliente..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={15} className="text-muted" />
            <select className="select-control" value={riskFilter} onChange={(event) => setRiskFilter(event.target.value)}>
              <option value="ALL">Todos los riesgos</option>
              <option value="HIGH">Riesgo alto</option>
              <option value="MEDIUM">Riesgo moderado</option>
            </select>
          </div>
        </div>

        <div className="mb-3 flex items-center justify-between text-[11px] text-muted">
          <span>{filteredRecommendations.length} recomendaciones coinciden con la consulta</span>
          <span>Se muestran {PAGE_SIZE} por pagina</span>
        </div>

        {filteredRecommendations.length > 0 ? (
          <>
            <div className="grid gap-4 xl:grid-cols-2">
              {visibleRecommendations.map((item) => {
                const action = actionsByUser.get(String(item.usuarioKey));
                return (
                  <Panel key={item.usuarioKey} title={item.name} subtitle={"Customer #" + item.customerCode + " · " + item.segment} action={<RiskBadge level={item.riskLevel} />}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eaf0e9] px-2.5 py-1 text-[9px] font-bold text-forest">Groq AI</span>
                      <span className="text-[10px] text-muted">{item.daysSinceLastPurchase} dias sin regresar</span>
                      <span className="text-[10px] text-muted">· Intervalo habitual {item.expectedIntervalDays ?? "—"} dias</span>
                      <span className="text-[10px] text-muted">· Indice {item.riskScore}/100</span>
                    </div>

                    <div className="rounded-xl bg-[#f8f8f4] p-3">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-forest/65">Senal detectada</p>
                      <p className="mt-1 text-xs leading-5 text-ink">{item.riskReason}</p>
                    </div>

                    {item.aiExplanation && (
                      <div className="mt-3 rounded-xl border border-[#d8e3d7] bg-[#f4f8f3] p-3">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-forest">Interpretacion de Groq AI</p>
                        <p className="mt-1 text-xs leading-5 text-ink">{item.aiExplanation}</p>
                      </div>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Recomendacion</p>
                        <p className="mt-1 text-xs font-semibold text-ink">{item.offerTitle}</p>
                        <p className="mt-1 text-[10px] text-muted">Beneficio sugerido: {item.offerDiscount}% · Preferencia: {item.favoriteProduct?.name ?? "Por identificar"}</p>
                      </div>
                      <div className="rounded-xl bg-[#f3eee3] px-3 py-2 text-center">
                        <p className="font-display text-xl font-bold text-[#96713e]">{item.offerDiscount}%</p>
                        <p className="text-[9px] font-bold uppercase text-[#96713e]">Oferta</p>
                      </div>
                    </div>

                    <div className="mt-4 rounded-xl border border-line bg-white p-3">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-muted">Mensaje personalizado</p>
                        <button className="inline-flex items-center gap-1 text-[10px] font-bold text-forest" onClick={() => void navigator.clipboard?.writeText(item.personalizedMessage)}>
                          <ClipboardCopy size={12} /> Copiar
                        </button>
                      </div>
                      <p className="text-xs leading-6 text-ink">{item.personalizedMessage}</p>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
                      <span className="text-[10px] font-semibold text-muted">{action ? statusLabels[action.status] ?? action.status : "Aun no guardada"}</span>
                      {action ? (
                        <div className="flex flex-wrap gap-2">
                          {action.status === "proposed" && <button className="secondary-button" onClick={() => void updateAction(action.action_id, "approved")}><Check size={13} /> Aprobar</button>}
                          {action.status === "approved" && <button className="secondary-button" onClick={() => void updateAction(action.action_id, "contacted")}><MessageCircle size={13} /> Registrar contacto</button>}
                          {action.status === "contacted" && <button className="primary-button" onClick={() => void updateAction(action.action_id, "reactivated")}><UserCheck size={13} /> Marcar reactivado</button>}
                        </div>
                      ) : <span className="text-[10px] text-muted">Accion no disponible</span>}
                    </div>
                  </Panel>
                );
              })}
            </div>

            {totalPages > 1 && (
              <div className="mt-5 flex items-center justify-between rounded-xl border border-line bg-white/70 p-3">
                <button className="secondary-button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>
                  <ChevronLeft size={14} /> Anterior
                </button>
                <span className="text-[11px] text-muted">Pagina {page} de {totalPages}</span>
                <button className="secondary-button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>
                  Siguiente <ChevronRight size={14} />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="surface-card p-8 text-center">
            <Search className="mx-auto text-muted" size={22} />
            <p className="mt-3 text-sm font-semibold text-ink">No hay coincidencias</p>
            <p className="mt-1 text-xs text-muted">Prueba con otro nombre, codigo o nivel de riesgo.</p>
          </div>
        )}
      </>}

      {!activeRecommendations.length && !loading && (
        <div className="surface-card p-10 text-center">
          <ThumbsUp className="mx-auto text-forest" size={22} />
          <p className="mt-3 font-display text-sm font-bold text-ink">
            {data.activeBatchNumber
              ? (data.remainingCandidates === 0 ? "No quedan mas clientes por procesar" : "No hay tarjetas de Groq en el lote actual")
              : (data.remainingCandidates ?? 0) > 0 ? "El analisis esta listo para generar el primer lote" : "Aun no se ha generado un lote de recomendaciones"}
          </p>
          <p className="mt-1 text-xs text-muted">
            {data.activeBatchNumber && data.remainingCandidates === 0
              ? "El lote disponible ya fue procesado y no existen mas clientes elegibles en esta ejecucion."
              : (data.remainingCandidates ?? 0) > 0
                ? "Hay " + data.remainingCandidates + " clientes elegibles en la ultima evaluacion. Puedes generar las primeras 20 propuestas sin volver a analizar toda la cartera."
                : "Ejecuta el analisis para que Seren evalúe la cartera y genere hasta 20 propuestas mediante Groq AI. Las plantillas no se muestran."}
          </p>
          {!data.activeBatchNumber && (data.remainingCandidates ?? 0) > 0 && data.aiProvider?.configured && (
            <button className="primary-button mt-5" onClick={() => void requestNextBatch()} disabled={running}>
              <Sparkles size={14} className={running ? "animate-spin" : ""} />
              {running ? "Generando con Groq..." : "Generar primer lote de 20"}
            </button>
          )}
        </div>
      )}
    </>}
  </>;
}
