import { env } from "../config/env.js";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";

const SECTION_GUIDANCE = {
  overview: {
    title: "Resumen",
    purpose: "panel ejecutivo de retencion y salud de la cartera",
    guidance: "Ayuda a interpretar clientes activos, recompra, frecuencia, ticket promedio, churn, distribucion de riesgo y seguimiento de reactivaciones. Explica las relaciones entre indicadores y sus limitaciones.",
  },
  customers: {
    title: "Customers",
    purpose: "cartera de clientes recurrentes con dos o mas compras",
    guidance: "Explica segmentos VIP, Frecuente y Estable, filtros, frecuencia de compra, ultima compra e intervalo habitual. Recuerda que los Payers de una sola compra quedan fuera de esta fase.",
  },
  churn: {
    title: "Riesgo de churn",
    purpose: "alertas de clientes que superaron su ciclo habitual de compra",
    guidance: "Explica el indice de demora, el intervalo esperado individual y la diferencia entre riesgo bajo, moderado y alto. El indice es una regla estadistica explicable, no una probabilidad de abandono ni un modelo predictivo entrenado.",
  },
  agent: {
    title: "Agente Seren",
    purpose: "generacion de propuestas de retencion con Groq y aprobacion humana",
    guidance: "Explica como el motor estadistico calcula el riesgo y como Groq redacta explicaciones y propuestas. Los lotes contienen hasta 20 recomendaciones. Solo se muestran propuestas generadas y guardadas por Groq. El equipo debe aprobarlas; no se envian mensajes automaticamente.",
  },
  campaigns: {
    title: "Reactivaciones",
    purpose: "historial y seguimiento de acciones de retencion",
    guidance: "Explica los estados propuesta, aprobada, contacto registrado, respuesta, reactivado y descartada; interpreta los contadores y la trazabilidad. No afirmes que se envio un mensaje: el sistema no integra envio automatico.",
  },
  reports: {
    title: "Reportes BI",
    purpose: "analisis agregado de recurrencia, compras y valor",
    guidance: "Ayuda a leer los graficos mensuales, frecuencia por segmento, ticket y volumen de compras recurrentes. Distingue compras recurrentes del total historico y no atribuyas causalidad a correlaciones.",
  },
  settings: {
    title: "Configuracion",
    purpose: "estado de servicios, conexiones y seguridad",
    guidance: "Explica Supabase Auth, API, DataMart, proveedor Groq y separacion de secretos. Nunca pidas ni reveles claves, tokens, contrasenas o credenciales.",
  },
};

function countBy(items, key) {
  return items.reduce((result, item) => {
    const value = String(item[key] ?? "Sin dato");
    result[value] = (result[value] ?? 0) + 1;
    return result;
  }, {});
}

export function buildAssistantContext(section, analytics, actionRows = []) {
  const page = SECTION_GUIDANCE[section] ?? SECTION_GUIDANCE.overview;
  const customers = analytics.customers ?? [];
  const kpis = analytics.kpis ?? {};
  const common = {
    customersInCurrentAnalytics: kpis.totalCustomers ?? customers.length,
    riskDistribution: {
      high: kpis.highRisk ?? 0,
      medium: kpis.mediumRisk ?? 0,
      low: kpis.lowRisk ?? 0,
      insufficientData: kpis.insufficientData ?? 0,
    },
  };

  let pageData = {};
  if (section === "overview") {
    pageData = {
      indicators: {
        repurchaseRatePct: Number((kpis.repurchaseRate ?? 0).toFixed(1)),
        averageFrequency: Number((kpis.averageFrequency ?? 0).toFixed(2)),
        averageRecurringTicketPEN: Number((kpis.averageTicket ?? 0).toFixed(2)),
        churnRatePct: Number((kpis.churnRate ?? 0).toFixed(1)),
        recurringGrossRevenuePEN: Number((kpis.grossRevenue ?? 0).toFixed(2)),
        recurringPurchases: kpis.recurringPurchases ?? 0,
      },
      monthlyLastSix: (analytics.monthly ?? []).slice(-6),
      actionStatusCounts: countBy(actionRows, "status"),
    };
  } else if (section === "customers") {
    pageData = {
      segmentCounts: countBy(customers, "segment"),
      riskDistribution: common.riskDistribution,
      averagePurchaseFrequency: Number((kpis.averageFrequency ?? 0).toFixed(2)),
      scope: "clientes con dos o mas compras",
    };
  } else if (section === "churn") {
    pageData = {
      atRiskCustomers: (kpis.highRisk ?? 0) + (kpis.mediumRisk ?? 0),
      highRisk: kpis.highRisk ?? 0,
      mediumRisk: kpis.mediumRisk ?? 0,
      lowRisk: kpis.lowRisk ?? 0,
      calculation: {
        delayIndex: "dias desde la ultima compra / mediana de intervalos positivos historicos del cliente",
        low: "menor que 1.0",
        medium: "desde 1.0 hasta menor que 1.5",
        high: "1.5 o mayor",
        interpretation: "indice de demora, no probabilidad de churn",
      },
    };
  } else if (section === "agent") {
    const generatedActions = actionRows.filter((item) => item.ai_generated === true);
    const latestCreatedAt = generatedActions.reduce((latest, item) =>
      !latest || String(item.created_at) > latest ? String(item.created_at) : latest, "");
    const activeBatch = latestCreatedAt
      ? generatedActions.filter((item) => item.created_at === latestCreatedAt)
      : [];
    pageData = {
      groqConfigured: Boolean(env.groqApiKey),
      model: env.groqModel,
      activeBatchCount: activeBatch.length,
      activeBatchStatusCounts: countBy(activeBatch, "status"),
      remainingAtRiskCandidates: Math.max(0, (kpis.highRisk ?? 0) + (kpis.mediumRisk ?? 0) - generatedActions.length),
      rules: [
        "hasta 20 clientes por lote",
        "solo recomendaciones validas generadas por Groq se guardan y muestran",
        "se exige aprobacion humana",
        "no hay envio automatico de mensajes",
      ],
    };
  } else if (section === "campaigns") {
    pageData = {
      actionStatusCounts: countBy(actionRows, "status"),
      totalActions: actionRows.length,
      contactedOrResponded: actionRows.filter((item) => ["contacted", "responded", "reactivated"].includes(item.status)).length,
      reactivated: actionRows.filter((item) => item.status === "reactivated").length,
    };
  } else if (section === "reports") {
    pageData = {
      monthlyLastTwelve: (analytics.monthly ?? []).slice(-12),
      segmentCounts: countBy(customers, "segment"),
      averageFrequency: Number((kpis.averageFrequency ?? 0).toFixed(2)),
      averageRecurringTicketPEN: Number((kpis.averageTicket ?? 0).toFixed(2)),
      reportScope: "compras recurrentes conciliadas en el DataMart",
    };
  } else if (section === "settings") {
    pageData = {
      apiConfigured: true,
      databaseConfigured: true,
      groqConfigured: Boolean(env.groqApiKey),
      aiProvider: "Groq",
      model: env.groqModel,
      security: [
        "el frontend utiliza Supabase Auth",
        "la API valida el token de sesion",
        "la clave privilegiada de Supabase permanece en el backend",
        "el chat recibe indicadores agregados y no nombres ni historiales individuales de clientes",
      ],
    };
  }

  return { page: page.title, purpose: page.purpose, instructions: page.guidance, aggregateData: { ...common, ...pageData } };
}

export async function answerAssistant({ section, messages, context }) {
  if (!env.groqApiKey) {
    const error = new Error("El asistente no esta disponible porque Groq no esta configurado en el backend.");
    error.status = 503;
    throw error;
  }

  const page = SECTION_GUIDANCE[section] ?? SECTION_GUIDANCE.overview;
  const system = [
    "Eres Seren, el asistente contextual integrado en el software de retencion Origen Spa.",
    "Responde siempre en espanol, con tono cercano, profesional, claro y practico.",
    "Tu funcion es orientar al usuario sobre la pantalla actual, explicar indicadores, filtros, procesos, reglas estadisticas y lectura de reportes.",
    "Usa exclusivamente las definiciones e indicadores agregados que recibes. Si falta informacion, dilo con claridad y no inventes datos.",
    "Distingue siempre indicadores observados, reglas estadisticas e interpretaciones. El indice de demora no es una probabilidad de churn y no existe un modelo de churn entrenado.",
    "No solicites ni expongas nombres, codigos, datos personales, compras individuales, contrasenas, tokens o claves. El contexto fue minimizado y no incluye identidades de clientes.",
    "Eres de solo lectura: no puedes modificar clientes, filtros, configuraciones, recomendaciones, estados, aprobaciones ni ejecutar acciones. No afirmes haber realizado cambios.",
    "No afirmes que mensajes fueron enviados, porque el sistema no tiene integracion de envio automatico.",
    "Cuando recomiendes una accion, describe el paso manual en la interfaz y deja la decision al usuario.",
    "Responde de forma breve pero suficiente. Usa listas cortas cuando ayuden. Si una pregunta no corresponde a esta pantalla, indica en que pestaña se encuentra esa funcion.",
    "Pantalla actual: " + page.title + ". " + page.guidance,
    "Contexto actual (solo datos agregados, sin identificadores personales): " + JSON.stringify(context),
  ].join("\n");
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(35_000),
    body: JSON.stringify({
      model: env.groqModel,
      reasoning_effort: "low",
      max_completion_tokens: 1000,
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error(`Groq API respondio ${response.status}: ${detail.slice(0, 250)}`);
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("Groq no devolvio una respuesta de texto.");
    error.status = 502;
    throw error;
  }
  return content.trim().slice(0, 6000);
}
