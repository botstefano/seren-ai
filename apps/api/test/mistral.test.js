import test from "node:test";
import assert from "node:assert/strict";
import { enrichRecommendations } from "../src/services/mistral.js";

test("keeps deterministic fallback recommendations when Mistral is not configured", async () => {
  const input = [{
    customerCode: "C-1",
    name: "Ana Pérez",
    offerTitle: "Oferta de regreso",
    personalizedMessage: "Hola Ana",
    offerDiscount: 10,
    riskLevel: "HIGH",
  }];
  const result = await enrichRecommendations(input);
  assert.equal(result.recommendations[0].personalizedMessage, "Hola Ana");
  assert.equal(result.recommendations[0].aiGenerated, false);
  assert.equal(result.ai.used, false);
});
