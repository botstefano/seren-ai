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

export function buildAssistantContext(section, analytics, actionRows = [], selectedCustomer = null) {
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

  return { page: page.title, purpose: page.purpose, instructions: page.guidance, aggregateData: { ...common, ...pageData }, selectedCustomer };
}

const commonOfferProperties = {
  offerTitle: { type: "string", minLength: 3, maxLength: 180, description: "Titulo breve de la oferta." },
  personalizedMessage: { type: "string", minLength: 10, maxLength: 1200, description: "Mensaje listo para copiar, sin afirmar que fue enviado. No incluyas datos de identidad; el equipo puede personalizar el saludo." },
  discountPct: { type: "number", minimum: 0, maximum: 30, description: "Descuento entre 0 y 30 por ciento." },
};

function operationTools(selectedCustomer) {
  if (!selectedCustomer) return [];
  const tools = [];
  if (selectedCustomer.canEditOffer) {
    tools.push({
      type: "function",
      function: {
        name: "prepare_offer_update",
        description: "Prepara una edicion de la oferta existente del cliente seleccionado. Usala cuando el usuario pida cambiar o mejorar el mensaje, titulo o descuento. No guarda nada.",
        parameters: { type: "object", additionalProperties: false, properties: commonOfferProperties, required: ["offerTitle", "personalizedMessage", "discountPct"] },
      },
    });
  } else if (selectedCustomer.canCreateOffer) {
    tools.push({
      type: "function",
      function: {
        name: "prepare_offer_create",
        description: "Prepara una nueva oferta Groq para el cliente seleccionado cuando aun no existe una accion. Usala solo si el usuario pide preparar una oferta o recomendacion. No guarda nada.",
        parameters: { type: "object", additionalProperties: false, properties: commonOfferProperties, required: ["offerTitle", "personalizedMessage", "discountPct"] },
      },
    });
  }

  if (selectedCustomer.availableStatuses?.length) {
    tools.push({
      type: "function",
      function: {
        name: "prepare_status_change",
        description: "Prepara un cambio de estado de la accion del cliente seleccionado. Usala cuando el usuario pida aprobar, registrar contacto, registrar respuesta, marcar reactivado o descartar. No guarda nada.",
        parameters: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string", enum: selectedCustomer.availableStatuses },
          },
          required: ["status"],
        },
      },
    });
  }
  if (selectedCustomer.canCopyMessage) {
    tools.push({
      type: "function",
      function: {
        name: "copy_offer_message",
        description: "Solicita mostrar el mensaje actual de la oferta seleccionada para que el usuario pueda copiarlo. No modifica ni guarda nada.",
        parameters: { type: "object", additionalProperties: false, properties: {}, required: [] },
      },
    });
  }
  return tools;
}

export async function answerAssistant({ section, messages, context }) {
  if (!env.groqApiKey) {
    const error = new Error("El asistente no esta disponible porque Groq no esta configurado en el backend.");
    error.status = 503;
    throw error;
  }

  const page = SECTION_GUIDANCE[section] ?? SECTION_GUIDANCE.overview;
  const selectedCustomer = context?.selectedCustomer ?? null;
  const tools = operationTools(selectedCustomer);
  const system = [
    "Eres Seren, el asistente operativo contextual de Origen Spa.",
    "Responde siempre en espanol con tono calido, profesional y natural. Eres una asistente integrada en una plataforma web, no un generador de informes extensos.",\n    "ESTILO VISUAL: organiza las respuestas para que se lean bien en una ventana de chat estrecha. Usa un titulo breve cuando aporte valor, parrafos cortos y listas concisas. Usa **negrita** solo para cifras, conceptos y decisiones clave.",\n    "No uses tablas Markdown salvo que el usuario pida expresamente una comparacion tabular. Para resumir varios indicadores, usa una lista breve con el nombre en negrita y su valor; nunca construyas tablas anchas.",\n    "Evita bloques enormes, encabezados repetitivos y listas de limitaciones genericas. Agrupa la informacion en 2 a 4 secciones como maximo y deja espacios entre ideas.",\n    "Por defecto responde en 100 a 180 palabras; amplia solo cuando el usuario pida un analisis detallado. Si pregunta por toda una pantalla, destaca primero 3 a 5 hallazgos y luego ofrece profundizar en un indicador.",\n    "No repitas todos los datos del contexto si no son necesarios. Distingue claramente datos observados, interpretaciones y recomendaciones; no inventes causalidad ni conclusiones que los datos no sostengan.",\n    "Cierra con una recomendacion concreta o una pregunta breve cuando sea util. Nunca dejes una frase cortada ni termines con una introduccion incompleta."
    "Detecta la intencion del usuario y usa las herramientas disponibles cuando solicite una operacion concreta sobre el cliente seleccionado.",
    "IMPORTANTE: las herramientas solo PREPARAN una propuesta. No ejecutan ni guardan cambios. La API solicitara confirmacion humana y despues validara y guardara la operacion.",
    "No digas que una modificacion, aprobacion, contacto o reactivacion ya se realizo. Solo puedes decir que has preparado el cambio para confirmacion.",
    "Usa prepare_offer_update para editar una oferta existente; conserva los elementos que el usuario no pidio cambiar y usa el mensaje actual como base. Si solo cambia el descuento, conserva el titulo y reescribe el mensaje para que cualquier porcentaje mencionado coincida exactamente con el descuento nuevo.",
    "Usa prepare_offer_create solo cuando no haya una oferta existente y el usuario pida preparar una nueva. El descuento por defecto es 10 por ciento, a menos que el usuario solicite otro. Nunca superes 30 por ciento.",
    "Usa prepare_status_change para aprobar, registrar contacto, registrar respuesta, marcar reactivado o descartar. Solo selecciona estados que aparecen como permitidos.",
    "Usa copy_offer_message cuando el usuario pida copiar o recuperar el mensaje actual. No cambies el texto.",
    "Si no hay cliente seleccionado, pide seleccionar primero una tarjeta con el boton Trabajar con Seren. No inventes a que cliente se refiere el usuario.",
    "No solicites ni expongas nombres, codigos, contrasenas, tokens o claves. El contexto del cliente no contiene identificadores personales.",
    "El indice de demora no es una probabilidad de churn y no existe un modelo de churn entrenado.",
    "El sistema no envia WhatsApp, correo ni SMS automaticamente. La accion de contacto solo registra que el equipo lo hizo externamente.",
    "No ejecutes SQL libre ni propongas acciones que no esten en las herramientas disponibles.",
    "Pantalla actual: " + page.title + ". " + page.guidance,
    "Contexto de la pantalla y del cliente seleccionado (sin nombres ni codigos): " + JSON.stringify(context),
    tools.length
      ? "Hay un cliente seleccionado. Puedes preparar operaciones usando solamente las herramientas adjuntas."
      : "No hay herramientas operativas disponibles en este contexto. Responde consultas y explica como navegar a la funcion correspondiente.",
  ].join("\n");

  const requestBody = {
    model: env.groqModel,
    reasoning_effort: "low",
    max_completion_tokens: 1300,
    messages: [
      { role: "system", content: system },
      ...messages,
    ],
    ...(tools.length ? { tools, tool_choice: "auto", parallel_tool_calls: false } : {}),
  };

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + env.groqApiKey,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(35_000),
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    const error = new Error("Groq API respondio " + response.status + ": " + detail.slice(0, 250));
    error.status = response.status === 429 ? 429 : 502;
    throw error;
  }

  const payload = await response.json();
  const assistantMessage = payload.choices?.[0]?.message;
  const call = assistantMessage?.tool_calls?.[0];
  if (call?.type === "function" && typeof call.function?.name === "string") {
    let args = {};
    try {
      args = JSON.parse(call.function.arguments ?? "{}");
    } catch {
      const error = new Error("Groq devolvio parametros de operacion invalidos. Intentalo nuevamente.");
      error.status = 502;
      throw error;
    }
    const allowedNames = new Set(["prepare_offer_update", "prepare_offer_create", "prepare_status_change", "copy_offer_message"]);
    if (!allowedNames.has(call.function.name)) {
      const error = new Error("Groq solicito una operacion que no esta permitida.");
      error.status = 502;
      throw error;
    }
    return {
      answer: typeof assistantMessage.content === "string" && assistantMessage.content.trim()
        ? assistantMessage.content.trim().slice(0, 2000)
        : "He preparado la operacion. Revisa los detalles y confirma para guardarla.",
      operation: { name: call.function.name, arguments: args },
    };
  }

  const content = assistantMessage?.content;
  if (typeof content !== "string" || !content.trim()) {
    const error = new Error("Groq no devolvio una respuesta de texto.");
    error.status = 502;
    throw error;
  }
  return { answer: content.trim().slice(0, 6000), operation: null };
}
