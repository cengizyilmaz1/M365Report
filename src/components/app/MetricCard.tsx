import type { ReactNode } from "react";

interface MetricCardProps {
  label: string;
  value: string;
  detail: string;
  accent?: "default" | "positive" | "warning";
  icon?: ReactNode;
}

const accentStyles = {
  default: {
    gradient: "from-sky-500/8 to-transparent",
    iconBg: "bg-sky-500/10",
    iconColor: "text-sky-500",
    ring: "hover:border-sky-500/20"
  },
  positive: {
    gradient: "from-mint-500/8 to-transparent",
    iconBg: "bg-mint-500/10",
    iconColor: "text-mint-500",
    ring: "hover:border-mint-500/20"
  },
  warning: {
    gradient: "from-amber-400/10 to-transparent",
    iconBg: "bg-amber-500/10",
    iconColor: "text-amber-500",
    ring: "hover:border-amber-500/20"
  }
} as const;

export function MetricCard({ label, value, detail, accent = "default", icon }: MetricCardProps) {
  const style = accentStyles[accent];

  return (
    <article className={`group rounded-2xl border border-ink-900/6 bg-linear-to-br ${style.gradient} bg-white p-5 transition hover:-translate-y-1 ${style.ring} hover:shadow-lg hover:shadow-ink-900/4`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{label}</p>
          <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-ink-950">{value}</p>
        </div>
        {icon ? (
          <div className={`icon-container ${style.iconBg} ${style.iconColor}`}>{icon}</div>
        ) : (
          <div className={`icon-container ${style.iconBg} ${style.iconColor}`}>
            {accent === "positive" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
            ) : accent === "warning" ? (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="8" x2="12" y2="12" />
                <line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
            ) : (
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-sm leading-6 text-ink-600">{detail}</p>
    </article>
  );
}
