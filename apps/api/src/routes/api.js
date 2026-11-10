import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import { loadAnalytics, createRecommendations, invalidateAnalyticsCache } from "../services/analytics.js";
import { enrichRecommendations } from "../services/mistral.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "seren-ai-api",
    databaseConfigured: Boolean(supabase),
    mistralConfigured: Boolean(env.mistralApiKey),
    mistralModel: env.mistralModel,
    timestamp: new Date().toISOString(),
  });
});

router.use(requireAuth);

router.get("/me", (req, res) => {
  res.json({
    id: req.user.id,
    email: req.user.email,
    name: req.user.user_metadata?.full_name ?? req.user.email,
  });
});

router.get("/overview", async (_req, res, next) => {
  try {
    const data = await loadAnalytics();
    let reactivationRate = 0;
    let pendingActions = 0;
    let reactivatedActions = 0;

    const { data: actions, error } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("status");

    if (!error && actions) {
      pendingActions = actions.filter((item) => ["proposed", "approved"].includes(item.status)).length;
      const completed = actions.filter((item) => ["contacted", "reactivated", "responded"].includes(item.status)).length;
      reactivatedActions = actions.filter((item) => item.status === "reactivated").length;
      reactivationRate = completed ? (reactivatedActions / completed) * 100 : 0;
    }

    res.json({
      generatedAt: data.generatedAt,
      kpis: { ...data.kpis, reactivationRate, pendingActions, reactivatedActions },
      monthly: data.monthly,
      riskDistribution: [
        { name: "Alto", value: data.kpis.highRisk, key: "HIGH" },
        { name: "Moderado", value: data.kpis.mediumRisk, key: "MEDIUM" },
        { name: "Bajo", value: data.kpis.lowRisk, key: "LOW" },
      ],
      migrationReady: !error,
    });
  } catch (error) {
    next(error);
  }
});

router.get("/customers", async (req, res, next) => {
  try {
    const data = await loadAnalytics();
    const search = String(req.query.search ?? "").trim().toLowerCase();
    const risk = String(req.query.risk ?? "ALL").toUpperCase();
    const segment = String(req.query.segment ?? "ALL");
    const filtered = data.customers.filter((customer) => {
      const matchesSearch = !search ||
        customer.name.toLowerCase().includes(search) ||
        customer.customerCode.toLowerCase().includes(search);
      const matchesRisk = risk === "ALL" || customer.riskLevel === risk;
      const matchesSegment = segment === "ALL" || customer.segment === segment;
      return matchesSearch && matchesRisk && matchesSegment;
    });
    res.json({ total: filtered.length, customers: filtered });
  } catch (error) {
    next(error);
  }
});

router.get("/customers/:customerCode", async (req, res, next) => {
  try {
    const data = await loadAnalytics();
    const customer = data.customers.find((item) => item.customerCode === req.params.customerCode);
    if (!customer) return res.status(404).json({ message: "Customer no encontrado." });

    const purchaseRows = data.purchases
      .filter((row) => String(row.usuario_key) === String(customer.usuarioKey))
      .sort((a, b) => String(a.tiempo_key).localeCompare(String(b.tiempo_key)));

    const productMap = new Map(data.products.map((item) => [String(item.producto_key), item]));
    const purchaseIds = new Set(purchaseRows.map((item) => String(item.id_compra)));
    const productHistory = data.details
      .filter((item) => purchaseIds.has(String(item.id_compra)))
      .map((item) => ({ ...item, product: productMap.get(String(item.producto_key)) ?? null }));

    res.json({ customer, purchases: purchaseRows, productHistory });
  } catch (error) {
    next(error);
  }
});

router.get("/churn", async (req, res, next) => {
  try {
    const data = await loadAnalytics();
    const risk = String(req.query.risk ?? "ALL").toUpperCase();
    const customers = data.customers.filter((customer) =>
      ["HIGH", "MEDIUM"].includes(customer.riskLevel) &&
      (risk === "ALL" || customer.riskLevel === risk)
    );
    res.json({ total: customers.length, customers });
  } catch (error) {
    next(error);
  }
});

router.get("/agent/recommendations", async (_req, res, next) => {
  try {
    const data = await loadAnalytics();
    const recommendations = createRecommendations(data.customers);
    const { data: actions, error } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("action_id,assessment_id,usuario_key,status,offer_title,personalized_message,offer_discount_pct,ai_generated,created_at,approved_at,contacted_at,reactivated_at")
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      return res.json({
        migrationReady: false,
        recommendations,
        actions: [],
        migrationMessage: "Ejecuta la migracion database/seren_ai_operations.sql para habilitar el seguimiento de acciones.",
      });
    }
    const latestActionByUser = new Map();
    for (const action of actions ?? []) {
      const key = String(action.usuario_key);
      if (!latestActionByUser.has(key)) latestActionByUser.set(key, action);
    }
    const persistedRecommendations = recommendations.map((item) => {
      const action = latestActionByUser.get(String(item.usuarioKey));
      return action ? {
        ...item,
        offerTitle: action.offer_title,
        personalizedMessage: action.personalized_message,
        offerDiscount: Number(action.offer_discount_pct ?? item.offerDiscount),
        aiGenerated: Boolean(action.ai_generated),
      } : { ...item, aiGenerated: false };
    });
    res.json({ migrationReady: true, recommendations: persistedRecommendations, actions: actions ?? [], aiProvider: { configured: Boolean(env.mistralApiKey), model: env.mistralModel } });
  } catch (error) {
    next(error);
  }
});

router.post("/agent/analyze", async (_req, res, next) => {
  let runId = null;
  try {
    const data = await loadAnalytics({ force: true });
    const baseRecommendations = createRecommendations(data.customers);
    const { recommendations, ai } = await enrichRecommendations(baseRecommendations);
    runId = randomUUID();

    const { error: runError } = await supabase.schema("seren_ai").from("agent_runs").insert({
      run_id: runId,
      status: "running",
      total_customers: data.customers.length,
      high_risk: data.kpis.highRisk,
      medium_risk: data.kpis.mediumRisk,
      low_risk: data.kpis.lowRisk,
      insufficient_data: data.kpis.insufficientData,
    });
    if (runError) throw new Error(`No se pudo guardar la ejecucion. Ejecuta la migracion Seren AI: ${runError.message}`);

    const now = new Date().toISOString();
    const assessments = data.customers.map((customer) => ({
      run_id: runId,
      usuario_key: customer.usuarioKey,
      days_since_last_purchase: customer.daysSinceLastPurchase ?? 0,
      expected_interval_days: customer.expectedIntervalDays,
      overdue_ratio: customer.overdueRatio,
      risk_level: customer.riskLevel,
      risk_score: customer.riskScore,
      explanation: customer.riskReason,
      favorite_product_key: customer.favoriteProduct?.key ?? null,
      assessed_at: now,
    }));

    for (let offset = 0; offset < assessments.length; offset += 500) {
      const batch = assessments.slice(offset, offset + 500);
      const { error } = await supabase.schema("seren_ai").from("churn_assessments").upsert(batch, {
        onConflict: "run_id,usuario_key",
      });
      if (error) throw error;
    }

    const { data: savedAssessments, error: readError } = await supabase
      .schema("seren_ai")
      .from("churn_assessments")
      .select("assessment_id,run_id,usuario_key,risk_level,favorite_product_key")
      .eq("run_id", runId);
    if (readError) throw readError;

    const recByUser = new Map(recommendations.map((item) => [String(item.usuarioKey), item]));
    const { data: openActions, error: openActionsError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("usuario_key")
      .in("status", ["proposed", "approved", "contacted", "responded"]);
    if (openActionsError) throw openActionsError;

    const usersWithOpenAction = new Set((openActions ?? []).map((item) => String(item.usuario_key)));
    const actions = (savedAssessments ?? [])
      .filter((assessment) =>
        recByUser.has(String(assessment.usuario_key)) &&
        !usersWithOpenAction.has(String(assessment.usuario_key))
      )
      .map((assessment) => {
        const recommendation = recByUser.get(String(assessment.usuario_key));
        return {
          assessment_id: assessment.assessment_id,
          usuario_key: assessment.usuario_key,
          status: "proposed",
          favorite_product_key: recommendation.favoriteProduct?.key ?? null,
          offer_discount_pct: recommendation.offerDiscount,
          offer_title: recommendation.offerTitle,
          personalized_message: recommendation.personalizedMessage,
          ai_generated: Boolean(recommendation.aiGenerated),
        };
      });

    if (actions.length) {
      const { error } = await supabase.schema("seren_ai").from("reactivation_actions")
        .upsert(actions, { onConflict: "assessment_id", ignoreDuplicates: true });
      if (error) throw error;
    }

    const { error: finishError } = await supabase.schema("seren_ai").from("agent_runs")
      .update({ status: "completed", finished_at: now })
      .eq("run_id", runId);
    if (finishError) throw finishError;

    invalidateAnalyticsCache();
    res.json({
      runId,
      assessedCustomers: assessments.length,
      highRisk: data.kpis.highRisk,
      mediumRisk: data.kpis.mediumRisk,
      lowRisk: data.kpis.lowRisk,
      recommendationsCreated: actions.length,
      ai,
      message: "Analisis completado. Las recomendaciones quedan pendientes de aprobacion humana.",
    });
  } catch (error) {
    if (runId && supabase) {
      await supabase.schema("seren_ai").from("agent_runs")
        .update({ status: "failed", finished_at: new Date().toISOString(), error_message: String(error.message ?? error).slice(0, 2000) })
        .eq("run_id", runId);
    }
    next(error);
  }
});

router.patch("/agent/actions/:actionId/status", async (req, res, next) => {
  try {
    const allowed = new Set(["approved", "contacted", "responded", "reactivated", "dismissed"]);
    const status = String(req.body?.status ?? "");
    if (!allowed.has(status)) {
      return res.status(400).json({ message: "Estado no valido." });
    }

    const { data: current, error: currentError } = await supabase.schema("seren_ai")
      .from("reactivation_actions")
      .select("status")
      .eq("action_id", req.params.actionId)
      .maybeSingle();
    if (currentError) throw currentError;
    if (!current) return res.status(404).json({ message: "Accion no encontrada." });

    const transitions = {
      proposed: ["approved", "dismissed"],
      approved: ["contacted", "dismissed"],
      contacted: ["responded", "reactivated", "dismissed"],
      responded: ["reactivated", "dismissed"],
    };
    if (!(transitions[current.status] ?? []).includes(status)) {
      return res.status(409).json({ message: "Transicion no permitida: " + current.status + " → " + status + "." });
    }

    const timestampField = {
      approved: "approved_at",
      contacted: "contacted_at",
      responded: "responded_at",
      reactivated: "reactivated_at",
    }[status];

    const updates = { status, updated_at: new Date().toISOString() };
    if (timestampField) updates[timestampField] = new Date().toISOString();

    const { data, error } = await supabase.schema("seren_ai")
      .from("reactivation_actions")
      .update(updates)
      .eq("action_id", req.params.actionId)
      .select("action_id,status,approved_at,contacted_at,reactivated_at")
      .single();

    if (error) throw error;
    res.json({ action: data });
  } catch (error) {
    next(error);
  }
});

router.get("/reports/monthly", async (_req, res, next) => {
  try {
    const data = await loadAnalytics();
    res.json({
      monthly: data.monthly,
      frequencyBySegment: Object.values(data.customers.reduce((acc, customer) => {
        const key = customer.segment;
        if (!acc[key]) acc[key] = { segment: key, customers: 0, purchases: 0 };
        acc[key].customers += 1;
        acc[key].purchases += customer.totalPurchases;
        return acc;
      }, {})),
      customersByRisk: data.kpis,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
