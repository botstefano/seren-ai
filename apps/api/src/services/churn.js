import { env } from "../config/env.js";

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]
    : (sorted[middle - 1] + sorted[middle]) / 2;
}

function dateDifferenceInDays(dateValue, now = new Date()) {
  if (!dateValue) return null;
  const date = new Date(`${String(dateValue).slice(0, 10)}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return null;
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return Math.max(0, Math.floor((today.getTime() - date.getTime()) / 86_400_000));
}

export function classifyRisk(daysSinceLastPurchase, expectedIntervalDays) {
  if (!Number.isFinite(daysSinceLastPurchase) || !Number.isFinite(expectedIntervalDays) || expectedIntervalDays <= 0) {
    return {
      level: "INSUFFICIENT_DATA",
      score: 0,
      overdueRatio: null,
      reason: "Aun no existe suficiente historial de intervalos para estimar el comportamiento habitual.",
    };
  }

  const ratio = daysSinceLastPurchase / expectedIntervalDays;
  const score = Math.min(100, Math.round((ratio / env.highMultiplier) * 100));
  if (ratio >= env.highMultiplier) {
    return {
      level: "HIGH",
      score,
      overdueRatio: Number(ratio.toFixed(2)),
      reason: `Han pasado ${daysSinceLastPurchase} dias desde su ultima compra, frente a un intervalo habitual de ${expectedIntervalDays.toFixed(1)} dias.`,
    };
  }
  if (ratio >= env.mediumMultiplier) {
    return {
      level: "MEDIUM",
      score,
      overdueRatio: Number(ratio.toFixed(2)),
      reason: `El cliente ya alcanzo su intervalo habitual de ${expectedIntervalDays.toFixed(1)} dias sin regresar.`,
    };
  }
  return {
    level: "LOW",
    score,
    overdueRatio: Number(ratio.toFixed(2)),
    reason: `El tiempo desde la ultima compra permanece dentro de su intervalo habitual de ${expectedIntervalDays.toFixed(1)} dias.`,
  };
}

export function buildCustomerInsights({ customers, purchases, details, products, now = new Date() }) {
  const purchasesByUser = new Map();
  const productByKey = new Map((products ?? []).map((product) => [String(product.producto_key), product]));

  for (const purchase of purchases ?? []) {
    const key = String(purchase.usuario_key);
    if (!purchasesByUser.has(key)) purchasesByUser.set(key, []);
    purchasesByUser.get(key).push(purchase);
  }

  const favoriteByUser = new Map();
  const detailGroups = new Map();
  for (const row of details ?? []) {
    const purchaseId = String(row.id_compra);
    if (!detailGroups.has(purchaseId)) detailGroups.set(purchaseId, []);
    detailGroups.get(purchaseId).push(row);
  }

  const purchaseToUser = new Map();
  for (const purchase of purchases ?? []) {
    purchaseToUser.set(String(purchase.id_compra), String(purchase.usuario_key));
  }

  for (const [purchaseId, lines] of detailGroups) {
    const userKey = purchaseToUser.get(purchaseId);
    if (!userKey) continue;
    if (!favoriteByUser.has(userKey)) favoriteByUser.set(userKey, new Map());
    const totals = favoriteByUser.get(userKey);
    for (const line of lines) {
      const productKey = String(line.producto_key);
      const current = totals.get(productKey) ?? { quantity: 0, amount: 0 };
      current.quantity += Number(line.cantidad_items ?? 0);
      current.amount += Number(line.monto_neto_linea ?? 0);
      totals.set(productKey, current);
    }
  }

  return (customers ?? []).map((customer) => {
    const userKey = String(customer.usuario_key);
    const history = purchasesByUser.get(userKey) ?? [];
    const intervals = history
      .map((item) => Number(item.dias_desde_compra_anterior))
      .filter((value) => Number.isFinite(value) && value > 0);
    const expectedIntervalDays = median(intervals);
    const daysSinceLastPurchase = dateDifferenceInDays(customer.fecha_ultima_compra, now);
    const risk = classifyRisk(daysSinceLastPurchase, expectedIntervalDays);

    const favoriteTotals = favoriteByUser.get(userKey) ?? new Map();
    const favoriteEntry = [...favoriteTotals.entries()]
      .sort((a, b) => b[1].quantity - a[1].quantity || b[1].amount - a[1].amount)[0];
    const favoriteProduct = favoriteEntry
      ? productByKey.get(favoriteEntry[0]) ?? null
      : null;

    const totalPurchases = history.length + 1;
    return {
      usuarioKey: customer.usuario_key,
      customerCode: customer.codigo_usuario,
      name: customer.nombre ?? "Customer",
      segment: customer.segmento ?? "Estable",
      lastPurchaseDate: customer.fecha_ultima_compra,
      totalPurchases,
      recurringPurchases: history.length,
      expectedIntervalDays: expectedIntervalDays === null ? null : Number(expectedIntervalDays.toFixed(1)),
      daysSinceLastPurchase,
      overdueRatio: risk.overdueRatio,
      riskLevel: risk.level,
      riskScore: risk.score,
      riskReason: risk.reason,
      favoriteProduct: favoriteProduct ? {
        key: favoriteProduct.producto_key,
        name: favoriteProduct.nombre_item,
        category: favoriteProduct.categoria,
        type: favoriteProduct.tipo,
      } : null,
    };
  }).sort((a, b) => {
    const rank = { HIGH: 0, MEDIUM: 1, LOW: 2, INSUFFICIENT_DATA: 3 };
    return (rank[a.riskLevel] ?? 4) - (rank[b.riskLevel] ?? 4) || b.riskScore - a.riskScore;
  });
}

export function buildPersonalizedMessage(customer, discount = env.defaultOfferDiscount) {
  const firstName = String(customer.name ?? "Hola").trim().split(/\s+/)[0];
  const service = customer.favoriteProduct?.name ?? "una experiencia de bienestar";
  return `Hola ${firstName}, en Origen Spa queremos volver a verte. Sabemos que disfrutas ${service}; por eso preparamos un beneficio especial del ${discount}% para tu proxima visita. ¿Te gustaria que te ayudemos a reservar?`;
}
