import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  accent?: "default" | "positive" | "warning";
  icon?: ReactNode;
}

export function MetricCard({ label, value, detail, accent = "default", icon }: MetricCardProps) {
  const accentClass =
    accent === "positive"
      ? "from-mint-400/20 via-white/80 to-transparent"
      : accent === "warning"
        ? "from-amber-400/20 via-white/80 to-transparent"
        : "from-sky-400/20 via-white/80 to-transparent";

  return (
    <article className={`rounded-[1.75rem] border border-ink-900/8 bg-linear-to-br ${accentClass} p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md`}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">{label}</p>
          <p className="mt-3 text-3xl font-semibold leading-none text-ink-950">{value}</p>
        </div>
        {icon ? <div className="rounded-2xl bg-white/80 p-3 text-ink-900">{icon}</div> : null}
      </div>
      <p className="mt-4 text-sm leading-6 text-ink-700">{detail}</p>
    </article>
  );
}
