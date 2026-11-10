import test from "node:test";
import assert from "node:assert/strict";
import { classifyRisk, buildCustomerInsights, buildPersonalizedMessage } from "../src/services/churn.js";

test("classifies an on-time customer as low risk", () => {
  const result = classifyRisk(8, 14);
  assert.equal(result.level, "LOW");
  assert.equal(result.overdueRatio, 0.57);
});

test("classifies a customer at the normal interval as medium risk", () => {
  const result = classifyRisk(14, 14);
  assert.equal(result.level, "MEDIUM");
});

test("classifies a customer 1.5x beyond the interval as high risk", () => {
  const result = classifyRisk(21, 14);
  assert.equal(result.level, "HIGH");
});

test("does not invent a risk classification without a valid interval", () => {
  assert.equal(classifyRisk(10, null).level, "INSUFFICIENT_DATA");
});

test("derives a customer median interval and favorite product", () => {
  const customers = [{
    usuario_key: 7,
    codigo_usuario: "7",
    nombre: "Ana Pérez",
    segmento: "VIP",
    fecha_ultima_compra: "2026-10-01",
  }];
  const purchases = [
    { id_compra: "101", usuario_key: 7, dias_desde_compra_anterior: 10 },
    { id_compra: "102", usuario_key: 7, dias_desde_compra_anterior: 20 },
    { id_compra: "103", usuario_key: 7, dias_desde_compra_anterior: 30 },
  ];
  const details = [
    { id_compra: "101", producto_key: 2, cantidad_items: 1, monto_neto_linea: 150 },
    { id_compra: "102", producto_key: 2, cantidad_items: 2, monto_neto_linea: 300 },
    { id_compra: "103", producto_key: 3, cantidad_items: 1, monto_neto_linea: 80 },
  ];
  const products = [
    { producto_key: 2, nombre_item: "Masaje relajante", categoria: "Masajes", tipo: "Servicio" },
    { producto_key: 3, nombre_item: "Crema facial", categoria: "Cuidado facial", tipo: "Producto" },
  ];

  const result = buildCustomerInsights({ customers, purchases, details, products, now: new Date("2026-11-09T12:00:00Z") });
  assert.equal(result[0].expectedIntervalDays, 20);
  assert.equal(result[0].favoriteProduct.name, "Masaje relajante");
  assert.equal(result[0].totalPurchases, 4);
});

test("creates a personalized message without assuming a real messaging provider", () => {
  const message = buildPersonalizedMessage({
    name: "Ana Pérez",
    favoriteProduct: { name: "Masaje relajante" },
  }, 10);
  assert.match(message, /Ana/);
  assert.match(message, /Masaje relajante/);
  assert.match(message, /10%/);
});
