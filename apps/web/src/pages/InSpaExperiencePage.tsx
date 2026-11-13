import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Clipboard,
  HandHeart,
  Heart,
  MessageCircle,
  Pause,
  Play,
  RotateCcw,
  Snowflake,
  Sparkles,
  Sun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { Link } from "react-router-dom";

type ComfortRequest = {
  id: string;
  title: string;
  message: string;
  detail: string;
  Icon: LucideIcon;
};

const comfortRequests: ComfortRequest[] = [
  { id: "pause", title: "Necesito una pausa", message: "¿Podemos hacer una pausa breve, por favor?", detail: "Para detener el procedimiento un momento.", Icon: Pause },
  { id: "cold", title: "Tengo frío", message: "¿Podrían ayudarme a estar un poco más abrigado/a, por favor?", detail: "Para ajustar tu comodidad durante la atención.", Icon: Snowflake },
  { id: "warm", title: "Tengo calor", message: "¿Podrían ayudarme a sentirme un poco más fresco/a, por favor?", detail: "Para ajustar la temperatura o ventilación.", Icon: Sun },
  { id: "pressure", title: "Ajustar la intensidad", message: "¿Podrían ajustar la intensidad o presión, por favor?", detail: "Cuando quieras que el profesional haga un ajuste.", Icon: HandHeart },
  { id: "question", title: "Quiero hacer una consulta", message: "Tengo una consulta sobre el procedimiento. ¿Podrían explicármelo?", detail: "Para pedir una explicación en cualquier momento.", Icon: MessageCircle },
  { id: "help", title: "Necesito asistencia", message: "¿Podrían acercarse un momento, por favor?", detail: "Para llamar la atención del profesional.", Icon: Heart },
];

export function InSpaExperiencePage() {
  const [selectedRequest, setSelectedRequest] = useState<ComfortRequest | null>(null);
  const [customRequest, setCustomRequest] = useState("");
  const [customMessage, setCustomMessage] = useState("");
  const [copyState, setCopyState] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(60);
  const [isBreathing, setIsBreathing] = useState(false);

  useEffect(() => {
    if (!isBreathing) return;
    if (secondsLeft <= 0) {
      setIsBreathing(false);
      return;
    }
    const timer = window.setTimeout(() => setSecondsLeft((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [isBreathing, secondsLeft]);

  const breathingPhase = useMemo(() => {
    const phase = (60 - secondsLeft) % 12;
    if (phase < 4) return { label: "Inhala suavemente", hint: "Toma aire con calma", scale: "scale-110" };
    if (phase < 6) return { label: "Mantén un instante", hint: "Sin forzar la respiración", scale: "scale-110" };
    return { label: "Exhala lentamente", hint: "Suelta el aire a tu ritmo", scale: "scale-95" };
  }, [secondsLeft]);

  const activeMessage = selectedRequest?.message ?? customMessage;

  async function copyMessage() {
    if (!activeMessage) return;
    try {
      await navigator.clipboard.writeText(activeMessage);
      setCopyState("Mensaje copiado");
    } catch {
      setCopyState("Puedes mostrar este mensaje directamente en la pantalla");
    }
  }

  function startBreathing() {
    if (secondsLeft <= 0) setSecondsLeft(60);
    setIsBreathing(true);
  }

  function resetBreathing() {
    setIsBreathing(false);
    setSecondsLeft(60);
  }

  function chooseRequest(request: ComfortRequest) {
    setSelectedRequest(request);
    setCustomMessage("");
    setCopyState("");
  }

  function showCustomRequest() {
    const message = customRequest.trim();
    if (message.length < 3) return;
    setSelectedRequest(null);
    setCustomMessage(message);
    setCustomRequest("");
    setCopyState("");
  }

  return (
    <div className="min-h-screen bg-[#f7f6f0] text-[#203d34]">
      <header className="border-b border-[#e8e7df] bg-white/80 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-2 text-[11px] font-semibold text-[#647267] transition hover:text-[#203d34]">
            <ArrowLeft size={15} /> Volver a Origen Spa
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-[#29483d]">
            <Sparkles size={16} className="text-[#a88a5c]" /> ORIGEN SPA
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-5 py-9 sm:px-8 sm:py-14">
        <div className="mx-auto max-w-[700px] text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#e7eee5] text-[#52705e]">
            <HandHeart size={27} strokeWidth={1.5} />
          </div>
          <p className="mt-5 text-[9px] font-bold uppercase tracking-[0.23em] text-[#a88a5c]">Tu visita · Tu comodidad</p>
          <h1 className="mt-3 font-display text-3xl font-semibold tracking-tight text-[#203d34] sm:text-5xl">Este momento es para ti.</h1>
          <p className="mt-5 text-[13px] leading-7 text-[#758076] sm:text-sm">
            Utiliza esta pantalla mientras recibes tu atención. Puedes comunicar una preferencia al profesional o disfrutar de una breve pausa guiada.
          </p>
        </div>

        <div className="mt-10 grid items-start gap-6 lg:grid-cols-[1.08fr_.92fr]">
          <section className="rounded-[28px] border border-[#e6e8df] bg-white p-6 shadow-[0_16px_44px_rgba(32,61,52,.05)] sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#f3eee4] text-[#a88a5c]">
                <MessageCircle size={20} />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-[#29483d]">¿Cómo podemos hacerte sentir más cómodo/a?</h2>
                <p className="mt-2 text-[11px] leading-5 text-[#7b837b]">
                  Elige una opción. Mostraremos un mensaje claro para que puedas enseñárselo al profesional que te atiende.
                </p>
              </div>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {comfortRequests.map((request) => {
                const Icon = request.Icon;
                return (
                  <button
                    key={request.id}
                    type="button"
                    onClick={() => chooseRequest(request)}
                    aria-pressed={selectedRequest?.id === request.id}
                    className={"flex min-h-[94px] items-center gap-3 rounded-2xl border p-4 text-left transition " + (selectedRequest?.id === request.id ? "border-[#789681] bg-[#edf3ec] ring-2 ring-[#dce8dc]" : "border-[#e8ebe4] bg-[#fcfcf9] hover:border-[#b8c8b7] hover:bg-[#f5f8f3]")}
                  >
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-[#587563] shadow-sm">
                      <Icon size={18} />
                    </span>
                    <span>
                      <span className="block text-[11px] font-bold text-[#29483d]">{request.title}</span>
                      <span className="mt-1 block text-[9px] leading-4 text-[#818a80]">{request.detail}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="mt-6 rounded-2xl border border-dashed border-[#d7ded4] bg-[#fafbf7] p-4">
              <label htmlFor="custom-request" className="mb-2 block text-[10px] font-bold text-[#52675a]">Quiero comunicar otra cosa</label>
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  id="custom-request"
                  value={customRequest}
                  onChange={(event) => setCustomRequest(event.target.value)}
                  onKeyDown={(event) => { if (event.key === "Enter") showCustomRequest(); }}
                  maxLength={140}
                  placeholder="Escribe un mensaje breve..."
                  className="h-11 min-w-0 flex-1 rounded-xl border border-[#e2e7df] bg-white px-3 text-[11px] text-[#29483d] outline-none placeholder:text-[#a3aaa2] focus:border-[#8aa993] focus:ring-2 focus:ring-[#e5eee4]"
                />
                <button
                  type="button"
                  disabled={customRequest.trim().length < 3}
                  onClick={showCustomRequest}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#203d34] px-4 text-[10px] font-bold text-white transition hover:bg-[#315649] disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Mostrar mensaje <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {(selectedRequest || customMessage) && (
              <div aria-live="polite" className="mt-6 rounded-2xl border border-[#d4e0d2] bg-[#edf4ec] p-5">
                <p className="text-[9px] font-bold uppercase tracking-[0.17em] text-[#69816d]">Muestra este mensaje al profesional</p>
                <p className="mt-3 font-display text-xl font-semibold leading-snug text-[#29483d]">
                  “{activeMessage}”
                </p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button type="button" onClick={() => void copyMessage()} className="inline-flex items-center gap-2 rounded-xl border border-[#cdd9ce] bg-white px-3 py-2 text-[10px] font-bold text-[#365b49] transition hover:bg-[#f7faf5]">
                    {copyState === "Mensaje copiado" ? <Check size={14} /> : <Clipboard size={14} />}
                    {copyState === "Mensaje copiado" ? "Copiado" : "Copiar mensaje"}
                  </button>
                  <button type="button" onClick={() => { setSelectedRequest(null); setCustomMessage(""); setCopyState(""); }} className="text-[10px] font-semibold text-[#728074] hover:text-[#29483d]">
                    Cerrar
                  </button>
                  {copyState && <span className="text-[9px] text-[#6e816f]">{copyState}</span>}
                </div>
              </div>
            )}

            <p className="mt-5 text-[9px] leading-5 text-[#899188]">
              Esta función no envía notificaciones al personal. Muestra el mensaje en tu pantalla para que puedas compartirlo directamente con quien te atiende.
            </p>
          </section>

          <section className="rounded-[28px] border border-[#e6e8df] bg-[#e9eee7] p-6 sm:p-8">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white text-[#587563]">
                <Wind size={21} />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold text-[#29483d]">Un minuto para respirar</h2>
                <p className="mt-2 text-[11px] leading-5 text-[#748076]">
                  Una pausa sencilla para bajar el ritmo mientras disfrutas tu momento.
                </p>
              </div>
            </div>

            <div className="my-8 flex flex-col items-center text-center">
              <div className={"flex h-48 w-48 items-center justify-center rounded-full border border-white/80 bg-[radial-gradient(circle_at_35%_30%,#fff,rgba(255,255,255,.2)_72%)] shadow-[0_15px_40px_rgba(41,67,55,.08)] transition-transform duration-1000 " + (isBreathing ? breathingPhase.scale : "scale-100")}>
                <div className="flex h-36 w-36 flex-col items-center justify-center rounded-full border border-[#cbd8c9] bg-[#f6f7f1]/90">
                  <span className="font-display text-3xl font-semibold tabular-nums text-[#29483d]">{"0:" + String(secondsLeft).padStart(2, "0")}</span>
                  <span className="mt-1 text-[8px] font-bold uppercase tracking-[0.16em] text-[#879487]">Tu pausa</span>
                </div>
              </div>
              <p aria-live="polite" className="mt-6 font-display text-lg font-semibold text-[#365b49]">
                {isBreathing ? breathingPhase.label : secondsLeft === 0 ? "Pausa completada" : "Cuando estés listo/a"}
              </p>
              <p className="mt-1 text-[10px] text-[#7d897e]">
                {isBreathing ? breathingPhase.hint : secondsLeft === 0 ? "Puedes volver a iniciar cuando quieras." : "No fuerces la respiración; sigue tu propio ritmo."}
              </p>
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {!isBreathing ? (
                <button type="button" onClick={startBreathing} className="inline-flex items-center gap-2 rounded-full bg-[#203d34] px-5 py-3 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#315649]">
                  <Play size={14} /> {secondsLeft === 0 ? "Repetir pausa" : "Comenzar pausa"}
                </button>
              ) : (
                <button type="button" onClick={() => setIsBreathing(false)} className="inline-flex items-center gap-2 rounded-full bg-[#203d34] px-5 py-3 text-[10px] font-bold text-white shadow-sm transition hover:bg-[#315649]">
                  <Pause size={14} /> Pausar
                </button>
              )}
              <button type="button" onClick={resetBreathing} className="inline-flex items-center gap-2 rounded-full border border-[#cbd7c9] bg-white/80 px-4 py-3 text-[10px] font-bold text-[#587563] transition hover:bg-white">
                <RotateCcw size={13} /> Reiniciar
              </button>
            </div>
            <div className="mt-7 flex items-center justify-center gap-2 text-[9px] text-[#829083]">
              <Heart size={12} /> Hazlo solo si te resulta cómodo.
            </div>
          </section>
        </div>

        <div className="mx-auto mt-7 max-w-[760px] rounded-2xl border border-[#e7e8df] bg-white/75 px-5 py-4 text-center">
          <p className="text-[10px] font-semibold text-[#56695c]">Tu profesional sigue siendo quien guía tu tratamiento.</p>
          <p className="mt-1 text-[9px] leading-5 text-[#879087]">Esta página es un apoyo de comodidad y comunicación; no sustituye las indicaciones del personal ni las instrucciones específicas del servicio.</p>
        </div>
      </main>

      <footer className="border-t border-[#e8e7df] bg-white/70 px-5 py-6 text-center text-[9px] text-[#889188]">
        ORIGEN SPA · Tu bienestar, a tu ritmo.
        <div className="mt-2"><Link to="/" className="font-semibold text-[#5c7563] hover:text-[#203d34]">Volver a la página principal</Link></div>
      </footer>
    </div>
  );
}
