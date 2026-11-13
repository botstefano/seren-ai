import { Router } from "express";
import { randomUUID } from "node:crypto";
import { requireAuth } from "../middleware/auth.js";
import { supabase } from "../lib/supabase.js";
import { loadAnalytics, createRecommendations, invalidateAnalyticsCache } from "../services/analytics.js";
import { enrichRecommendations } from "../services/groq.js";
import { answerAssistant, buildAssistantContext } from "../services/assistant.js";
import { env } from "../config/env.js";

const router = Router();

router.get("/health", async (_req, res) => {
  res.json({
    status: "ok",
    service: "seren-ai-api",
    databaseConfigured: Boolean(supabase),
    aiProviderConfigured: Boolean(env.groqApiKey),
    aiProvider: "Groq",
    aiModel: env.groqModel,
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

const assistantRequests = new Map();
const ASSISTANT_SECTIONS = new Set(["overview", "customers", "churn", "agent", "campaigns", "reports", "settings"]);

const pendingAssistantOperations = new Map();
const ACTION_TRANSITIONS = {
  proposed: ["approved", "dismissed"],
  approved: ["contacted", "dismissed"],
  contacted: ["responded", "reactivated", "dismissed"],
  responded: ["reactivated", "dismissed"],
};
const STATUS_LABELS = {
  proposed: "propuesta",
  approved: "aprobada",
  contacted: "contacto registrado",
  responded: "respuesta registrada",
  reactivated: "reactivado",
  dismissed: "descartada",
};

function appendAssistantAudit(notes, userId, operation) {
  const entry = "[" + new Date().toISOString() + "] Seren AI assistant | user:" + userId + " | " + operation;
  return [String(notes ?? "").trim(), entry].filter(Boolean).join("\n").slice(-6000);
}

function redactName(text, name) {
  if (!text || !name) return String(text ?? "");
  return String(text).split(String(name)).join("[nombre]");
}

function normalizeCustomerLookup(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\\u0300-\\u036f]/g, "")
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findCustomerMatches(customers, query) {
  const normalizedQuery = normalizeCustomerLookup(query);
  if (normalizedQuery.length < 2) return [];
  return (customers ?? [])
    .filter((customer) => {
      const name = normalizeCustomerLookup(customer.name);
      const code = normalizeCustomerLookup(customer.customerCode);
      return name.includes(normalizedQuery) || code.includes(normalizedQuery);
    })
    .sort((a, b) => {
      const score = (customer) => {
        const name = normalizeCustomerLookup(customer.name);
        const code = normalizeCustomerLookup(customer.customerCode);
        if (code === normalizedQuery) return 4;
        if (name === normalizedQuery) return 3;
        if (name.startsWith(normalizedQuery)) return 2;
        return 1;
      };
      return score(b) - score(a) || String(a.name).localeCompare(String(b.name));
    })
    .slice(0, 5);
}

function validateOfferArguments(args) {
  const offerTitle = String(args?.offerTitle ?? "").trim();
  const personalizedMessage = String(args?.personalizedMessage ?? "").trim();
  const discountPct = Number(args?.discountPct);
  if (offerTitle.length < 3 || offerTitle.length > 180) {
    const error = new Error("El titulo debe tener entre 3 y 180 caracteres.");
    error.status = 400;
    throw error;
  }
  if (personalizedMessage.length < 10 || personalizedMessage.length > 1200) {
    const error = new Error("El mensaje debe tener entre 10 y 1,200 caracteres.");
    error.status = 400;
    throw error;
  }
  if (!Number.isFinite(discountPct) || discountPct < 0 || discountPct > 30) {
    const error = new Error("El descuento debe estar entre 0% y 30%.");
    error.status = 400;
    throw error;
  }
  const percentages = [...(offerTitle + " " + personalizedMessage).matchAll(/(\d+(?:[.,]\d+)?)\s*%/g)]
    .map((match) => Number(match[1].replace(",", ".")));
  if (percentages.some((value) => value !== discountPct)) {
    const error = new Error("El porcentaje mencionado en el texto debe coincidir con el descuento configurado (" + discountPct + "%).");
    error.status = 400;
    throw error;
  }
  return { offerTitle, personalizedMessage, discountPct };
}

function cleanExpiredAssistantOperations() {
  const now = Date.now();
  for (const [id, item] of pendingAssistantOperations) {
    if (item.expiresAt <= now) pendingAssistantOperations.delete(id);
  }
  while (pendingAssistantOperations.size > 500) {
    const oldest = pendingAssistantOperations.keys().next().value;
    if (!oldest) break;
    pendingAssistantOperations.delete(oldest);
  }
}

async function hasPendingLatestBatch(assessmentRows, actionRows) {
  const ids = new Set((assessmentRows ?? []).map((item) => String(item.assessment_id)));
  const runActions = (actionRows ?? []).filter((item) =>
    item.ai_generated && ids.has(String(item.assessment_id))
  );
  if (!runActions.length) return false;
  const batchTimes = [...new Set(runActions.map((item) => item.created_at))].sort();
  const currentTime = batchTimes[batchTimes.length - 1];
  return runActions.some((item) => item.created_at === currentTime && item.status === "proposed");
}

router.post("/assistant/chat", async (req, res, next) => {
  try {
    const section = String(req.body?.section ?? "overview");
    const rawMessages = Array.isArray(req.body?.messages) ? req.body.messages : [];
    if (!ASSISTANT_SECTIONS.has(section)) {
      return res.status(400).json({ message: "La pestana indicada no es valida." });
    }

    const messages = rawMessages.slice(-10)
      .filter((item) => item && ["user", "assistant"].includes(item.role) && typeof item.content === "string")
      .map((item) => ({ role: item.role, content: item.content.trim().slice(0, 2000) }))
      .filter((item) => item.content.length > 0);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return res.status(400).json({ message: "Escribe una pregunta para el asistente." });
    }
    if (messages[messages.length - 1].content.length > 1500) {
      return res.status(400).json({ message: "La pregunta supera el limite de 1,500 caracteres." });
    }

    const now = Date.now();
    const userKey = String(req.user.id);
    const usage = assistantRequests.get(userKey) ?? { windowStartedAt: now, count: 0 };
    if (now - usage.windowStartedAt >= 60_000) {
      usage.windowStartedAt = now;
      usage.count = 0;
    }
    if (usage.count >= 15) {
      return res.status(429).json({ message: "Has alcanzado el limite temporal del asistente. Intentalo nuevamente en un minuto." });
    }
    usage.count += 1;
    assistantRequests.set(userKey, usage);

    const analytics = await loadAnalytics();
    const { data: actionRows, error: actionsError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("assessment_id,usuario_key,status,ai_generated,created_at")
      .order("created_at", { ascending: false })
      .range(0, 4999);
    if (actionsError) throw actionsError;

    const selectedRaw = req.body?.selectedCustomerKey;
    const selectedKey = Number(selectedRaw);
    const hasSelectedKey = selectedRaw !== null && selectedRaw !== undefined && Number.isInteger(selectedKey) && selectedKey > 0;
    let selectedCustomerForModel = null;
    let selectedCustomerForOperation = null;

    if (hasSelectedKey) {
      const customer = analytics.customers.find((item) => Number(item.usuarioKey) === selectedKey);
      if (!customer) return res.status(404).json({ message: "El cliente seleccionado ya no esta disponible en la cartera." });

      const { data: actionRowsForCustomer, error: selectedActionError } = await supabase
        .schema("seren_ai")
        .from("reactivation_actions")
        .select("action_id,assessment_id,usuario_key,status,offer_title,personalized_message,offer_discount_pct,ai_generated,updated_at,notes")
        .eq("usuario_key", selectedKey)
        .order("created_at", { ascending: false })
        .limit(1);
      if (selectedActionError) throw selectedActionError;
      const selectedAction = actionRowsForCustomer?.[0] ?? null;

      const { data: assessments, error: selectedAssessmentError } = await supabase
        .schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id,usuario_key,risk_level,favorite_product_key")
        .eq("usuario_key", selectedKey)
        .order("assessed_at", { ascending: false })
        .limit(1);
      if (selectedAssessmentError) throw selectedAssessmentError;
      const latestAssessment = assessments?.[0] ?? null;

      let canCreateOffer = false;
      if (!selectedAction && latestAssessment && ["HIGH", "MEDIUM"].includes(customer.riskLevel)) {
        const { data: latestRuns, error: latestRunError } = await supabase
          .schema("seren_ai")
          .from("agent_runs")
          .select("run_id,status")
          .order("started_at", { ascending: false })
          .limit(1);
        if (latestRunError) throw latestRunError;
        const latestRun = latestRuns?.[0];
        if (latestRun?.status === "completed") {
          const { data: latestRunAssessments, error: latestRunAssessmentError } = await supabase
            .schema("seren_ai")
            .from("churn_assessments")
            .select("assessment_id")
            .eq("run_id", latestRun.run_id)
            .range(0, 4999);
          if (latestRunAssessmentError) throw latestRunAssessmentError;
          const pending = await hasPendingLatestBatch(latestRunAssessments, actionRows ?? []);
          const assessmentIsInLatestRun = (latestRunAssessments ?? []).some((item) =>
            String(item.assessment_id) === String(latestAssessment.assessment_id)
          );
          canCreateOffer = !pending && assessmentIsInLatestRun;
        }
      }

      const canEditOffer = Boolean(selectedAction?.ai_generated) &&
        ["proposed", "approved"].includes(selectedAction.status);
      const availableStatuses = selectedAction?.ai_generated
        ? (ACTION_TRANSITIONS[selectedAction.status] ?? [])
        : [];
      const canCopyMessage = Boolean(selectedAction?.ai_generated && selectedAction.personalized_message);
      const currentMessage = selectedAction
        ? redactName(selectedAction.personalized_message, customer.name).slice(0, 1200)
        : null;
      const customerPurchases = analytics.purchases
        .filter((purchase) => String(purchase.usuario_key) === String(selectedKey))
        .sort((a, b) => String(a.tiempo_key).localeCompare(String(b.tiempo_key)));
      const customerGrossSpend = customerPurchases.reduce(
        (sum, purchase) => sum + Number(purchase.monto_bruto_compra ?? 0),
        0
      );
      const recentPurchases = customerPurchases.slice(-5).reverse().map((purchase) => ({
        amountPEN: Number(Number(purchase.monto_bruto_compra ?? 0).toFixed(2)),
        daysSincePreviousPurchase: Number(purchase.dias_desde_compra_anterior ?? 0) || null,
      }));

      selectedCustomerForModel = {
        selected: true,
        riskLevel: customer.riskLevel,
        riskScore: customer.riskScore,
        daysSinceLastPurchase: customer.daysSinceLastPurchase,
        expectedIntervalDays: customer.expectedIntervalDays,
        overdueRatio: customer.overdueRatio,
        segment: customer.segment,
        favoriteProduct: customer.favoriteProduct?.name ?? null,
        customerActivity: {
          totalPurchases: customer.totalPurchases,
          recurringPurchases: customerPurchases.length,
          cumulativeSpendPEN: Number(customerGrossSpend.toFixed(2)),
          averageTicketPEN: customerPurchases.length
            ? Number((customerGrossSpend / customerPurchases.length).toFixed(2))
            : null,
          lastPurchaseDate: customer.lastPurchaseDate,
          recentPurchases,
        },
        hasOffer: Boolean(selectedAction),
        currentActionStatus: selectedAction?.status ?? null,
        currentOfferTitle: selectedAction ? redactName(selectedAction.offer_title, customer.name) : null,
        currentPersonalizedMessage: currentMessage,
        currentDiscountPct: selectedAction ? Number(selectedAction.offer_discount_pct) : null,
        canEditOffer,
        canCreateOffer,
        canCopyMessage,
        availableStatuses,
      };

      selectedCustomerForOperation = {
        usuarioKey: selectedKey,
        assessmentId: latestAssessment?.assessment_id ?? null,
        favoriteProductKey: latestAssessment?.favorite_product_key ?? customer.favoriteProduct?.key ?? null,
        action: selectedAction,
      };
    }

    const aggregateActions = (actionRows ?? []).map(({ status, ai_generated, created_at }) => ({ status, ai_generated, created_at }));
    const context = buildAssistantContext(section, analytics, aggregateActions, selectedCustomerForModel);
    const result = await answerAssistant({ section, messages, context });
    let pendingOperation = null;
    let copyText = null;

    if (result.operation) {
      const { name, arguments: args } = result.operation;

      if (name === "lookup_customer") {
        const query = String(args?.query ?? "").trim().slice(0, 100);
        if (query.length < 2) {
          return res.json({
            answer: "Escribe al menos dos caracteres del nombre o codigo para buscar al cliente.",
            section,
            model: env.groqModel,
          });
        }
        const matches = findCustomerMatches(analytics.customers, query);
        if (!matches.length) {
          return res.json({
            answer: "No encontre coincidencias para “" + query + "” en la cartera Customers. Comprueba el nombre o codigo; esta busqueda incluye clientes con dos o mas compras.",
            section,
            model: env.groqModel,
          });
        }
        return res.json({
          answer: matches.length === 1
            ? "He encontrado una coincidencia. Selecciona este cliente para que pueda revisar su informacion contigo."
            : "He encontrado varias coincidencias. Elige al cliente correcto para continuar.",
          section,
          model: env.groqModel,
          customerMatches: matches.map((customer) => ({
            customerKey: Number(customer.usuarioKey),
            customerCode: String(customer.customerCode),
            name: String(customer.name),
            segment: String(customer.segment),
            riskLevel: String(customer.riskLevel),
            totalPurchases: Number(customer.totalPurchases ?? 0),
            lastPurchaseDate: customer.lastPurchaseDate ?? null,
          })),
        });
      }

      const selected = selectedCustomerForOperation;
      if (!selected) return res.json({
        answer: "Para realizar esa operacion, primero identifica al cliente escribiendo su nombre o codigo, o selecciona una tarjeta con “Trabajar con Seren”.",
        section,
        model: env.groqModel,
      });

      if (name === "copy_offer_message") {
        if (!selected.action?.ai_generated || !selected.action.personalized_message) {
          return res.json({ answer: "Este cliente todavia no tiene un mensaje generado por Groq para copiar.", section, model: env.groqModel });
        }
        copyText = selected.action.personalized_message;
      } else if (name === "prepare_status_change") {
        const status = String(args?.status ?? "");
        const current = selected.action;
        if (!current || !(ACTION_TRANSITIONS[current.status] ?? []).includes(status)) {
          return res.json({
            answer: "No puedo preparar ese cambio: la accion no existe o la transicion no esta permitida desde su estado actual.",
            section,
            model: env.groqModel,
          });
        }
        cleanExpiredAssistantOperations();
        const proposalId = randomUUID();
        pendingAssistantOperations.set(proposalId, {
          userId: userKey,
          expiresAt: Date.now() + 5 * 60_000,
          type: "status",
          actionId: current.action_id,
          expectedStatus: current.status,
          expectedUpdatedAt: current.updated_at,
          targetStatus: status,
        });
        pendingOperation = {
          proposalId,
          type: "status",
          title: "Confirmar cambio de estado",
          before: STATUS_LABELS[current.status] ?? current.status,
          after: STATUS_LABELS[status] ?? status,
          summary: "La accion del cliente seleccionado cambiara de " + (STATUS_LABELS[current.status] ?? current.status) + " a " + (STATUS_LABELS[status] ?? status) + ".",
          expiresInSeconds: 300,
        };
      } else if (name === "prepare_offer_update" || name === "prepare_offer_create") {
        const offer = validateOfferArguments(args);
        const current = selected.action;
        const isCreate = name === "prepare_offer_create";
        if (isCreate && (current || !selected.assessmentId || !selectedCustomerForModel?.canCreateOffer)) {
          return res.json({
            answer: "No puedo crear la propuesta ahora. Verifica que el cliente tenga una evaluacion guardada, que no exista ya una accion y que el lote actual del Agente Seren no tenga aprobaciones pendientes.",
            section,
            model: env.groqModel,
          });
        }
        if (!isCreate && (!current?.ai_generated || !["proposed", "approved"].includes(current.status))) {
          return res.json({
            answer: "Esta oferta no se puede editar: debe existir una propuesta generada por Groq que aun no haya sido contactada.",
            section,
            model: env.groqModel,
          });
        }
        cleanExpiredAssistantOperations();
        const proposalId = randomUUID();
        const before = isCreate ? null : {
          offerTitle: current.offer_title,
          personalizedMessage: current.personalized_message,
          discountPct: Number(current.offer_discount_pct),
        };
        pendingAssistantOperations.set(proposalId, {
          userId: userKey,
          expiresAt: Date.now() + 5 * 60_000,
          type: isCreate ? "create_offer" : "update_offer",
          usuarioKey: selected.usuarioKey,
          assessmentId: selected.assessmentId,
          favoriteProductKey: selected.favoriteProductKey,
          actionId: current?.action_id ?? null,
          expectedStatus: current?.status ?? null,
          expectedUpdatedAt: current?.updated_at ?? null,
          offer,
        });
        pendingOperation = {
          proposalId,
          type: isCreate ? "create_offer" : "update_offer",
          title: isCreate ? "Confirmar nueva propuesta" : "Confirmar edicion de oferta",
          before,
          after: offer,
          summary: isCreate
            ? "Se creara una propuesta generada por Groq. Quedara pendiente de aprobacion y aparecera en Agente Seren y Reactivaciones."
            : "Se guardaran el nuevo titulo, mensaje y descuento. Si la propuesta ya estaba aprobada, volvera a estado propuesta para requerir una nueva aprobacion.",
          expiresInSeconds: 300,
        };
      }
    }

    res.json({
      answer: result.answer,
      section,
      model: env.groqModel,
      ...(pendingOperation ? { pendingOperation } : {}),
      ...(copyText ? { copyText } : {}),
    });
  } catch (error) {
    next(error);
  }
});

router.post("/assistant/execute", async (req, res, next) => {
  try {
    cleanExpiredAssistantOperations();
    const proposalId = String(req.body?.proposalId ?? "");
    const pending = pendingAssistantOperations.get(proposalId);
    if (!pending || pending.userId !== String(req.user.id)) {
      return res.status(404).json({ message: "La propuesta ya no existe o ha caducado. Pidele a Seren que la prepare nuevamente." });
    }
    if (pending.expiresAt <= Date.now()) {
      pendingAssistantOperations.delete(proposalId);
      return res.status(410).json({ message: "La propuesta ha caducado. Pidele a Seren que la prepare nuevamente." });
    }
    pendingAssistantOperations.delete(proposalId);

    const userId = String(req.user.id);
    const now = new Date().toISOString();
    let action = null;
    let message = "";

    if (pending.type === "status") {
      const { data: current, error: readError } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .select("action_id,status,updated_at,notes,ai_generated")
        .eq("action_id", pending.actionId)
        .maybeSingle();
      if (readError) throw readError;
      if (!current || !current.ai_generated) return res.status(404).json({ message: "La propuesta seleccionada ya no esta disponible." });
      if (current.status !== pending.expectedStatus || current.updated_at !== pending.expectedUpdatedAt) {
        return res.status(409).json({ message: "La accion cambio desde que Seren preparo la operacion. Actualiza la pagina y revisa su estado." });
      }
      if (!(ACTION_TRANSITIONS[current.status] ?? []).includes(pending.targetStatus)) {
        return res.status(409).json({ message: "La transicion ya no esta permitida para el estado actual." });
      }
      const timestampField = {
        approved: "approved_at",
        contacted: "contacted_at",
        responded: "responded_at",
        reactivated: "reactivated_at",
      }[pending.targetStatus];
      const updates = {
        status: pending.targetStatus,
        updated_at: now,
        notes: appendAssistantAudit(current.notes, userId, "status " + current.status + " -> " + pending.targetStatus),
      };
      if (timestampField) updates[timestampField] = now;
      const { data, error } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .update(updates)
        .eq("action_id", current.action_id)
        .eq("status", current.status)
        .eq("updated_at", current.updated_at)
        .select("action_id,status,approved_at,contacted_at,responded_at,reactivated_at,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ message: "Otro usuario modifico esta accion primero. Actualiza la pagina y vuelve a intentarlo." });
      action = data;
      message = "Listo. La accion quedo " + (STATUS_LABELS[data.status] ?? data.status) + " y el cambio ya esta guardado.";
    } else if (pending.type === "update_offer") {
      const { data: current, error: readError } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .select("action_id,status,updated_at,notes,ai_generated")
        .eq("action_id", pending.actionId)
        .maybeSingle();
      if (readError) throw readError;
      if (!current || !current.ai_generated || !["proposed", "approved"].includes(current.status)) {
        return res.status(409).json({ message: "Esta oferta ya no puede editarse porque su estado cambio o ya fue contactada." });
      }
      if (current.status !== pending.expectedStatus || current.updated_at !== pending.expectedUpdatedAt) {
        return res.status(409).json({ message: "La oferta cambio desde que Seren preparo la edicion. Actualiza la pagina y vuelve a revisar." });
      }
      const wasApproved = current.status === "approved";
      const updates = {
        offer_title: pending.offer.offerTitle,
        personalized_message: pending.offer.personalizedMessage,
        offer_discount_pct: pending.offer.discountPct,
        updated_at: now,
        notes: appendAssistantAudit(current.notes, userId, "offer edited; discount " + pending.offer.discountPct + "%; message/title updated"),
        ...(wasApproved ? { status: "proposed", approved_at: null } : {}),
      };
      const { data, error } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .update(updates)
        .eq("action_id", current.action_id)
        .eq("status", current.status)
        .eq("updated_at", current.updated_at)
        .select("action_id,status,offer_title,personalized_message,offer_discount_pct,updated_at")
        .maybeSingle();
      if (error) throw error;
      if (!data) return res.status(409).json({ message: "Otro usuario modifico esta oferta primero. Actualiza la pagina y vuelve a intentarlo." });
      action = data;
      message = "Oferta actualizada y guardada. Ya aparece en Agente Seren y Reactivaciones." +
        (wasApproved ? " Como cambio una oferta aprobada, volvio a estado propuesta y requiere nueva aprobacion." : "");
    } else if (pending.type === "create_offer") {
      const { data: existing, error: existingError } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .select("action_id")
        .eq("assessment_id", pending.assessmentId)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) return res.status(409).json({ message: "Ya existe una accion para esta evaluacion. Actualiza la vista antes de continuar." });

      const { data: assessment, error: assessmentError } = await supabase.schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id,usuario_key,risk_level,favorite_product_key")
        .eq("assessment_id", pending.assessmentId)
        .maybeSingle();
      if (assessmentError) throw assessmentError;
      if (!assessment || String(assessment.usuario_key) !== String(pending.usuarioKey) || !["HIGH", "MEDIUM"].includes(assessment.risk_level)) {
        return res.status(409).json({ message: "La evaluacion del cliente ya no esta disponible o no corresponde a un cliente con riesgo moderado/alto." });
      }

      const { data: latestRuns, error: latestRunError } = await supabase.schema("seren_ai")
        .from("agent_runs")
        .select("run_id,status")
        .order("started_at", { ascending: false })
        .limit(1);
      if (latestRunError) throw latestRunError;
      if (!latestRuns?.length || latestRuns[0].status !== "completed") {
        return res.status(409).json({ message: "No hay una ejecucion completada para guardar esta propuesta." });
      }
      const { data: latestAssessments, error: latestAssessmentsError } = await supabase.schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id")
        .eq("run_id", latestRuns[0].run_id)
        .range(0, 4999);
      if (latestAssessmentsError) throw latestAssessmentsError;
      const assessmentIsInLatestRun = (latestAssessments ?? []).some((item) =>
        String(item.assessment_id) === String(pending.assessmentId)
      );
      if (!assessmentIsInLatestRun) {
        return res.status(409).json({ message: "La evaluacion seleccionada no pertenece al analisis mas reciente. Ejecuta o actualiza el analisis antes de crear una oferta." });
      }
      const { data: allActions, error: allActionsError } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .select("assessment_id,status,ai_generated,created_at")
        .range(0, 4999);
      if (allActionsError) throw allActionsError;
      if (await hasPendingLatestBatch(latestAssessments, allActions ?? [])) {
        return res.status(409).json({ message: "Primero termina de aprobar el lote activo en Agente Seren; despues podras crear una propuesta individual desde Riesgo de churn." });
      }

      const { data, error } = await supabase.schema("seren_ai")
        .from("reactivation_actions")
        .insert({
          assessment_id: assessment.assessment_id,
          usuario_key: assessment.usuario_key,
          status: "proposed",
          favorite_product_key: pending.favoriteProductKey ?? assessment.favorite_product_key,
          offer_discount_pct: pending.offer.discountPct,
          offer_title: pending.offer.offerTitle,
          personalized_message: pending.offer.personalizedMessage,
          ai_explanation: "Propuesta individual generada por Groq desde el asistente contextual de Seren AI.",
          ai_generated: true,
          created_at: now,
          updated_at: now,
          notes: appendAssistantAudit("", userId, "individual Groq offer created from churn page"),
        })
        .select("action_id,status,offer_title,personalized_message,offer_discount_pct,created_at,updated_at")
        .single();
      if (error) {
        if (error.code === "23505") return res.status(409).json({ message: "Ya existe una propuesta para esta evaluacion. Actualiza la vista." });
        throw error;
      }
      action = data;
      message = "Nueva propuesta generada por Groq guardada. Aparece en Agente Seren y Reactivaciones, pendiente de aprobacion.";
    } else {
      return res.status(400).json({ message: "Operacion no reconocida." });
    }

    invalidateAnalyticsCache();
    res.json({ message, action });
  } catch (error) {
    next(error);
  }
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
    const { data: actionRows, error: actionError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("action_id,usuario_key,status,offer_title,personalized_message,offer_discount_pct,ai_generated,updated_at,created_at")
      .order("created_at", { ascending: false })
      .range(0, 4999);
    if (actionError) throw actionError;

    const latestActionByUser = new Map();
    for (const action of actionRows ?? []) {
      const key = String(action.usuario_key);
      if (!latestActionByUser.has(key)) latestActionByUser.set(key, action);
    }

    const customers = data.customers
      .filter((customer) =>
        ["HIGH", "MEDIUM"].includes(customer.riskLevel) &&
        (risk === "ALL" || customer.riskLevel === risk)
      )
      .map((customer) => {
        const action = latestActionByUser.get(String(customer.usuarioKey));
        return {
          ...customer,
          reactivationAction: action ? {
            actionId: action.action_id,
            status: action.status,
            offerTitle: action.offer_title,
            personalizedMessage: action.personalized_message,
            offerDiscountPct: Number(action.offer_discount_pct ?? 0),
            aiGenerated: Boolean(action.ai_generated),
            updatedAt: action.updated_at,
          } : null,
        };
      });
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
      .select("action_id,assessment_id,usuario_key,status,offer_title,personalized_message,ai_explanation,offer_discount_pct,ai_generated,created_at,approved_at,contacted_at,reactivated_at")
      .order("created_at", { ascending: false })
      .limit(5000);

    if (error) {
      return res.json({
        migrationReady: false,
        recommendations: [],
        activeBatchRecommendations: [],
        actions: [],
        activeBatchNumber: 0,
        activeBatchSize: 0,
        remainingCandidates: 0,
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
        aiExplanation: action.ai_explanation ?? null,
        offerDiscount: Number(action.offer_discount_pct ?? item.offerDiscount),
        aiGenerated: Boolean(action.ai_generated),
      } : { ...item, aiGenerated: false };
    });

    const { data: runs, error: runError } = await supabase
      .schema("seren_ai")
      .from("agent_runs")
      .select("run_id,started_at,status")
      .order("started_at", { ascending: false })
      .limit(1);
    if (runError) throw runError;

    let activeBatchActions = [];
    let activeBatchNumber = 0;
    let remainingCandidates = 0;
    if (runs?.length) {
      const latestRun = runs[0];
      const { data: assessments, error: assessmentError } = await supabase
        .schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id,usuario_key,risk_level")
        .eq("run_id", latestRun.run_id)
        .range(0, 4999);
      if (assessmentError) throw assessmentError;

      const assessmentIdSet = new Set((assessments ?? []).map((item) => String(item.assessment_id)));
      const runActions = (actions ?? []).filter((item) => assessmentIdSet.has(String(item.assessment_id)));

      const aiActions = (runActions ?? []).filter((item) => item.ai_generated);
      if (aiActions.length) {
        const batchTimes = [...new Set(aiActions.map((item) => item.created_at))].sort();
        const currentBatchTime = batchTimes[batchTimes.length - 1];
        activeBatchActions = aiActions.filter((item) => item.created_at === currentBatchTime);
        activeBatchNumber = batchTimes.length;
      }

      const usersWithRunAction = new Set((runActions ?? []).map((item) => String(item.usuario_key)));
      const { data: openActions, error: openActionsError } = await supabase
        .schema("seren_ai")
        .from("reactivation_actions")
        .select("usuario_key")
        .in("status", ["proposed", "approved", "contacted", "responded"])
        .range(0, 4999);
      if (openActionsError) throw openActionsError;
      const usersWithOpenAction = new Set((openActions ?? []).map((item) => String(item.usuario_key)));
      remainingCandidates = (assessments ?? []).filter((assessment) =>
        ["HIGH", "MEDIUM"].includes(assessment.risk_level) &&
        !usersWithRunAction.has(String(assessment.usuario_key)) &&
        !usersWithOpenAction.has(String(assessment.usuario_key))
      ).length;
    }

    const activeUsers = new Set(activeBatchActions.map((item) => String(item.usuario_key)));
    const activeBatchRecommendations = persistedRecommendations.filter((item) =>
      activeUsers.has(String(item.usuarioKey)) && item.aiGenerated === true
    );

    res.json({
      migrationReady: true,
      recommendations: persistedRecommendations,
      activeBatchRecommendations,
      activeBatchActions,
      activeBatchNumber,
      activeBatchSize: activeBatchActions.length,
      remainingCandidates,
      actions: actions ?? [],
      aiProvider: { configured: Boolean(env.groqApiKey), model: env.groqModel },
    });
  } catch (error) {
    next(error);
  }
});

router.post("/agent/analyze", async (_req, res, next) => {
  let runId = null;
  try {
    // Only block a new analysis while the visible, newest batch still has proposals pending.
    // Older/orphaned proposals remain in Reactivaciones history and must not lock the agent screen.
    const { data: latestRunsForGuard, error: latestRunGuardError } = await supabase
      .schema("seren_ai")
      .from("agent_runs")
      .select("run_id")
      .order("started_at", { ascending: false })
      .limit(1);
    if (latestRunGuardError) throw latestRunGuardError;

    if (latestRunsForGuard?.length) {
      const latestRunForGuard = latestRunsForGuard[0];
      const { data: guardAssessments, error: guardAssessmentError } = await supabase
        .schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id")
        .eq("run_id", latestRunForGuard.run_id)
        .range(0, 4999);
      if (guardAssessmentError) throw guardAssessmentError;

      const guardAssessmentIds = new Set((guardAssessments ?? []).map((item) => String(item.assessment_id)));
      const { data: guardActions, error: guardActionsError } = await supabase
        .schema("seren_ai")
        .from("reactivation_actions")
        .select("assessment_id,status,ai_generated,created_at")
        .order("created_at", { ascending: false })
        .range(0, 4999);
      if (guardActionsError) throw guardActionsError;

      const runAiActions = (guardActions ?? []).filter((item) =>
        item.ai_generated && guardAssessmentIds.has(String(item.assessment_id))
      );
      if (runAiActions.length) {
        const batchTimes = [...new Set(runAiActions.map((item) => item.created_at))].sort();
        const activeBatchTime = batchTimes[batchTimes.length - 1];
        const pendingActiveBatch = runAiActions.filter((item) =>
          item.created_at === activeBatchTime && item.status === "proposed"
        );

        if (pendingActiveBatch.length) {
          return res.status(409).json({
            message: "Termina de aprobar las recomendaciones del lote actual antes de iniciar un nuevo analisis.",
            pendingApprovals: pendingActiveBatch.length,
            batchSize: runAiActions.filter((item) => item.created_at === activeBatchTime).length,
          });
        }
      }
    }

    const data = await loadAnalytics({ force: true });
    const { data: openActions, error: openActionsError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("usuario_key")
      .in("status", ["proposed", "approved", "contacted", "responded"])
      .range(0, 4999);
    if (openActionsError) throw openActionsError;
    const usersWithOpenAction = new Set((openActions ?? []).map((item) => String(item.usuario_key)));
    const baseRecommendations = createRecommendations(data.customers)
      .filter((item) => !usersWithOpenAction.has(String(item.usuarioKey)));
    // Seren exposes only AI-generated recommendations. Template fallbacks are not persisted as actions.
    const { recommendations, ai } = await enrichRecommendations(baseRecommendations.slice(0, 20));
    const aiRecommendations = recommendations.filter((item) => item.aiGenerated === true);
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
    if (runError) throw new Error("No se pudo guardar la ejecucion. Ejecuta la migracion Seren AI: " + runError.message);

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

    // Read back only the customers for whom Groq produced valid content.
    // A full-run read can exceed PostgREST's default row cap (often 1,000),
    // silently omitting selected customers when the run assessed more than 1,000.
    let savedAssessments = [];
    if (aiRecommendations.length) {
      const { data: matchedAssessments, error: readError } = await supabase
        .schema("seren_ai")
        .from("churn_assessments")
        .select("assessment_id,run_id,usuario_key,risk_level,favorite_product_key")
        .eq("run_id", runId)
        .in("usuario_key", aiRecommendations.map((item) => item.usuarioKey));
      if (readError) throw readError;
      savedAssessments = matchedAssessments ?? [];
    }
    if (savedAssessments.length !== aiRecommendations.length) {
      console.warn(
        "[agent/analyze] Groq/persistence mismatch:",
        { groqGenerated: aiRecommendations.length, matchedAssessments: savedAssessments.length }
      );
    }

    const recByUser = new Map(aiRecommendations.map((item) => [String(item.usuarioKey), item]));
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
          ai_explanation: recommendation.aiExplanation ?? null,
          ai_generated: true,
          created_at: now,
          updated_at: now,
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
      message: actions.length
        ? "Analisis completado. Solo las recomendaciones generadas por Groq quedan visibles y pendientes de aprobacion."
        : aiRecommendations.length
          ? "Groq genero " + aiRecommendations.length + " propuestas, pero no se pudieron vincular con sus evaluaciones para guardarlas. Revisa el registro del backend antes de repetir el analisis."
          : "Analisis completado, pero Groq no genero propuestas validas para mostrar. Puedes volver a ejecutar el analisis.",
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

router.post("/agent/next-batch", async (_req, res, next) => {
  try {
    const { data: runs, error: runError } = await supabase
      .schema("seren_ai")
      .from("agent_runs")
      .select("run_id,status")
      .order("started_at", { ascending: false })
      .limit(1);
    if (runError) throw runError;
    if (!runs?.length) {
      return res.status(409).json({ message: "Primero ejecuta el analisis del Agente Seren." });
    }

    const latestRun = runs[0];
    if (latestRun.status !== "completed") {
      return res.status(409).json({ message: "La ejecucion mas reciente aun no ha finalizado." });
    }

    const { data: assessments, error: assessmentError } = await supabase
      .schema("seren_ai")
      .from("churn_assessments")
      .select("assessment_id,usuario_key,risk_level")
      .eq("run_id", latestRun.run_id)
      .in("risk_level", ["HIGH", "MEDIUM"])
      .range(0, 4999);
    if (assessmentError) throw assessmentError;
    const { data: allRunActions, error: actionsError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("assessment_id,usuario_key,status,ai_generated,created_at")
      .order("created_at", { ascending: false })
      .range(0, 4999);
    if (actionsError) throw actionsError;
    const assessmentIdSet = new Set((assessments ?? []).map((item) => String(item.assessment_id)));
    const runActions = (allRunActions ?? []).filter((item) => assessmentIdSet.has(String(item.assessment_id)));

    const aiActions = runActions.filter((item) => item.ai_generated);
    const batchTimes = [...new Set(aiActions.map((item) => item.created_at))].sort();

    // If an analysis assessed the portfolio but failed to persist its first
    // Groq batch, allow this endpoint to create that first batch from the
    // already saved assessments instead of forcing a full portfolio rerun.
    if (aiActions.length) {
      const currentBatchTime = batchTimes[batchTimes.length - 1];
      const currentBatch = aiActions.filter((item) => item.created_at === currentBatchTime);
      const approvalComplete = currentBatch.length > 0 && currentBatch.every((item) =>
        ["approved", "contacted", "responded", "reactivated"].includes(item.status)
      );

      if (!approvalComplete) {
        const approvedCount = currentBatch.filter((item) =>
          ["approved", "contacted", "responded", "reactivated"].includes(item.status)
        ).length;
        return res.json({
          generated: 0,
          waitingForApproval: true,
          approvedCount,
          batchSize: currentBatch.length,
          message: "El lote actual todavia tiene recomendaciones pendientes de aprobacion.",
        });
      }
    }

    const usersWithRunAction = new Set((runActions ?? []).map((item) => String(item.usuario_key)));
    const { data: openActions, error: openActionsError } = await supabase
      .schema("seren_ai")
      .from("reactivation_actions")
      .select("usuario_key")
      .in("status", ["proposed", "approved", "contacted", "responded"])
      .range(0, 4999);
    if (openActionsError) throw openActionsError;
    const usersWithOpenAction = new Set((openActions ?? []).map((item) => String(item.usuario_key)));

    const eligibleUserKeys = new Set((assessments ?? [])
      .filter((item) =>
        !usersWithRunAction.has(String(item.usuario_key)) &&
        !usersWithOpenAction.has(String(item.usuario_key))
      )
      .map((item) => String(item.usuario_key)));

    const data = await loadAnalytics({ force: true });
    const allCandidates = createRecommendations(data.customers)
      .filter((item) => eligibleUserKeys.has(String(item.usuarioKey)))
      .slice(0, 20);

    if (!allCandidates.length) {
      return res.json({
        generated: 0,
        queueComplete: true,
        batchNumber: batchTimes.length,
        remainingCandidates: 0,
        message: "Todos los clientes elegibles de esta ejecucion ya fueron procesados.",
      });
    }

    const { recommendations, ai } = await enrichRecommendations(allCandidates);
    const aiRecommendations = recommendations.filter((item) => item.aiGenerated === true);
    if (!aiRecommendations.length) {
      return res.json({
        generated: 0,
        warning: true,
        ai,
        remainingCandidates: allCandidates.length,
        message: "Groq no genero propuestas validas para este lote. No se mostraron mensajes de plantilla; puedes intentarlo nuevamente.",
      });
    }

    const assessmentByUser = new Map((assessments ?? []).map((item) => [String(item.usuario_key), item]));
    const now = new Date().toISOString();
    const actions = aiRecommendations.map((recommendation) => {
      const assessment = assessmentByUser.get(String(recommendation.usuarioKey));
      return {
        assessment_id: assessment.assessment_id,
        usuario_key: recommendation.usuarioKey,
        status: "proposed",
        favorite_product_key: recommendation.favoriteProduct?.key ?? null,
        offer_discount_pct: recommendation.offerDiscount,
        offer_title: recommendation.offerTitle,
        personalized_message: recommendation.personalizedMessage,
        ai_explanation: recommendation.aiExplanation ?? null,
        ai_generated: true,
        created_at: now,
        updated_at: now,
      };
    });

    const { error: insertError } = await supabase.schema("seren_ai").from("reactivation_actions")
      .upsert(actions, { onConflict: "assessment_id", ignoreDuplicates: true });
    if (insertError) throw insertError;

    res.json({
      generated: actions.length,
      batchNumber: batchTimes.length + 1,
      remainingCandidates: Math.max(0, allCandidates.length - actions.length),
      ai,
      message: "El siguiente lote de recomendaciones generadas por Groq ya esta disponible.",
    });
  } catch (error) {
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
