import { env } from "../config/env.js";

const API_URL = "https://api.groq.com/openai/v1/chat/completions";
const MAX_BATCH_SIZE = 20;

function extractJson(content) {
  if (typeof content !== "string") throw new Error("Groq devolvio una respuesta sin texto.");
  return JSON.parse(content.trim());
}

async function generateBatch(items) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.groqApiKey}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(45_000),
    body: JSON.stringify({
      model: env.groqModel,
      reasoning_effort: "low",
      max_completion_tokens: 4500,
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "seren_ai_recommendations",
          strict: true,
          schema: {
            type: "object",
            properties: {
              recommendations: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    reference: { type: "string" },
                    aiExplanation: { type: "string" },
                    offerTitle: { type: "string" },
                    personalizedMessage: { type: "string" }
                  },
                  required: ["reference", "aiExplanation", "offerTitle", "personalizedMessage"],
                  additionalProperties: false
                }
              }
            },
            required: ["recommendations"],
            additionalProperties: false
          }
        }
      },
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
            "Devuelve un objeto JSON con recommendations: array de objetos con reference, aiExplanation, offerTitle y personalizedMessage. aiExplanation debe explicar en una o dos frases por que la demora observada merece atencion, sin diagnosticar ni recalcular el riesgo.",
            "Cada reference debe coincidir exactamente con la entrada. No incluyas texto fuera del JSON.",
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
    throw new Error(`Groq API respondio ${response.status}: ${detail.slice(0, 400)}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  const parsed = extractJson(content);
  if (!Array.isArray(parsed.recommendations)) {
    throw new Error("Groq no devolvio el arreglo recommendations.");
  }
  return parsed.recommendations;
}

/**
 * Enriches the highest-priority proposals. Deterministic calculations remain
 * authoritative; when Groq is unavailable, existing safe templates remain.
 */
export async function enrichRecommendations(recommendations) {
  if (!env.groqApiKey || !recommendations.length) {
    return {
      recommendations: recommendations.map((item) => ({ ...item, aiGenerated: false })),
      ai: { enabled: Boolean(env.groqApiKey), used: false, model: env.groqModel, generated: 0, fallback: recommendations.length },
    };
  }

  const selected = recommendations.slice(0, env.groqMaxRecommendations);
  const fallback = recommendations.slice(selected.length);
  const output = [];
  let errorMessage = null;

  for (let offset = 0; offset < selected.length; offset += MAX_BATCH_SIZE) {
    const batch = selected.slice(offset, offset + MAX_BATCH_SIZE);
    const input = batch.map((item, index) => ({
      reference: String(index + 1),
      riskLevel: item.riskLevel,
      daysSinceLastPurchase: item.daysSinceLastPurchase,
      usualIntervalDays: item.expectedIntervalDays,
      favoriteProduct: item.favoriteProduct?.name ?? null,
      suggestedDiscountPct: item.offerDiscount,
      segment: item.segment,
    }));

    try {
      const generated = await generateBatch(input);
      const byReference = new Map(generated.map((item) => [String(item.reference), item]));
      for (const [index, original] of batch.entries()) {
        const candidate = byReference.get(String(index + 1));
        const aiExplanation = typeof candidate?.aiExplanation === "string" ? candidate.aiExplanation.trim() : "";
        const offerTitle = typeof candidate?.offerTitle === "string" ? candidate.offerTitle.trim() : "";
        const personalizedMessage = typeof candidate?.personalizedMessage === "string"
          ? candidate.personalizedMessage.trim()
          : "";
        const mentionedDiscounts = [...(offerTitle + " " + personalizedMessage).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
          .map((match) => Number(match[1].replace(",", ".")));
        const discountIsSafe = mentionedDiscounts.every((value) => value === Number(original.offerDiscount));
        if (aiExplanation && offerTitle && personalizedMessage && discountIsSafe) {
          output.push({ ...original, aiExplanation: aiExplanation.slice(0, 500), offerTitle: offerTitle.slice(0, 180), personalizedMessage: personalizedMessage.slice(0, 1200), aiGenerated: true });
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
      model: env.groqModel,
      generated: output.filter((item) => item.aiGenerated).length,
      fallback: output.filter((item) => !item.aiGenerated).length,
      ...(errorMessage ? { warning: "No se pudo completar la personalizacion con Groq; se conservaron las plantillas seguras." } : {}),
    },
  };
}
