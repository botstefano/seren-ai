import {
  ArrowRight,
  ArrowUpRight,
  Flower2,
  HeartHandshake,
  HandHeart,
  Leaf,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export function PublicHomePage() {
  const { session } = useAuth();
  const staffPath = session ? "/staff" : "/login";

  return (
    <div className="min-h-screen overflow-hidden bg-[#f7f6f0] text-[#203d34]">
      <div className="bg-[#203d34] px-5 py-2 text-center text-[10px] font-medium tracking-[0.16em] text-white/75 sm:text-[11px]">
        ORIGEN SPA <span className="px-2 text-[#d7ba8e]">·</span> UN ESPACIO PARA TU BIENESTAR
      </div>

      <header className="sticky top-0 z-30 border-b border-[#e8e7df] bg-[#f7f6f0]/95 backdrop-blur-xl">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center justify-between px-5 sm:px-8 lg:px-12">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Origen Spa, inicio">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#203d34] text-[#e1c99f] shadow-[0_8px_22px_rgba(32,61,52,.16)]">
              <Flower2 size={21} strokeWidth={1.6} />
            </div>
            <div>
              <p className="font-display text-[19px] font-extrabold tracking-[0.08em] text-[#203d34]">ORIGEN SPA</p>
              <p className="mt-0.5 text-[8px] font-semibold uppercase tracking-[0.23em] text-[#8c9388]">Cuidado · Equilibrio · Bienestar</p>
            </div>
          </a>

          <nav className="hidden items-center gap-8 md:flex" aria-label="Navegación principal">
            <a href="#inicio" className="text-[11px] font-semibold text-[#53635a] transition hover:text-[#b28d59]">Inicio</a>
            <a href="#servicios" className="text-[11px] font-semibold text-[#53635a] transition hover:text-[#b28d59]">Servicios</a>
            <a href="#mi-experiencia" className="text-[11px] font-semibold text-[#53635a] transition hover:text-[#b28d59]">Mi experiencia</a>
            <a href="#experiencia" className="text-[11px] font-semibold text-[#53635a] transition hover:text-[#b28d59]">Nuestra esencia</a>
          </nav>

          <Link
            to={staffPath}
            className="inline-flex items-center gap-2 rounded-full border border-[#cfd8cd] bg-white px-4 py-2.5 text-[10px] font-bold text-[#29483d] shadow-sm transition hover:-translate-y-0.5 hover:border-[#9fb3a0] hover:bg-[#f0f4ee] sm:px-5 sm:text-[11px]"
          >
            <ShieldCheck size={15} />
            <span>Solo staff</span>
            <ArrowUpRight size={13} className="text-[#a88a5c]" />
          </Link>
        </div>
      </header>

      <main>
        <section id="inicio" className="relative isolate">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_78%_25%,rgba(214,197,162,.34),transparent_27%),linear-gradient(120deg,#f7f6f0_0%,#f4f0e6_56%,#e7ece3_100%)]" />
          <div className="mx-auto grid min-h-[620px] max-w-[1440px] items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:px-12 lg:py-20">
            <div className="max-w-[660px]">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#d9dfd4] bg-white/70 px-4 py-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[#a88a5c]" />
                <span className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#65766a]">Un momento para volver a ti</span>
              </div>
              <h1 className="font-display text-[42px] font-semibold leading-[1.08] tracking-[-0.045em] text-[#203d34] sm:text-6xl lg:text-[68px]">
                Tu bienestar merece un lugar <span className="serif-italic text-[#a88a5c]">especial.</span>
              </h1>
              <p className="mt-7 max-w-[520px] text-[14px] leading-7 text-[#657168] sm:text-[15px]">
                Descubre Origen Spa: un espacio dedicado al cuidado personal, la tranquilidad y esos momentos que hacen bien.
              </p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <a href="#servicios" className="inline-flex items-center gap-3 rounded-full bg-[#203d34] px-6 py-3.5 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(32,61,52,.17)] transition hover:-translate-y-0.5 hover:bg-[#315649]">
                  Explorar servicios <ArrowRight size={15} />
                </a>
                <a href="#mi-experiencia" className="inline-flex items-center gap-2 rounded-full px-5 py-3.5 text-[11px] font-bold text-[#53635a] transition hover:bg-white/70">
                  Estoy en Origen Spa <HandHeart size={14} />
                </a>
              </div>
              <div className="mt-12 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[#dfe1d8] pt-7">
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#6c796e]">
                  <Leaf size={15} className="text-[#a88a5c]" /> Cuidado personal
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#6c796e]">
                  <HeartHandshake size={15} className="text-[#a88a5c]" /> Atención cercana
                </div>
                <div className="flex items-center gap-2 text-[10px] font-semibold text-[#6c796e]">
                  <Sparkles size={15} className="text-[#a88a5c]" /> Momentos de bienestar
                </div>
              </div>
            </div>

            <div className="relative mx-auto w-full max-w-[560px]">
              <div className="absolute -right-7 -top-8 h-32 w-32 rounded-full border border-[#c9c5ae]/70" />
              <div className="absolute -bottom-8 -left-7 h-40 w-40 rounded-full border border-[#c9c5ae]/70" />
              <div className="relative min-h-[420px] overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(145deg,#dce5d9_0%,#bccdbd_48%,#8fa99b_100%)] p-7 shadow-[0_28px_70px_rgba(41,67,55,.16)] sm:min-h-[485px] sm:p-10">
                <div className="absolute -right-16 top-4 h-72 w-72 rounded-full border border-white/30" />
                <div className="absolute -right-3 top-16 h-56 w-56 rounded-full border border-white/25" />
                <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-[#e8ddc7]/45 blur-[1px]" />
                <div className="absolute bottom-8 left-8 right-8 top-8 rounded-[26px] border border-white/30" />
                <div className="relative flex min-h-[365px] flex-col justify-between sm:min-h-[405px]">
                  <div className="flex items-start justify-between">
                    <div className="rounded-full border border-white/40 bg-white/20 px-4 py-2 text-[9px] font-bold uppercase tracking-[0.18em] text-[#29483d] backdrop-blur">
                      Origen · Tu espacio
                    </div>
                    <Flower2 size={31} strokeWidth={1.1} className="text-[#f6f0e4]" />
                  </div>
                  <div className="mx-auto my-7 flex h-48 w-48 items-center justify-center rounded-full border border-white/35 bg-[radial-gradient(circle_at_35%_30%,rgba(255,255,255,.8),rgba(255,255,255,.08)_68%)] shadow-[0_20px_55px_rgba(36,65,52,.12)] sm:h-56 sm:w-56">
                    <div className="flex h-36 w-36 items-center justify-center rounded-full border border-white/45 bg-[#f4efe4]/70 sm:h-44 sm:w-44">
                      <Leaf size={76} strokeWidth={0.8} className="rotate-[-25deg] text-[#547363]" />
                    </div>
                  </div>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="font-display text-3xl font-semibold tracking-tight text-[#203d34] sm:text-4xl">Respira.</p>
                      <p className="mt-1 font-display text-2xl italic text-[#f8f4e9] sm:text-3xl">Reconecta.</p>
                    </div>
                    <div className="rounded-2xl border border-white/40 bg-white/25 p-3 text-[#29483d] backdrop-blur">
                      <Sparkles size={24} strokeWidth={1.3} />
                    </div>
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-5 right-5 rounded-2xl border border-[#e8e3d5] bg-[#fbfaf6] px-5 py-3 shadow-[0_12px_30px_rgba(32,61,52,.09)] sm:right-[-18px]">
                <p className="text-[8px] font-bold uppercase tracking-[0.18em] text-[#9a8968]">Tu tiempo importa</p>
                <p className="mt-1 font-display text-sm font-semibold text-[#29483d]">Haz espacio para ti</p>
              </div>
            </div>
          </div>
        </section>

        <section id="mi-experiencia" className="scroll-mt-24 bg-[#e9eee7] px-5 py-16 sm:px-8 lg:px-12 lg:py-20">
          <div className="mx-auto grid max-w-[1180px] items-center gap-8 rounded-[30px] border border-white/80 bg-[#f9faf6] p-7 shadow-[0_18px_50px_rgba(32,61,52,.06)] sm:p-10 lg:grid-cols-[1fr_auto] lg:gap-12 lg:p-12">
            <div className="max-w-[680px]">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#e9f0e8] px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.16em] text-[#52705e]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#7d9b83]" />
                Para quienes ya están en el spa
              </div>
              <h2 className="mt-5 font-display text-3xl font-semibold tracking-tight text-[#203d34] sm:text-4xl">Tu momento también tiene su espacio.</h2>
              <p className="mt-4 text-[12px] leading-7 text-[#6d796f] sm:text-[13px]">
                Mientras recibes tu atención, utiliza esta experiencia desde tu celular para comunicar una preferencia al profesional o tomarte una pausa guiada de un minuto.
              </p>
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-semibold text-[#627267]">
                <span className="inline-flex items-center gap-1.5"><HandHeart size={14} className="text-[#a88a5c]" /> Comunica cómo te sientes</span>
                <span className="inline-flex items-center gap-1.5"><Sparkles size={14} className="text-[#a88a5c]" /> Tómate un momento de calma</span>
              </div>
            </div>
            <Link to="/experiencia" className="inline-flex items-center justify-center gap-3 rounded-full bg-[#203d34] px-7 py-4 text-[11px] font-bold text-white shadow-[0_10px_24px_rgba(32,61,52,.15)] transition hover:-translate-y-0.5 hover:bg-[#315649]">
              Abrir mi experiencia <ArrowRight size={15} />
            </Link>
          </div>
          <p className="mx-auto mt-4 max-w-[1180px] text-center text-[9px] text-[#7d887e]">
            No necesitas registrarte ni realizar una compra para usar esta función.
          </p>
        </section>

        <section id="servicios" className="scroll-mt-24 bg-[#fbfaf6] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto max-w-[1280px]">
            <div className="mx-auto max-w-[650px] text-center">
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#a88a5c]">Nuestros servicios</p>
              <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-[#203d34] sm:text-5xl">Cuidado pensado para ti.</h2>
              <p className="mt-5 text-[13px] leading-7 text-[#788078]">
                Conoce las distintas experiencias de cuidado y bienestar de Origen Spa. Nuestro equipo puede orientarte para encontrar la opción adecuada para ti.
              </p>
            </div>

            <div className="mt-12 grid gap-5 md:grid-cols-3">
              <article className="group rounded-[26px] border border-[#e8e8df] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(32,61,52,.08)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf2eb] text-[#557462] transition group-hover:bg-[#203d34] group-hover:text-white">
                  <Flower2 size={25} strokeWidth={1.5} />
                </div>
                <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a88a5c]">Cuidado personal</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[#29483d]">Cuidado facial</h3>
                <p className="mt-3 text-[12px] leading-6 text-[#7b837b]">Opciones pensadas para acompañar el cuidado y la vitalidad de tu piel.</p>
                <div className="mt-7 h-px bg-[#edf0e9]" />
                <p className="mt-4 text-[10px] font-semibold text-[#64756a]">Conoce las opciones disponibles</p>
              </article>

              <article className="group rounded-[26px] border border-[#e8e8df] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(32,61,52,.08)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f3eee4] text-[#a88a5c] transition group-hover:bg-[#203d34] group-hover:text-white">
                  <Leaf size={25} strokeWidth={1.5} />
                </div>
                <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a88a5c]">Bienestar integral</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[#29483d]">Cuidado corporal</h3>
                <p className="mt-3 text-[12px] leading-6 text-[#7b837b]">Experiencias para dedicar tiempo a tu cuerpo y reconectar con tu bienestar.</p>
                <div className="mt-7 h-px bg-[#edf0e9]" />
                <p className="mt-4 text-[10px] font-semibold text-[#64756a]">Conoce las opciones disponibles</p>
              </article>

              <article className="group rounded-[26px] border border-[#e8e8df] bg-white p-7 transition duration-300 hover:-translate-y-1 hover:shadow-[0_18px_38px_rgba(32,61,52,.08)] sm:p-8">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf0f2] text-[#55717a] transition group-hover:bg-[#203d34] group-hover:text-white">
                  <HeartHandshake size={25} strokeWidth={1.5} />
                </div>
                <p className="mt-7 text-[9px] font-bold uppercase tracking-[0.18em] text-[#a88a5c]">Tiempo para ti</p>
                <h3 className="mt-2 font-display text-2xl font-semibold text-[#29483d]">Relajación</h3>
                <p className="mt-3 text-[12px] leading-6 text-[#7b837b]">Momentos de pausa que invitan a bajar el ritmo y renovar energía.</p>
                <div className="mt-7 h-px bg-[#edf0e9]" />
                <p className="mt-4 text-[10px] font-semibold text-[#64756a]">Conoce las opciones disponibles</p>
              </article>
            </div>
          </div>
        </section>

        <section id="experiencia" className="scroll-mt-24 bg-[#e9eee7] px-5 py-20 sm:px-8 lg:px-12 lg:py-24">
          <div className="mx-auto grid max-w-[1280px] items-center gap-12 lg:grid-cols-[.9fr_1.1fr]">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-[#a1855b]">Nuestra esencia</p>
              <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight text-[#203d34] sm:text-5xl">Un espacio donde el cuidado empieza por escucharte.</h2>
              <p className="mt-6 max-w-[510px] text-[13px] leading-7 text-[#6d796f]">
                En Origen Spa creemos que dedicarte tiempo también es una forma de cuidarte. Queremos acompañarte con una atención cálida y una experiencia pensada alrededor de tu bienestar.
              </p>
              <a href="#servicios" className="mt-8 inline-flex items-center gap-2 text-[11px] font-bold text-[#315649] transition hover:gap-3">
                Descubre nuestros servicios <ArrowRight size={15} />
              </a>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-[26px] bg-[#203d34] p-7 text-white sm:mt-10 sm:p-9">
                <Leaf size={27} className="text-[#d7ba8e]" strokeWidth={1.4} />
                <p className="mt-8 font-display text-2xl font-semibold">Cercanía</p>
                <p className="mt-3 text-[11px] leading-6 text-white/60">Una experiencia amable, humana y enfocada en tus necesidades.</p>
              </div>
              <div className="rounded-[26px] border border-white bg-[#f9f8f2] p-7 sm:p-9">
                <Sparkles size={27} className="text-[#a88a5c]" strokeWidth={1.4} />
                <p className="mt-8 font-display text-2xl font-semibold text-[#29483d]">Bienestar</p>
                <p className="mt-3 text-[11px] leading-6 text-[#7b837b]">Pequeños momentos para reconectar contigo y sentirte bien.</p>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-[#203d34] px-5 py-10 text-white sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-[1280px] flex-col justify-between gap-8 sm:flex-row sm:items-center">
          <div>
            <p className="font-display text-xl font-extrabold tracking-[0.08em]">ORIGEN SPA</p>
            <p className="mt-2 text-[10px] tracking-wide text-white/45">Cuidado, equilibrio y bienestar.</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <Link to={staffPath} className="inline-flex items-center gap-2 text-[10px] font-semibold text-white/75 transition hover:text-[#e2c99e]">
              <ShieldCheck size={14} /> Solo staff <ArrowUpRight size={12} />
            </Link>
            <p className="text-[9px] text-white/35">© Origen Spa · Todos los derechos reservados</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
