import type { LucideIcon } from "lucide-react";

export function StatCard({ label, value, detail, icon: Icon, tone = "sage" }: {
  label: string; value: string; detail: string; icon: LucideIcon;
  tone?: "sage" | "gold" | "clay" | "blue";
}) {
  const tones = {
    sage: "bg-[#e9f0e9] text-forest",
    gold: "bg-[#f4eddf] text-[#9b713f]",
    clay: "bg-[#f7e9e4] text-[#ad604e]",
    blue: "bg-[#e8edf1] text-[#5d7681]",
  };
  return (
    <div className="surface-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted">{label}</p>
          <p className="mt-3 font-display text-[27px] font-bold tracking-tight text-ink">{value}</p>
          <p className="mt-1 text-xs text-muted">{detail}</p>
        </div>
        <div className={"rounded-2xl p-3 " + tones[tone]}><Icon size={19} strokeWidth={1.8} /></div>
      </div>
    </div>
  );
}
