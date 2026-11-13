import { useEffect, useState } from "react";
import { Activity, ArrowDownRight, ArrowUpRight, Clock3, Repeat2, Sparkles, Target, Wallet } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, formatMoney, formatMonth, formatNumber } from "../lib/api";
import { PageHeader } from "../components/ui/PageHeader";
import { StatCard } from "../components/ui/StatCard";
import { Panel } from "../components/ui/Panel";
import { ErrorState, LoadingState } from "../components/ui/Feedback";
import { Link } from "react-router-dom";

type Overview = {
  generatedAt: string;
  migrationReady: boolean;
  kpis: {
    totalCustomers: number; repurchaseRate: number; averageFrequency: number;
    averageTicket: number; churnRate: number; highRisk: number; mediumRisk: number;
    lowRisk: number; pendingActions: number; reactivationRate: number; reactivatedActions: number;
  };
  monthly: { month: string; purchases: number; revenue: number }[];
  riskDistribution: { name: string; value: number; key: string }[];
};

const riskColors: Record<string, string> = { HIGH: "#c87962", MEDIUM: "#c7a46e", LOW: "#71927c" };

export function DashboardPage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true); setError("");
    try { setData(await api<Overview>("/overview")); }
    catch (err) { setError(err instanceof Error ? err.message : "Error al consultar el DataMart."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);
  useEffect(() => {
    const refresh = () => { void load(); };
    window.addEventListener("seren:data-updated", refresh);
    return () => window.removeEventListener("seren:data-updated", refresh);
  }, []);

  return (
    <>
      <PageHeader eyebrow="Customer intelligence / Overview" title="Retencion, vista con claridad." description="Una lectura ejecutiva de la recurrencia, el valor del cliente y las señales tempranas de abandono." action={<Link to="/agent" className="primary-button"><Sparkles size={15} /> Abrir agente Seren</Link>} />
      {loading && <LoadingState />}
      {error && <ErrorState message={error} onRetry={() => void load()} />}
      {data && <>
        {!data.migrationReady && <div className="mb-5 rounded-xl border border-[#e9d8b7] bg-[#fbf6e9] px-4 py-3 text-xs leading-5 text-[#80633b]">El DataMart esta conectado. Ejecuta <b>database/seren_ai_operations.sql</b> para habilitar el seguimiento persistente del agente y las reactivaciones.</div>}
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <StatCard label="Customers activos" value={formatNumber(data.kpis.totalCustomers)} detail="Clientes con 2 o mas compras" icon={Repeat2} tone="sage" />
          <StatCard label="Tasa de recompra" value={data.kpis.repurchaseRate.toFixed(1) + "%"} detail="Customers sobre compradores" icon={Target} tone="gold" />
          <StatCard label="Frecuencia promedio" value={data.kpis.averageFrequency.toFixed(1) + "x"} detail="Compras por Customer" icon={Clock3} tone="blue" />
          <StatCard label="Ticket recurrente" value={formatMoney(data.kpis.averageTicket)} detail="Por compra recurrente" icon={Wallet} tone="clay" />
          <StatCard label="Tasa de churn" value={data.kpis.churnRate.toFixed(1) + "%"} detail="Sobre clientes evaluables" icon={Activity} tone="clay" />
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.65fr_1fr]">
          <Panel title="Valor de compras recurrentes" subtitle="Monto bruto y compras por mes · solo fase Customers">
            {data.monthly.length ? <div className="h-[270px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthly} margin={{ top: 12, right: 8, left: -16, bottom: 0 }}>
                  <defs><linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#71927c" stopOpacity={0.24} /><stop offset="95%" stopColor="#71927c" stopOpacity={0.01} /></linearGradient></defs>
                  <CartesianGrid stroke="#e9ece5" strokeDasharray="3 5" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={formatMonth} axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 11 }} />
                  <YAxis tickFormatter={(value) => "S/" + formatNumber(value / 1000) + "k"} axisLine={false} tickLine={false} tick={{ fill: "#89948d", fontSize: 10 }} />
                  <Tooltip formatter={(value) => formatMoney(Number(value))} labelFormatter={(label) => formatMonth(String(label))} contentStyle={{ border: "1px solid #e7e9e2", borderRadius: 14, fontSize: 12 }} />
                  <Area type="monotone" dataKey="revenue" stroke="#547b64" strokeWidth={2.5} fill="url(#revenueFill)" />
                </AreaChart>
              </ResponsiveContainer>
            </div> : <p className="py-16 text-center text-xs text-muted">Sin compras para graficar.</p>}
          </Panel>

          <Panel title="Distribucion de riesgo" subtitle="Estado actual de la cartera recurrente">
            <div className="relative h-[210px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.riskDistribution} dataKey="value" nameKey="name" innerRadius={58} outerRadius={82} paddingAngle={3} stroke="none">
                    {data.riskDistribution.map((item) => <Cell key={item.key} fill={riskColors[item.key] ?? "#a8b1aa"} />)}
                  </Pie>
                  <Tooltip formatter={(value) => formatNumber(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="font-display text-3xl font-bold text-ink">{formatNumber(data.kpis.highRisk + data.kpis.mediumRisk)}</span>
                <span className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">En observacion</span>
              </div>
            </div>
            <div className="space-y-3">
              {data.riskDistribution.map((item) => <div key={item.key} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 text-muted"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: riskColors[item.key] }} />{item.name}</span>
                <span className="font-semibold text-ink">{formatNumber(item.value)} <span className="ml-1 font-normal text-muted">{data.kpis.totalCustomers ? ((item.value / data.kpis.totalCustomers) * 100).toFixed(1) : "0.0"}%</span></span>
              </div>)}
            </div>
          </Panel>
        </div>

        <div className="mt-4 grid gap-4 xl:grid-cols-[1.35fr_1fr]">
          <Panel title="Senales que requieren atencion" subtitle="Clientes que superaron su ciclo de compra estimado" action={<Link to="/churn" className="text-xs font-bold text-forest">Ver cartera →</Link>}>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-[#fbefeb] p-4"><div className="flex items-center gap-2 text-[#ad604e]"><ArrowUpRight size={15} /><span className="text-[10px] font-bold uppercase tracking-wider">Riesgo alto</span></div><p className="mt-3 font-display text-3xl font-bold text-ink">{formatNumber(data.kpis.highRisk)}</p><p className="mt-1 text-[10px] text-muted">Prioridad de contacto</p></div>
              <div className="rounded-2xl bg-[#f8f2e5] p-4"><div className="flex items-center gap-2 text-[#96713e]"><ArrowDownRight size={15} /><span className="text-[10px] font-bold uppercase tracking-wider">Riesgo moderado</span></div><p className="mt-3 font-display text-3xl font-bold text-ink">{formatNumber(data.kpis.mediumRisk)}</p><p className="mt-1 text-[10px] text-muted">Seguimiento preventivo</p></div>
            </div>
            <div className="mt-5 rounded-xl border border-line bg-[#fbfcf9] p-4">
              <div className="flex items-start gap-3"><Activity size={17} className="mt-0.5 text-forest" /><p className="text-xs leading-5 text-muted">Seren compara los dias desde la ultima compra con la mediana del intervalo historico de cada Customer. La clasificacion es explicable y puede revisarse cliente por cliente.</p></div>
            </div>
          </Panel>
          <Panel title="Efectividad de reactivacion" subtitle="Seguimiento de acciones del agente">
            <div className="flex items-end gap-2">
              <p className="font-display text-4xl font-bold text-ink">{data.kpis.reactivationRate.toFixed(1)}%</p>
              <p className="mb-1 text-[11px] text-muted">tasa registrada</p>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[#edf0e9]"><div className="h-full rounded-full bg-forest" style={{ width: data.kpis.reactivationRate + "%" }} /></div>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Acciones pendientes</p><p className="mt-1 text-xl font-bold text-ink">{formatNumber(data.kpis.pendingActions)}</p></div>
              <div><p className="text-[10px] font-semibold uppercase tracking-wider text-muted">Reactivados</p><p className="mt-1 text-xl font-bold text-ink">{formatNumber(data.kpis.reactivatedActions)}</p></div>
            </div>
            <p className="mt-5 text-[10px] leading-5 text-muted">La tasa se calcula sobre acciones con contacto registrado. Aun no se conecta un proveedor de WhatsApp o email.</p>
          </Panel>
        </div>
        <p className="mt-5 text-right text-[10px] text-muted">Datos consultados: {new Date(data.generatedAt).toLocaleString("es-PE")}</p>
      </>}
    </>
  );
}
