import type { ExportArtifact } from "@/lib/types/reporting";
import type { DatasetKey, ExportFormat } from "@/features/exports/exporters";

interface ExportButtonsProps {
  dataset: DatasetKey;
  onExport: (dataset: DatasetKey, format: ExportFormat) => Promise<ExportArtifact>;
}

const formats: ExportFormat[] = ["xlsx", "csv", "json", "html"];

export function ExportButtons({ dataset, onExport }: ExportButtonsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {formats.map((format) => (
        <button
          key={`${dataset}-${format}`}
          type="button"
          onClick={() => void onExport(dataset, format)}
          className="group inline-flex items-center gap-1.5 rounded-xl border border-ink-900/8 bg-white/90 px-3.5 py-2 text-xs font-semibold uppercase tracking-wider text-ink-600 transition hover:-translate-y-0.5 hover:border-sky-500/20 hover:text-sky-500 hover:shadow-md hover:shadow-sky-500/6"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="opacity-60 group-hover:opacity-100 transition">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {format}
        </button>
      ))}
    </div>
  );
}
