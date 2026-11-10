import { fetchAll } from "../lib/supabase.js";
import { buildCustomerInsights, buildPersonalizedMessage } from "./churn.js";
import { env } from "../config/env.js";

let cache = { expiresAt: 0, value: null };
const CACHE_MS = 60_000;

export async function loadAnalytics({ force = false } = {}) {
  if (!force && cache.value && cache.expiresAt > Date.now()) return cache.value;

  const [customers, purchases, details, products, sales] = await Promise.all([
    fetchAll("datamart_origen_spa", "dim_usuario_customer", "usuario_key,codigo_usuario,nombre,segmento,fecha_ultima_compra"),
    fetchAll("datamart_origen_spa", "fact_compra_customer", "id_compra,tiempo_key,sede_key,canal_key,campana_key,metodo_pago_key,usuario_key,cantidad_compras,monto_bruto_compra,monto_descuento,dias_desde_compra_anterior"),
    fetchAll("datamart_origen_spa", "fact_detalle_compra_customer", "id_compra,linea,producto_key,cantidad_items,monto_neto_linea"),
    fetchAll("datamart_origen_spa", "dim_producto", "producto_key,codigo_sku,nombre_item,categoria,tipo"),
    fetchAll("oltp_origen_spa", "venta", "id_venta,id_cliente,fecha_hora,monto_bruto"),
  ]);

  const insights = buildCustomerInsights({ customers, purchases, details, products });
  const allPurchasesByClient = new Map();
  for (const sale of sales) {
    const key = String(sale.id_cliente);
    allPurchasesByClient.set(key, (allPurchasesByClient.get(key) ?? 0) + 1);
  }

  const totalBuyers = allPurchasesByClient.size;
  const recurringBuyerCount = [...allPurchasesByClient.values()].filter((count) => count >= 2).length;
  const highRisk = insights.filter((customer) => customer.riskLevel === "HIGH").length;
  const mediumRisk = insights.filter((customer) => customer.riskLevel === "MEDIUM").length;
  const atRisk = highRisk + mediumRisk;
  const grossRevenue = purchases.reduce((sum, item) => sum + Number(item.monto_bruto_compra ?? 0), 0);
  const averageTicket = purchases.length ? grossRevenue / purchases.length : 0;
  const averageFrequency = insights.length
    ? insights.reduce((sum, item) => sum + item.totalPurchases, 0) / insights.length
    : 0;

  const monthly = new Map();
  for (const purchase of purchases) {
    const timeKey = String(purchase.tiempo_key ?? "");
    const monthKey = timeKey.length >= 6 ? timeKey.slice(0, 6) : "Sin fecha";
    const entry = monthly.get(monthKey) ?? { month: monthKey, purchases: 0, revenue: 0 };
    entry.purchases += 1;
    entry.revenue += Number(purchase.monto_bruto_compra ?? 0);
    monthly.set(monthKey, entry);
  }

  const value = {
    generatedAt: new Date().toISOString(),
    customers: insights,
    purchases,
    details,
    products,
    kpis: {
      totalCustomers: customers.filter((item) => String(item.codigo_usuario) !== "0").length,
      totalBuyers,
      recurringBuyers: recurringBuyerCount,
      repurchaseRate: totalBuyers ? (recurringBuyerCount / totalBuyers) * 100 : 0,
      averageFrequency,
      averageTicket,
      churnRate: insights.length ? (atRisk / insights.length) * 100 : 0,
      highRisk,
      mediumRisk,
      lowRisk: insights.filter((customer) => customer.riskLevel === "LOW").length,
      insufficientData: insights.filter((customer) => customer.riskLevel === "INSUFFICIENT_DATA").length,
      grossRevenue,
      recurringPurchases: purchases.length,
    },
    monthly: [...monthly.values()].sort((a, b) => a.month.localeCompare(b.month)),
  };

  cache = { value, expiresAt: Date.now() + CACHE_MS };
  return value;
}

export function invalidateAnalyticsCache() {
  cache = { expiresAt: 0, value: null };
}

export function createRecommendations(customers) {
  return customers
    .filter((customer) => ["HIGH", "MEDIUM"].includes(customer.riskLevel))
    .map((customer) => ({
      ...customer,
      offerDiscount: env.defaultOfferDiscount,
      offerTitle: customer.favoriteProduct
        ? `Regresa a disfrutar ${customer.favoriteProduct.name}`
        : "Un beneficio especial para tu proxima visita",
      personalizedMessage: buildPersonalizedMessage(customer),
    }));
}
