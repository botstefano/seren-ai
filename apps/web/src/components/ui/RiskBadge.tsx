export function RiskBadge({ level }: { level: string }) {
  const styles: Record<string, string> = {
    HIGH: "bg-[#f7e8e3] text-[#a85543]",
    MEDIUM: "bg-[#f5efdf] text-[#96713e]",
    LOW: "bg-[#e7efe8] text-[#416c52]",
    INSUFFICIENT_DATA: "bg-[#edf0ee] text-[#69756e]",
  };
  const labels: Record<string, string> = {
    HIGH: "Alto", MEDIUM: "Moderado", LOW: "Bajo", INSUFFICIENT_DATA: "Datos insuficientes",
  };
  return <span className={"inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold " + (styles[level] ?? styles.INSUFFICIENT_DATA)}>{labels[level] ?? level}</span>;
}
