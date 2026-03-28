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
          className="rounded-full border border-ink-900/10 bg-white/90 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-ink-700 shadow-sm transition hover:-translate-y-0.5 hover:border-ink-900/25 hover:bg-white"
        >
          {format}
        </button>
      ))}
    </div>
  );
}
