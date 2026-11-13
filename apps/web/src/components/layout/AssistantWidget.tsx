import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, Check, Clipboard, LoaderCircle, MessageCircle, RotateCcw, Send, ShieldCheck, Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";
import { AssistantMessage } from "./AssistantMessage";

type Message = { role: "user" | "assistant"; content: string };
type OfferSnapshot = { offerTitle: string; personalizedMessage: string; discountPct: number };
type PendingOperation =
  | {
      proposalId: string;
      type: "status";
      title: string;
      summary: string;
      before: string;
      after: string;
      expiresInSeconds: number;
    }
  | {
      proposalId: string;
      type: "update_offer" | "create_offer";
      title: string;
      summary: string;
      before: null | OfferSnapshot;
      after: OfferSnapshot;
      expiresInSeconds: number;
    };
type CustomerMatch = {
  customerKey: number;
  customerCode: string;
  name: string;
  segment: string;
  riskLevel: string;
  totalPurchases: number;
  lastPurchaseDate: string | null;
};
type ChatResponse = {
  answer: string;
  section: string;
  model: string;
  pendingOperation?: PendingOperation;
  copyText?: string;
  customerMatches?: CustomerMatch[];
};
type ExecuteResponse = { message: string; action: Record<string, unknown> };

const sectionLabels: Record<string, string> = {
  overview: "Resumen",
  customers: "Customers",
  churn: "Riesgo de churn",
  agent: "Agente Seren",
  campaigns: "Reactivaciones",
  reports: "Reportes BI",
  settings: "Configuracion",
};

const greetings: Record<string, string> = {
  overview: "Hola. Puedo ayudarte a interpretar los indicadores generales, entender las señales de riesgo y leer la evolucion de la retencion.",
  customers: "Estas en Customers. Puedes preguntarme por un cliente escribiendo su nombre o codigo directamente; tambien puedo explicarte los segmentos y la frecuencia de compra.",
  churn: "Estas en Riesgo de churn. Selecciona una tarjeta con “Trabajar con Seren” y podre preparar ofertas, editar mensajes y gestionar la propuesta de ese cliente.",
  agent: "Estas en Agente Seren. Puedo explicarte los lotes de Groq, revisar una propuesta seleccionada y ayudarte a aprobarla.",
  campaigns: "Estas en Reactivaciones. Puedo ayudarte a interpretar los estados y gestionar la accion del cliente seleccionado.",
  reports: "Estas en Reportes BI. Puedo ayudarte a leer los graficos, comparar segmentos y entender los indicadores de compras recurrentes.",
  settings: "Estas en Configuracion. Puedo explicarte las conexiones, la autenticacion, la seguridad y el estado de los servicios.",
};

const suggestions: Record<string, string[]> = {
  overview: ["¿Como interpreto la tasa de churn?", "¿Que indicador deberia revisar primero?", "¿Como se calcula la recompra?"],
  customers: ["¿Que diferencia hay entre VIP y Frecuente?", "¿Como se calcula la frecuencia?", "¿Por que se excluye a los Payers de una compra?"],
  churn: ["Prepara una oferta para el cliente seleccionado", "Mejora el mensaje y conserva el descuento", "¿Que acciones puedo ejecutar con este cliente?"],
  agent: ["¿Como se generan los lotes de 20?", "¿Que ocurre al aprobar todas las propuestas?", "¿Groq decide el nivel de riesgo?"],
  campaigns: ["¿Que significa cada estado?", "¿Como se calcula la tasa de reactivacion?", "¿Un mensaje se envia automaticamente?"],
  reports: ["¿Que mide la frecuencia por segmento?", "¿Por que los importes son recurrentes?", "¿Como interpreto la evolucion mensual?"],
  settings: ["¿Como se protege la clave de Supabase?", "¿Que servicios utiliza Seren AI?", "¿Que pasa si Groq no esta configurado?"],
};

function displayValue(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "string" || typeof value === "number") return String(value);
  return JSON.stringify(value);
}

export function AssistantWidget({ section }: { section: string }) {
  const activeSection = sectionLabels[section] ? section : "overview";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState("");
  const [selectedCustomerKey, setSelectedCustomerKey] = useState<number | null>(null);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState("");
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [copyText, setCopyText] = useState("");
  const [customerMatches, setCustomerMatches] = useState<CustomerMatch[]>([]);
  const [copied, setCopied] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const previousSection = useRef(activeSection);
  useEffect(() => {
    if (previousSection.current !== activeSection) {
      previousSection.current = activeSection;
      setMessages([{ role: "assistant", content: greetings[activeSection] }]);
      setCopyText("");
      setCustomerMatches([]);
      setError("");
    } else if (messages.length === 0) {
      setMessages([{ role: "assistant", content: greetings[activeSection] }]);
    }
  }, [activeSection, messages.length]);

  useEffect(() => {
    const handleSelection = (event: Event) => {
      const detail = (event as CustomEvent<{ customerKey: number; customerLabel?: string }>).detail;
      if (!detail || !Number.isInteger(Number(detail.customerKey))) return;
      setSelectedCustomerKey(Number(detail.customerKey));
      setSelectedCustomerLabel(String(detail.customerLabel ?? "Cliente seleccionado"));
      setPendingOperation(null);
      setCopyText("");
      setCustomerMatches([]);
      setError("");
      setOpen(true);
      setMessages([
        { role: "assistant", content: greetings[activeSection] },
        { role: "assistant", content: "He seleccionado " + String(detail.customerLabel ?? "el cliente") + ". Ahora puedes pedirme que prepare una oferta, edite su mensaje, copie la propuesta o gestione su estado. No guardaré cambios sin tu confirmación." },
      ]);
    };
    window.addEventListener("seren:select-customer", handleSelection);
    return () => window.removeEventListener("seren:select-customer", handleSelection);
  }, [activeSection]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, executing, pendingOperation, copyText, open]);

  async function sendMessage(value = draft, includeInHistory = true) {
    const question = value.trim();
    if (!question || sending || executing || pendingOperation) return;

    const nextMessages: Message[] = includeInHistory
      ? [...messages, { role: "user", content: question }]
      : messages.slice(-10);
    if (includeInHistory) setMessages(nextMessages);
    if (includeInHistory) setDraft("");
    setError("");
    setCopyText("");
    setCustomerMatches([]);
    setCopied(false);
    setSending(true);
    try {
      const result = await api<ChatResponse>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({
          section: activeSection,
          messages: nextMessages.slice(-10),
          selectedCustomerKey,
        }),
      });
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
      setPendingOperation(result.pendingOperation ?? null);
      setCopyText(result.copyText ?? "");
      setCustomerMatches(result.customerMatches ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar a Seren. Intentalo nuevamente.");
    } finally {
      setSending(false);
    }
  }

  async function confirmOperation() {
    if (!pendingOperation || executing) return;
    setExecuting(true);
    setError("");
    try {
      const result = await api<ExecuteResponse>("/assistant/execute", {
        method: "POST",
        body: JSON.stringify({ proposalId: pendingOperation.proposalId }),
      });
      setPendingOperation(null);
      setMessages((current) => [...current, { role: "assistant", content: result.message }]);
      window.dispatchEvent(new CustomEvent("seren:data-updated", { detail: { action: result.action } }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo guardar la operacion.");
    } finally {
      setExecuting(false);
    }
  }

  async function copyMessage() {
    if (!copyText) return;
    try {
      await navigator.clipboard.writeText(copyText);
      setCopied(true);
      setError("");
    } catch {
      setError("No se pudo copiar automaticamente. Selecciona el texto del mensaje y copialo manualmente.");
    }
  }

  function cancelOperation() {
    setPendingOperation(null);
    setMessages((current) => [...current, { role: "assistant", content: "Operacion cancelada. No se guardo ningun cambio." }]);
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void sendMessage();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  }

  function resetConversation() {
    setError("");
    setDraft("");
    setPendingOperation(null);
    setCopyText("");
    setCustomerMatches([]);
    setMessages([{ role: "assistant", content: greetings[activeSection] }]);
  }

  return (
    <>
      {open && (
        <section
          aria-label="Asistente contextual Seren"
          className="fixed bottom-[92px] right-4 z-[70] flex h-[min(680px,calc(100vh-8rem))] w-[min(410px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_80px_rgba(27,47,39,0.22)] sm:bottom-24 sm:right-6"
        >
          <header className="flex items-center justify-between bg-[#23483d] px-4 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#e7d7b8]"><Sparkles size={19} /></div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold">Seren · Asistente</p>
                <p className="mt-0.5 truncate text-[10px] text-white/65">Asistente operativo · {sectionLabels[activeSection]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={resetConversation} aria-label="Reiniciar conversacion" title="Reiniciar conversacion" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"><RotateCcw size={15} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"><X size={17} /></button>
            </div>
          </header>

          <div className="flex items-center gap-2 border-b border-line bg-[#f8f8f4] px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[#71927c]" />
            <p className="min-w-0 truncate text-[10px] text-muted">Contexto: <b className="text-ink">{sectionLabels[activeSection]}</b></p>
            <span className="ml-auto shrink-0 rounded-full bg-[#e8efe8] px-2 py-1 text-[9px] font-bold text-forest">Con confirmacion</span>
          </div>

          {selectedCustomerKey !== null && (
            <div className="flex items-center gap-2 border-b border-[#dce7dc] bg-[#f1f6f0] px-4 py-2">
              <ShieldCheck size={13} className="shrink-0 text-forest" />
              <p className="min-w-0 truncate text-[10px] text-forest">Trabajando con: <b>{selectedCustomerLabel}</b></p>
              <button type="button" onClick={() => { setSelectedCustomerKey(null); setSelectedCustomerLabel(""); setPendingOperation(null); }} className="ml-auto shrink-0 text-[10px] font-bold text-muted hover:text-ink">Quitar</button>
            </div>
          )}

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfcf9] px-3.5 py-4">
            {messages.map((message, index) => (
              <div key={index} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" && <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e9] text-forest"><Bot size={15} /></div>}
                <div className={"max-w-[86%] rounded-2xl px-3.5 py-3 text-xs leading-5 " + (message.role === "user" ? "rounded-br-md bg-[#23483d] text-white" : "rounded-bl-md border border-line bg-white text-ink shadow-sm")}>
                  <div className="break-words"><AssistantMessage content={message.content} /></div>
                </div>
              </div>
            ))}

            {customerMatches.length > 0 && (
              <div className="ml-9 space-y-2 rounded-2xl border border-[#dce7dc] bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-forest">Clientes encontrados</p>
                  <span className="rounded-full bg-[#edf3ed] px-2 py-1 text-[9px] font-bold text-forest">{customerMatches.length} coincidencia{customerMatches.length === 1 ? "" : "s"}</span>
                </div>
                {customerMatches.map((customer) => (
                  <div key={customer.customerKey} className="rounded-xl border border-line bg-[#fbfcf9] p-3">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-bold text-ink">{customer.name}</p>
                      <p className="mt-0.5 text-[10px] text-muted">Código {customer.customerCode} · {customer.segment}</p>
                      <p className="mt-1 text-[10px] text-muted">{customer.totalPurchases} compras · Riesgo {customer.riskLevel === "HIGH" ? "alto" : customer.riskLevel === "MEDIUM" ? "moderado" : customer.riskLevel === "LOW" ? "bajo" : "sin datos"}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setCustomerMatches([]);
                        window.dispatchEvent(new CustomEvent("seren:select-customer", { detail: { customerKey: customer.customerKey, customerLabel: customer.name } }));
                      }}
                      className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-forest px-3 py-2 text-[10px] font-bold text-white transition hover:bg-[#315b4b]"
                    >
                      <Check size={13} /> Usar este cliente
                    </button>
                  </div>
                ))}
              </div>
            )}

            {pendingOperation && (
              <div className="ml-9 overflow-hidden rounded-2xl border border-[#d6e2d6] bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-line bg-[#f2f7f1] px-3.5 py-3">
                  <ShieldCheck size={15} className="text-forest" />
                  <p className="text-xs font-bold text-ink">{pendingOperation.title}</p>
                </div>
                <div className="space-y-3 p-3.5">
                  <p className="text-[11px] leading-5 text-muted">{pendingOperation.summary}</p>
                  {pendingOperation.type === "status" ? (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-xl bg-[#f8f8f5] p-2.5">
                        <p className="text-[9px] font-bold uppercase text-muted">Estado actual</p>
                        <p className="mt-1 text-xs font-semibold text-ink">{displayValue(pendingOperation.before)}</p>
                      </div>
                      <div className="rounded-xl bg-[#edf4ec] p-2.5">
                        <p className="text-[9px] font-bold uppercase text-forest">Nuevo estado</p>
                        <p className="mt-1 text-xs font-semibold text-forest">{displayValue(pendingOperation.after)}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {pendingOperation.before && (
                        <div className="rounded-xl bg-[#f8f8f5] p-2.5">
                          <p className="mb-1 text-[9px] font-bold uppercase text-muted">Antes</p>
                          <p className="text-[10px] font-semibold text-ink">{pendingOperation.before.offerTitle}</p>
                          <p className="mt-1 text-[10px] leading-4 text-muted">{pendingOperation.before.personalizedMessage}</p>
                          <p className="mt-1 text-[10px] text-muted">Descuento: {pendingOperation.before.discountPct}%</p>
                        </div>
                      )}
                      <div className="rounded-xl border border-[#dce7dc] bg-[#f4f8f3] p-2.5">
                        <p className="mb-1 text-[9px] font-bold uppercase text-forest">{pendingOperation.before ? "Despues" : "Propuesta nueva"}</p>
                        <p className="text-[10px] font-semibold text-ink">{pendingOperation.after.offerTitle}</p>
                        <p className="mt-1 whitespace-pre-wrap text-[10px] leading-4 text-ink">{pendingOperation.after.personalizedMessage}</p>
                        <p className="mt-1 text-[10px] font-bold text-forest">Descuento: {pendingOperation.after.discountPct}%</p>
                      </div>
                    </div>
                  )}
                  <p className="text-[9px] text-muted">La propuesta caduca en 5 minutos. Nada se guarda hasta confirmar.</p>
                  <div className="flex gap-2">
                    <button type="button" onClick={() => void confirmOperation()} disabled={executing} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-forest px-3 py-2.5 text-[11px] font-bold text-white transition hover:bg-[#315b4b] disabled:opacity-50">
                      {executing ? <LoaderCircle size={14} className="animate-spin" /> : <Check size={14} />}
                      {executing ? "Guardando..." : "Confirmar y guardar"}
                    </button>
                    <button type="button" onClick={cancelOperation} disabled={executing} className="rounded-xl border border-line px-3 py-2.5 text-[11px] font-bold text-muted hover:bg-[#f7f8f5] disabled:opacity-50">Cancelar</button>
                  </div>
                </div>
              </div>
            )}

            {copyText && (
              <div className="ml-9 rounded-2xl border border-[#dce7dc] bg-white p-3.5 shadow-sm">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wide text-forest">Mensaje listo para copiar</p>
                <p className="whitespace-pre-wrap text-xs leading-5 text-ink">{copyText}</p>
                <button type="button" onClick={() => void copyMessage()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-forest px-3 py-2 text-[10px] font-bold text-white hover:bg-[#315b4b]">
                  {copied ? <Check size={13} /> : <Clipboard size={13} />}
                  {copied ? "Copiado" : "Copiar mensaje"}
                </button>
              </div>
            )}

            {sending && <div className="flex items-center gap-2 pl-9 text-[11px] text-muted"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c] [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c] [animation-delay:240ms]" /></span>Seren esta pensando...</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && !sending && !pendingOperation && (
            <div className="border-t border-line bg-white px-3.5 py-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-muted">Puedes preguntarme</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions[activeSection].map((prompt) => (
                  <button type="button" key={prompt} onClick={() => void sendMessage(prompt)} className="rounded-full border border-[#dce5dc] bg-[#f7faf6] px-2.5 py-1.5 text-left text-[10px] leading-4 text-forest transition hover:bg-[#eaf1e9]" disabled={sending || pendingOperation !== null}>{prompt}</button>
                ))}
              </div>
            </div>
          )}

          {error && <div role="alert" className="mx-3.5 mt-2 rounded-xl border border-[#edd4ce] bg-[#fbefeb] px-3 py-2 text-[10px] leading-4 text-[#a85543]">{error}</div>}

          <form onSubmit={handleSubmit} className="border-t border-line bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-[#f8f8f4] p-2 focus-within:border-[#9db39f]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={pendingOperation ? "Confirma o cancela la operacion..." : activeSection === "customers" && selectedCustomerKey === null ? "Pregunta o escribe el nombre/codigo del cliente..." : "Escribe tu pregunta..."}
                aria-label="Escribe tu pregunta para Seren"
                rows={1}
                maxLength={1500}
                disabled={pendingOperation !== null || executing}
                className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs leading-5 text-ink outline-none placeholder:text-muted disabled:opacity-50"
              />
              <button type="submit" disabled={!draft.trim() || sending || executing || pendingOperation !== null} aria-label="Enviar pregunta" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white transition hover:bg-[#315b4b] disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} /></button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[9px] text-muted">Las operaciones siempre requieren confirmacion. No se envian mensajes automaticamente.</p>
          </form>
        </section>
      )}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? "Cerrar asistente Seren" : "Abrir asistente Seren"}
        className="fixed bottom-5 right-5 z-[70] flex h-14 items-center gap-2 rounded-full bg-[#23483d] px-4 text-white shadow-[0_10px_35px_rgba(35,72,61,0.32)] transition hover:-translate-y-0.5 hover:bg-[#315b4b] sm:bottom-6 sm:right-6"
      >
        {open ? <X size={19} /> : <MessageCircle size={19} />}
        <span className="text-xs font-bold">Ayuda Seren</span>
      </button>
    </>
  );
}
