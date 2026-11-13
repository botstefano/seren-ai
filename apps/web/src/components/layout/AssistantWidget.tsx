import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import { Bot, MessageCircle, RotateCcw, Send, Sparkles, X } from "lucide-react";
import { api } from "../../lib/api";

type Message = { role: "user" | "assistant"; content: string };

type ChatResponse = { answer: string; section: string; model: string };

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
  customers: "Estas en Customers. Puedo explicarte los segmentos, la frecuencia de compra, los filtros y el alcance de esta cartera recurrente.",
  churn: "Estas en Riesgo de churn. Puedo explicarte el indice de demora, las reglas de clasificacion y como priorizar el seguimiento.",
  agent: "Estas en Agente Seren. Puedo explicarte como se generan los lotes de Groq, que significa cada propuesta y como funciona la aprobacion humana.",
  campaigns: "Estas en Reactivaciones. Puedo ayudarte a interpretar los estados, los contadores y el historial de seguimiento.",
  reports: "Estas en Reportes BI. Puedo ayudarte a leer los graficos, comparar segmentos y entender los indicadores de compras recurrentes.",
  settings: "Estas en Configuracion. Puedo explicarte las conexiones, la autenticacion, la seguridad y el estado de los servicios.",
};

const suggestions: Record<string, string[]> = {
  overview: ["¿Como interpreto la tasa de churn?", "¿Que indicador deberia revisar primero?", "¿Como se calcula la recompra?"],
  customers: ["¿Que diferencia hay entre VIP y Frecuente?", "¿Como se calcula la frecuencia?", "¿Por que se excluye a los Payers de una compra?"],
  churn: ["¿Como se calcula el indice de demora?", "¿Que diferencia hay entre riesgo alto y moderado?", "¿El indice es una probabilidad de abandono?"],
  agent: ["¿Como se generan los lotes de 20?", "¿Que ocurre al aprobar todas las propuestas?", "¿Groq decide el nivel de riesgo?"],
  campaigns: ["¿Que significa cada estado?", "¿Como se calcula la tasa de reactivacion?", "¿Un mensaje se envia automaticamente?"],
  reports: ["¿Que mide la frecuencia por segmento?", "¿Por que los importes son recurrentes?", "¿Como interpreto la evolucion mensual?"],
  settings: ["¿Como se protege la clave de Supabase?", "¿Que servicios utiliza Seren AI?", "¿Que pasa si Groq no esta configurado?"],
};

export function AssistantWidget({ section }: { section: string }) {
  const activeSection = sectionLabels[section] ? section : "overview";
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([{ role: "assistant", content: greetings[activeSection] }]);
    }
  }, [open, activeSection, messages.length]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending, open]);

  async function sendMessage(value = draft) {
    const question = value.trim();
    if (!question || sending) return;

    const nextMessages: Message[] = [...messages, { role: "user", content: question }];
    setMessages(nextMessages);
    setDraft("");
    setError("");
    setSending(true);
    try {
      const result = await api<ChatResponse>("/assistant/chat", {
        method: "POST",
        body: JSON.stringify({ section: activeSection, messages: nextMessages.slice(-10) }),
      });
      setMessages((current) => [...current, { role: "assistant", content: result.answer }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo consultar a Seren. Intentalo nuevamente.");
    } finally {
      setSending(false);
    }
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
    setMessages([{ role: "assistant", content: greetings[activeSection] }]);
  }

  return (
    <>
      {open && (
        <section
          aria-label="Asistente contextual Seren"
          className="fixed bottom-[92px] right-4 z-[70] flex h-[min(620px,calc(100vh-8rem))] w-[min(390px,calc(100vw-2rem))] flex-col overflow-hidden rounded-3xl border border-line bg-white shadow-[0_24px_80px_rgba(27,47,39,0.22)] sm:bottom-24 sm:right-6"
        >
          <header className="flex items-center justify-between bg-[#23483d] px-4 py-4 text-white">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-[#e7d7b8]"><Sparkles size={19} /></div>
              <div className="min-w-0">
                <p className="font-display text-sm font-bold">Seren · Asistente</p>
                <p className="mt-0.5 truncate text-[10px] text-white/65">Ayuda contextual · {sectionLabels[activeSection]}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button type="button" onClick={resetConversation} aria-label="Reiniciar conversacion" title="Reiniciar conversacion" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"><RotateCcw size={15} /></button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar asistente" className="rounded-xl p-2 text-white/70 transition hover:bg-white/10 hover:text-white"><X size={17} /></button>
            </div>
          </header>

          <div className="flex items-center gap-2 border-b border-line bg-[#f8f8f4] px-4 py-2.5">
            <span className="h-2 w-2 rounded-full bg-[#71927c]" />
            <p className="text-[10px] text-muted">Contexto activo: <b className="text-ink">{sectionLabels[activeSection]}</b></p>
            <span className="ml-auto rounded-full bg-[#e8efe8] px-2 py-1 text-[9px] font-bold text-forest">Solo consulta</span>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-[#fbfcf9] px-3.5 py-4">
            {messages.map((message, index) => (
              <div key={index} className={"flex " + (message.role === "user" ? "justify-end" : "justify-start")}>
                {message.role === "assistant" && <div className="mr-2 mt-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-xl bg-[#e9f0e9] text-forest"><Bot size={15} /></div>}
                <div className={"max-w-[84%] rounded-2xl px-3.5 py-3 text-xs leading-5 " + (message.role === "user" ? "rounded-br-md bg-[#23483d] text-white" : "rounded-bl-md border border-line bg-white text-ink shadow-sm")}>
                  <p className="whitespace-pre-wrap break-words">{message.content}</p>
                </div>
              </div>
            ))}
            {sending && <div className="flex items-center gap-2 pl-9 text-[11px] text-muted"><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c] [animation-delay:120ms]" /><i className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#71927c] [animation-delay:240ms]" /></span>Seren esta pensando...</div>}
            <div ref={bottomRef} />
          </div>

          {messages.length <= 1 && !sending && (
            <div className="border-t border-line bg-white px-3.5 py-3">
              <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.13em] text-muted">Puedes preguntarme</p>
              <div className="flex flex-wrap gap-1.5">
                {suggestions[activeSection].map((prompt) => (
                  <button type="button" key={prompt} onClick={() => void sendMessage(prompt)} className="rounded-full border border-[#dce5dc] bg-[#f7faf6] px-2.5 py-1.5 text-left text-[10px] leading-4 text-forest transition hover:bg-[#eaf1e9]" disabled={sending}>{prompt}</button>
                ))}
              </div>
            </div>
          )}

          {error && <div role="alert" className="mx-3.5 mt-2 rounded-xl border border-[#edd4ce] bg-[#fbefeb] px-3 py-2 text-[10px] leading-4 text-[#a85543]">{error}<button type="button" onClick={() => void sendMessage(messages[messages.length - 1]?.content ?? "")} className="ml-2 font-bold underline">Reintentar</button></div>}

          <form onSubmit={handleSubmit} className="border-t border-line bg-white p-3">
            <div className="flex items-end gap-2 rounded-2xl border border-line bg-[#f8f8f4] p-2 focus-within:border-[#9db39f]">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Escribe tu pregunta..."
                aria-label="Escribe tu pregunta para Seren"
                rows={1}
                maxLength={1500}
                className="max-h-24 min-h-9 flex-1 resize-none bg-transparent px-2 py-2 text-xs leading-5 text-ink outline-none placeholder:text-muted"
              />
              <button type="submit" disabled={!draft.trim() || sending} aria-label="Enviar pregunta" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-forest text-white transition hover:bg-[#315b4b] disabled:cursor-not-allowed disabled:opacity-40"><Send size={15} /></button>
            </div>
            <p className="mt-1.5 px-1 text-center text-[9px] text-muted">No comparte identificadores de clientes ni modifica datos. Enter para enviar · Shift + Enter para nueva linea.</p>
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
