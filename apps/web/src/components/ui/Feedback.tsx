import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Cargando informacion..." }: { label?: string }) {
  return <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted"><LoaderCircle className="animate-spin text-forest" size={18} />{label}</div>;
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-[#edd8d1] bg-[#fbf1ed] p-5">
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 text-[#ad604e]" size={18} />
        <div>
          <p className="text-sm font-semibold text-ink">No se pudo cargar la informacion</p>
          <p className="mt-1 text-xs leading-5 text-muted">{message}</p>
          {onRetry && <button className="mt-3 text-xs font-bold text-forest underline underline-offset-4" onClick={onRetry}>Intentar nuevamente</button>}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ title, description }: { title: string; description: string }) {
  return <div className="rounded-2xl border border-dashed border-line bg-white/60 px-5 py-12 text-center"><p className="font-display text-sm font-bold text-ink">{title}</p><p className="mx-auto mt-2 max-w-md text-xs leading-5 text-muted">{description}</p></div>;
}
