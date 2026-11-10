import { env } from "../config/env.js";

const API_URL = "https://api.mistral.ai/v1/chat/completions";
const MAX_BATCH_SIZE = 20;

function extractJson(content) {
  if (typeof content !== "string") throw new Error("Mistral devolvio una respuesta sin texto.");
  return JSON.parse(content.trim());
}

async function generateBatch(items) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.mistralApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: env.mistralModel,
      temperature: 0.35,
      max_tokens: 3500,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: [
            "Eres Seren AI, especialista en retencion responsable para Origen Spa.",
            "Genera recomendaciones comerciales empaticas, claras y no invasivas en espanol.",
            "Usa exclusivamente los datos proporcionados. No inventes compras, preferencias, diagnosticos, disponibilidad, precios ni beneficios.",
            "No cambies el nivel de riesgo ni recalcules metricas: son resultados deterministas ya calculados.",
            "El descuento maximo permitido es el descuento sugerido recibido y nunca debes aumentarlo.",
            "No afirmes que una reserva esta hecha ni que un mensaje fue enviado. La propuesta requiere aprobacion humana.",
            "Devuelve un objeto JSON con la propiedad recommendations: array de objetos con customerCode, offerTitle y personalizedMessage.",
            "Cada customerCode debe coincidir exactamente con la entrada. No incluyas texto fuera del JSON.",
          ].join(" "),
        },
        {
          role: "user",
          content: JSON.stringify({ task: "Personaliza una propuesta por cliente.", customers: items }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Mistral API respondio ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (!Array.isArray(parsed.recommendations)) {
    throw new Error("Mistral no devolvio el arreglo recommendations.");
  }
  return parsed.recommendations;
}

/**
 * Enriches the highest-priority proposals. Deterministic calculations remain
 * authoritative; when Mistral is unavailable, existing safe templates remain.
 */
export async function enrichRecommendations(recommendations) {
  if (!env.mistralApiKey || !recommendations.length) {
    return {
      recommendations: recommendations.map((item) => ({ ...item, aiGenerated: false })),
      ai: { enabled: Boolean(env.mistralApiKey), used: false, model: env.mistralModel, generated: 0, fallback: recommendations.length },
    };
  }

  const selected = recommendations.slice(0, env.mistralMaxRecommendations);
  const fallback = recommendations.slice(selected.length);
  const output = [];
  let errorMessage = null;

  for (let offset = 0; offset < selected.length; offset += MAX_BATCH_SIZE) {
    const batch = selected.slice(offset, offset + MAX_BATCH_SIZE);
    const input = batch.map((item) => ({
      customerCode: String(item.customerCode),
      firstName: String(item.name ?? "").trim().split(/\s+/)[0],
      riskLevel: item.riskLevel,
      daysSinceLastPurchase: item.daysSinceLastPurchase,
      usualIntervalDays: item.expectedIntervalDays,
      favoriteProduct: item.favoriteProduct?.name ?? null,
      suggestedDiscountPct: item.offerDiscount,
      segment: item.segment,
    }));

    try {
      const generated = await generateBatch(input);
      const byCode = new Map(generated.map((item) => [String(item.customerCode), item]));
      for (const original of batch) {
        const candidate = byCode.get(String(original.customerCode));
        const offerTitle = typeof candidate?.offerTitle === "string" ? candidate.offerTitle.trim() : "";
        const personalizedMessage = typeof candidate?.personalizedMessage === "string"
          ? candidate.personalizedMessage.trim()
          : "";
        const mentionedDiscounts = [...(offerTitle + " " + personalizedMessage).matchAll(/(\\d+(?:[.,]\\d+)?)\\s*%/g)]
          .map((match) => Number(match[1].replace(",", ".")));
        const discountIsSafe = mentionedDiscounts.every((value) => value === Number(original.offerDiscount));
        if (offerTitle && personalizedMessage && discountIsSafe) {
          output.push({ ...original, offerTitle: offerTitle.slice(0, 180), personalizedMessage: personalizedMessage.slice(0, 1200), aiGenerated: true });
        } else {
          output.push({ ...original, aiGenerated: false });
        }
      }
    } catch (error) {
      errorMessage = String(error?.message ?? error).slice(0, 300);
      output.push(...batch.map((item) => ({ ...item, aiGenerated: false })));
      // Avoid repeated provider failures and cost on the remaining batches.
      output.push(...selected.slice(offset + batch.length).map((item) => ({ ...item, aiGenerated: false })));
      break;
    }
  }

  output.push(...fallback.map((item) => ({ ...item, aiGenerated: false })));
  return {
    recommendations: output,
    ai: {
      enabled: true,
      used: output.some((item) => item.aiGenerated),
      model: env.mistralModel,
      generated: output.filter((item) => item.aiGenerated).length,
      fallback: output.filter((item) => !item.aiGenerated).length,
      ...(errorMessage ? { warning: "No se pudo completar la personalizacion con Mistral; se conservaron las plantillas seguras." } : {}),
    },
  };
}
