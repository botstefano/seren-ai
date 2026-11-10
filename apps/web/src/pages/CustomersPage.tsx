import { useEffect, useState } from "react";
import { Search, SlidersHorizontal, Users } from "lucide-react";
import { api, formatDate, formatNumber } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { RiskBadge } from "../components/ui/RiskBadge";

type Customer = {
  usuarioKey: number; customerCode: string; name: string; segment: string;
  lastPurchaseDate: string; totalPurchases: number; expectedIntervalDays: number | null;
  daysSinceLastPurchase: number | null; riskLevel: string; riskScore: number;
  favoriteProduct: { name: string; category: string } | null;
};

export function CustomersPage() {
  const [items, setItems] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [risk, setRisk] = useState("ALL");
  const [segment, setSegment] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const params = new URLSearchParams({ search, risk, segment });
      const result = await api<{ customers: Customer[] }>("/customers?" + params.toString());
      setItems(result.customers);
    } catch (err) { setError(err instanceof Error ? err.message : "No se pudo cargar la cartera."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [search, risk, segment]);

  return <>
    <PageHeader eyebrow="Cartera recurrente" title="Conoce a tus Customers." description="Personas que han realizado dos o mas compras. Payers de una sola compra permanecen fuera del analisis." />
    <Panel title="Cartera de clientes" subtitle={formatNumber(items.length) + " resultados con los filtros actuales"} action={<div className="flex items-center gap-2 text-[10px] font-semibold text-muted"><Users size={15} /> Solo fase Customers</div>}>
      <div className="mb-5 flex flex-col gap-3 md:flex-row">
        <div className="relative flex-1"><Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control pl-10" placeholder="Buscar por nombre o codigo..." value={search} onChange={(event) => setSearch(event.target.value)} /></div>
        <div className="flex items-center gap-2"><SlidersHorizontal size={15} className="text-muted" /><select className="select-control" value={risk} onChange={(event) => setRisk(event.target.value)}><option value="ALL">Todos los riesgos</option><option value="HIGH">Alto</option><option value="MEDIUM">Moderado</option><option value="LOW">Bajo</option><option value="INSUFFICIENT_DATA">Datos insuficientes</option></select><select className="select-control" value={segment} onChange={(event) => setSegment(event.target.value)}><option value="ALL">Todos los segmentos</option><option value="VIP">VIP</option><option value="Frecuente">Frecuente</option><option value="Estable">Estable</option></select></div>
      </div>
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {!loading && !error && <div className="overflow-x-auto">
        <table className="data-table">
          <thead><tr><th>Customer</th><th>Segmento</th><th>Frecuencia</th><th>Ultima compra</th><th>Intervalo habitual</th><th>Riesgo</th></tr></thead>
          <tbody>
            {items.map((customer) => <tr key={customer.usuarioKey}>
              <td><div className="font-semibold text-ink">{customer.name}</div><div className="mt-0.5 text-[10px] text-muted">ID {customer.customerCode}</div></td>
              <td><span className="rounded-lg bg-[#edf1eb] px-2 py-1 text-[10px] font-semibold text-forest">{customer.segment}</span></td>
              <td className="font-semibold text-ink">{customer.totalPurchases} compras</td>
              <td>{formatDate(customer.lastPurchaseDate)}</td>
              <td>{customer.expectedIntervalDays ? formatNumber(customer.expectedIntervalDays, 1) + " dias" : "Sin datos"}</td>
              <td><RiskBadge level={customer.riskLevel} /></td>
            </tr>)}
            {!items.length && <tr><td colSpan={6} className="py-12 text-center text-xs text-muted">No se encontraron Customers con esos filtros.</td></tr>}
          </tbody>
        </table>
      </div>}
    </Panel>
  </>;
}
