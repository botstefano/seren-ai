import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatMoney, formatMonth, formatNumber } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";

type ReportData = {
  monthly: { month: string; purchases: number; revenue: number }[];
  frequencyBySegment: { segment: string; customers: number; purchases: number }[];
  customersByRisk: { totalCustomers: number; averageFrequency: number; averageTicket: number; highRisk: number; mediumRisk: number; lowRisk: number };
};

export function ReportsPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try { setData(await api<ReportData>("/reports/monthly")); }
    catch (err) { setError(err instanceof Error ? err.message : "No se pudieron cargar los reportes."); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);

  return <>
    <PageHeader eyebrow="Business intelligence" title="El comportamiento, en contexto." description="Analisis de recurrencia, valor y consumo de la cartera Customers sobre las compras recurrentes conciliadas en el DataMart." />
    {loading && <LoadingState />}
    {error && <ErrorState message={error} onRetry={() => void load()} />}
    {data && <>
      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Recurrencia por segmento" subtitle="Compras recurrentes promedio por cliente">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.frequencyBySegment} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e9ece5" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="segment" axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 11 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 10 }} />
                <Tooltip contentStyle={{ border: "1px solid #e7e9e2", borderRadius: 14, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="customers" name="Customers" fill="#a9bdad" radius={[7, 7, 0, 0]} />
                <Bar dataKey="purchases" name="Compras recurrentes" fill="#547b64" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
        <Panel title="Compras recurrentes por mes" subtitle="Volumen de operaciones incluidas en Fact_Compra_Customer">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.monthly} margin={{ top: 12, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid stroke="#e9ece5" strokeDasharray="3 5" vertical={false} />
                <XAxis dataKey="month" tickFormatter={formatMonth} axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 10 }} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 10 }} />
                <Tooltip labelFormatter={(label) => formatMonth(String(label))} formatter={(value) => formatNumber(Number(value))} contentStyle={{ border: "1px solid #e7e9e2", borderRadius: 14, fontSize: 12 }} />
                <Bar dataKey="purchases" name="Compras" fill="#547b64" radius={[7, 7, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>
      <Panel title="Lectura de gestion" subtitle="Indicadores para orientar decisiones del equipo" className="mt-4">
        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-xl bg-[#f8f8f4] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Frecuencia promedio</p><p className="mt-2 font-display text-2xl font-bold text-ink">{data.customersByRisk.averageFrequency.toFixed(1)} compras</p><p className="mt-1 text-[10px] text-muted">Por Customer en el historial disponible</p></div>
          <div className="rounded-xl bg-[#f8f8f4] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Ticket promedio</p><p className="mt-2 font-display text-2xl font-bold text-ink">{formatMoney(data.customersByRisk.averageTicket)}</p><p className="mt-1 text-[10px] text-muted">Por compra recurrente</p></div>
          <div className="rounded-xl bg-[#f8f8f4] p-4"><p className="text-[10px] font-bold uppercase tracking-wider text-muted">Clientes evaluados</p><p className="mt-2 font-display text-2xl font-bold text-ink">{formatNumber(data.customersByRisk.totalCustomers)}</p><p className="mt-1 text-[10px] text-muted">Excluye Payers de una sola compra</p></div>
        </div>
      </Panel>
      <p className="mt-4 text-[10px] leading-5 text-muted">Nota metodologica: el DataMart excluye la primera compra de cada Customer. La frecuencia total reconstruye esa compra inicial sumando una unidad a las compras recurrentes registradas por cliente. Los importes de los reportes de valor corresponden a operaciones recurrentes.</p>
    </>}
  </>;
}
