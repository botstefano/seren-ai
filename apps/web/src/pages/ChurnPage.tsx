import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Activity, ArrowUpRight, CircleAlert, Search, ShieldCheck, Sparkles } from "lucide-react";
import { api, formatDate, formatNumber } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { RiskBadge } from "../components/ui/RiskBadge";

type Customer = {
  usuarioKey: number; customerCode: string; name: string; segment: string;
  lastPurchaseDate: string; totalPurchases: number; daysSinceLastPurchase: number | null;
  expectedIntervalDays: number | null; overdueRatio: number | null; riskLevel: string;
  riskScore: number; riskReason: string; favoriteProduct: { name: string } | null;
  reactivationAction: { actionId: string; status: string; offerTitle: string; personalizedMessage: string; offerDiscountPct: number; aiGenerated: boolean; updatedAt: string } | null;
};

function normalizeSearch(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase();
}

export function ChurnPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [risk, setRisk] = useState("ALL");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const result = await api<{ customers: Customer[] }>("/churn?risk=" + risk);
      setItems(result.customers);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cargar el riesgo."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [risk]);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("seren:data-updated", refresh);
    return () => window.removeEventListener("seren:data-updated", refresh);
  }, [risk]);

  const high = items.filter((item) => item.riskLevel === "HIGH").length;
  const medium = items.filter((item) => item.riskLevel === "MEDIUM").length;
  const term = normalizeSearch(search.trim());
  const filteredItems = items.filter((customer) => !term ||
    normalizeSearch(customer.name).includes(term) || normalizeSearch(customer.customerCode).includes(term)
  );

  return <>
    <PageHeader eyebrow="Early warning system" title="Detecta antes de perder." description="El riesgo se calcula individualmente comparando el tiempo desde la ultima compra con la mediana historica de los intervalos de cada Customer." />
    <div className="mb-5 grid gap-4 sm:grid-cols-3">
      <div className="surface-card flex items-center gap-4 p-5"><div className="rounded-xl bg-[#f7e9e4] p-3 text-[#ad604e]"><CircleAlert size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Riesgo alto</p><p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(high)}</p></div></div>
      <div className="surface-card flex items-center gap-4 p-5"><div className="rounded-xl bg-[#f5efdf] p-3 text-[#96713e]"><Activity size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Riesgo moderado</p><p className="mt-1 font-display text-2xl font-bold text-ink">{formatNumber(medium)}</p></div></div>
      <div className="surface-card flex items-center gap-4 p-5"><div className="rounded-xl bg-[#e7efe8] p-3 text-[#416c52]"><ShieldCheck size={19} /></div><div><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Regla explicable</p><p className="mt-1 text-xs font-semibold text-ink">Mediana individual</p></div></div>
    </div>
    <Panel title="Customers con señales de abandono" subtitle="Ordenados por nivel y puntuacion de riesgo" action={<select className="select-control" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="ALL">Todos los riesgos</option><option value="HIGH">Solo alto</option><option value="MEDIUM">Solo moderado</option></select>}>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && <>
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
          <span className="text-[10px] text-muted">{filteredItems.length} clientes encontrados</span>
        </div>
        <div className="space-y-3">
        {filteredItems.map((customer) => <div key={customer.usuarioKey} className="rounded-2xl border border-line bg-white/70 p-4 transition hover:border-[#c9d5c9]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink">{customer.name}</p><RiskBadge level={customer.riskLevel} /><span className="text-[10px] text-muted">ID {customer.customerCode}</span></div>
              <p className="mt-1.5 text-xs leading-5 text-muted">{customer.riskReason}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted"><span>Ultima compra: {formatDate(customer.lastPurchaseDate)}</span><span>{customer.daysSinceLastPurchase ?? "—"} dias sin volver</span><span>Habitual: {customer.expectedIntervalDays ?? "—"} dias</span><span>{customer.favoriteProduct?.name ?? "Preferencia por identificar"}</span></div>
              {customer.reactivationAction?.aiGenerated && (
                <div className="mt-3 rounded-xl border border-[#dce7dc] bg-[#f5f8f3] px-3 py-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-bold uppercase tracking-wide text-forest">Propuesta guardada</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-[9px] font-semibold text-muted">{customer.reactivationAction.status}</span>
                    <span className="text-[10px] font-bold text-forest">{customer.reactivationAction.offerDiscountPct}% descuento</span>
                  </div>
                  <p className="mt-1 text-[11px] font-semibold text-ink">{customer.reactivationAction.offerTitle}</p>
                </div>
              )}
            </div>
            <div className="w-full shrink-0 md:w-40">
              <div className="flex items-center justify-between text-[10px]"><span className="font-semibold text-muted">Indice de demora</span><span className="font-bold text-ink">{customer.riskScore}/100</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className={"h-full rounded-full " + (customer.riskLevel === "HIGH" ? "bg-[#c87962]" : "bg-[#c7a46e]")} style={{ width: customer.riskScore + "%" }} /></div>
              <p className="mt-2 text-right text-[10px] text-muted">{customer.overdueRatio ? customer.overdueRatio.toFixed(2) + "x de su intervalo" : "Sin intervalo"}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 md:w-44">
              <button
                type="button"
                onClick={() => window.dispatchEvent(new CustomEvent("seren:select-customer", { detail: { customerKey: customer.usuarioKey, customerLabel: customer.name } }))}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-forest px-3 py-2 text-[11px] font-bold text-white hover:bg-[#315b4b]"
              >
                <Sparkles size={14} /> Trabajar con Seren
              </button>
              <Link to="/agent" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-forest hover:bg-[#edf3ed]">Ver en Agente <ArrowUpRight size={14} /></Link>
            </div>
          </div>
        </div>)}
        {!filteredItems.length && <div className="py-12 text-center text-xs text-muted">{term ? "No se encontraron clientes con ese nombre o codigo." : "No hay clientes en este nivel de riesgo."}</div>}
        </div>
      </>}
    </Panel>
  </>;
}
