import { FormEvent, useState } from "react";
import { Activity, ArrowRight, LockKeyhole, Mail, Sparkles } from "lucide-react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { supabaseConfigured } from "../lib/supabase";

export function LoginPage() {
  const { session, signIn, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No fue posible iniciar sesion.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="login-shell">
      <div className="grid min-h-screen lg:grid-cols-[1.02fr_.98fr]">
        <section className="relative hidden overflow-hidden bg-[#203d34] px-12 py-14 text-white lg:flex lg:flex-col lg:justify-between xl:px-20">
          <div className="absolute -right-28 top-20 h-96 w-96 rounded-full border border-white/10" />
          <div className="absolute -right-10 top-36 h-72 w-72 rounded-full border border-white/10" />
          <div className="relative z-10 flex items-center gap-3">
            <div className="brand-mark brand-mark-light"><Sparkles size={19} /></div>
            <div><p className="font-display text-xl font-extrabold">seren<span className="text-[#d3b17e]">.</span></p><p className="text-[9px] uppercase tracking-[0.2em] text-white/45">Intelligence for care</p></div>
          </div>
          <div className="relative z-10 max-w-xl">
            <p className="mb-5 text-[10px] font-bold uppercase tracking-[0.24em] text-[#d7ba8e]">Customer retention intelligence</p>
            <h1 className="font-display text-5xl font-semibold leading-[1.12] tracking-tight xl:text-[58px]">Cada regreso empieza con una <span className="serif-italic text-[#d7ba8e]">señal.</span></h1>
            <p className="mt-7 max-w-md text-sm leading-7 text-white/60">Anticipa el abandono, comprende los habitos de tus clientes y convierte los datos en experiencias que invitan a volver.</p>
            <div className="mt-11 flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d7e5d8] text-forest"><Activity size={19} /></div>
              <div><p className="text-xs font-semibold">Inteligencia de retencion proactiva</p><p className="mt-1 text-[10px] text-white/45">Origen Spa · Fase Customers</p></div>
            </div>
          </div>
          <p className="relative z-10 text-[10px] text-white/35">SEREN AI · ORIGEN SPA · 2026</p>
        </section>
        <section className="flex items-center justify-center px-6 py-12 sm:px-10">
          <div className="w-full max-w-[390px]">
            <div className="mb-10 flex items-center gap-3 lg:hidden">
              <div className="brand-mark"><Sparkles size={18} /></div><span className="font-display text-xl font-extrabold text-ink">seren<span className="text-gold">.</span></span>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-forest/65">Bienvenido de nuevo</p>
            <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink">Inicia sesion</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Accede al centro de inteligencia y retencion de Origen Spa.</p>

            {!supabaseConfigured && <div className="mt-6 rounded-xl border border-[#e9d8b7] bg-[#fbf6e9] p-4 text-xs leading-5 text-[#80633b]">Falta configurar <b>VITE_SUPABASE_URL</b> y <b>VITE_SUPABASE_ANON_KEY</b> en el entorno del frontend.</div>}

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink">Correo electronico</span>
                <span className="relative block"><Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control pl-11" type="email" autoComplete="email" placeholder="tu@origenspa.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></span>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold text-ink">Contrasena</span>
                <span className="relative block"><LockKeyhole size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted" /><input className="input-control pl-11" type="password" autoComplete="current-password" placeholder="Ingresa tu contrasena" value={password} onChange={(event) => setPassword(event.target.value)} required /></span>
              </label>
              {error && <p className="rounded-xl bg-[#fbefec] px-4 py-3 text-xs leading-5 text-[#a65342]">{error}</p>}
              <button className="primary-button w-full" disabled={submitting || !supabaseConfigured}>
                {submitting ? "Ingresando..." : "Entrar a Seren AI"} <ArrowRight size={16} />
              </button>
            </form>
            <div className="mt-8 border-t border-line pt-6">
              <p className="text-center text-[11px] leading-5 text-muted">Acceso protegido mediante Supabase Auth.<br />Si aun no tienes usuario, el administrador debe crearlo en Supabase.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
