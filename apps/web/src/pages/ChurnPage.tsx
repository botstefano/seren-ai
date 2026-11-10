import { useEffect, useState } from "react";
import { Activity, ArrowUpRight, CircleAlert, ShieldCheck } from "lucide-react";
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
};

export function ChurnPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [risk, setRisk] = useState("ALL");
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

  const high = items.filter((item) => item.riskLevel === "HIGH").length;
  const medium = items.filter((item) => item.riskLevel === "MEDIUM").length;

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
      {!loading && !error && <div className="space-y-3">
        {items.map((customer) => <div key={customer.usuarioKey} className="rounded-2xl border border-line bg-white/70 p-4 transition hover:border-[#c9d5c9]">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><p className="font-semibold text-ink">{customer.name}</p><RiskBadge level={customer.riskLevel} /><span className="text-[10px] text-muted">ID {customer.customerCode}</span></div>
              <p className="mt-1.5 text-xs leading-5 text-muted">{customer.riskReason}</p>
              <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-[10px] text-muted"><span>Ultima compra: {formatDate(customer.lastPurchaseDate)}</span><span>{customer.daysSinceLastPurchase ?? "—"} dias sin volver</span><span>Habitual: {customer.expectedIntervalDays ?? "—"} dias</span><span>{customer.favoriteProduct?.name ?? "Preferencia por identificar"}</span></div>
            </div>
            <div className="w-full shrink-0 md:w-40">
              <div className="flex items-center justify-between text-[10px]"><span className="font-semibold text-muted">Indice de demora</span><span className="font-bold text-ink">{customer.riskScore}/100</span></div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className={"h-full rounded-full " + (customer.riskLevel === "HIGH" ? "bg-[#c87962]" : "bg-[#c7a46e]")} style={{ width: customer.riskScore + "%" }} /></div>
              <p className="mt-2 text-right text-[10px] text-muted">{customer.overdueRatio ? customer.overdueRatio.toFixed(2) + "x de su intervalo" : "Sin intervalo"}</p>
            </div>
            <a href="/agent" className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-2 text-[11px] font-bold text-forest hover:bg-[#edf3ed]">Ver recomendacion <ArrowUpRight size={14} /></a>
          </div>
        </div>)}
        {!items.length && <div className="py-12 text-center text-xs text-muted">No hay clientes en este nivel de riesgo.</div>}
      </div>}
    </Panel>
  </>;
}
