import type { ExportArtifact, TenantReportSnapshot } from "@/lib/types/reporting";

export type ExportFormat = "xlsx" | "csv" | "json" | "html";
export type DatasetKey =
  | "overview"
  | "users"
  | "licenses"
  | "licenseServices"
  | "groups"
  | "mailboxes"
  | "activity"
  | "sharepoint"
  | "onedrive"
  | "security"
  | "adminRoles";

export async function exportDataset(
  snapshot: TenantReportSnapshot,
  dataset: DatasetKey,
  format: ExportFormat
): Promise<ExportArtifact> {
  if (format === "html") {
    return exportHtml(snapshot, dataset);
  }

  const filename = `tenant-${dataset}.${format}`;
  const rows = buildRows(snapshot, dataset);

  if (format === "json") {
    return downloadBlob(filename, "application/json", JSON.stringify(rows, null, 2));
  }

  if (format === "csv") {
    return downloadBlob(filename, "text/csv;charset=utf-8", buildCsv(rows));
  }

  const XLSX = await import("xlsx");
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(workbook, worksheet, dataset);
  const binary = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

  return downloadBlob(filename, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", binary);
}

function buildRows(snapshot: TenantReportSnapshot, dataset: DatasetKey) {
  switch (dataset) {
    case "overview":
      return [{ ...snapshot.overview }] as Array<Record<string, unknown>>;
    case "users":
      return snapshot.users.map((row) => ({
        ...row,
        assignedSkuNames: row.assignedSkuNames.join(", ")
      })) as Array<Record<string, unknown>>;
    case "licenses":
      return snapshot.licenses.map((row) => ({ ...row })) as Array<Record<string, unknown>>;
    case "licenseServices":
      return snapshot.licenseServices.map((row) => ({ ...row })) as Array<Record<string, unknown>>;
    case "groups":
      return snapshot.groups.map((row) => ({ ...row })) as Array<Record<string, unknown>>;
    case "mailboxes":
      return snapshot.mailboxes.map((row) => ({ ...row })) as Array<Record<string, unknown>>;
    case "activity":
      return snapshot.activity.flatMap((datasetEntry) =>
        datasetEntry.rows.map((row) => ({
          workload: datasetEntry.title,
          primaryId: row.primaryId,
          displayName: row.displayName,
          lastActivityDate: row.lastActivityDate ?? "",
          ...row.metrics
        }))
      ) as Array<Record<string, unknown>>;
    case "sharepoint":
      return snapshot.sharePoint.sites.map((row) => ({
        ...row,
        storageUsedMB: Math.round(row.storageUsedBytes / 1048576),
        storageAllocatedMB: Math.round(row.storageAllocatedBytes / 1048576),
        storageRemainingMB: Math.round(row.storageRemainingBytes / 1048576)
      })) as Array<Record<string, unknown>>;
    case "onedrive":
      return snapshot.oneDrive.accounts.map((row) => ({
        ...row,
        storageUsedMB: Math.round(row.storageUsedBytes / 1048576),
        storageAllocatedMB: Math.round(row.storageAllocatedBytes / 1048576)
      })) as Array<Record<string, unknown>>;
    case "security":
      return snapshot.security.users.map((row) => ({
        ...row,
        methodsRegistered: row.methodsRegistered.join(", ")
      })) as Array<Record<string, unknown>>;
    case "adminRoles":
      return snapshot.security.adminRoles.map((row) => ({ ...row })) as Array<Record<string, unknown>>;
    default:
      return [];
  }
}

function exportHtml(snapshot: TenantReportSnapshot, dataset: DatasetKey): ExportArtifact {
  const rows = buildRows(snapshot, dataset);
  const title = `M365 Tenant Reporter - ${dataset}`;
  const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 32px; color: #07111f; }
      h1 { margin-bottom: 8px; }
      p { color: #29446d; }
      table { border-collapse: collapse; width: 100%; margin-top: 24px; }
      th, td { border: 1px solid #dae2ed; padding: 8px 10px; text-align: left; vertical-align: top; }
      th { background: #eef2f7; }
    </style>
  </head>
  <body>
    <h1>${escapeHtml(title)}</h1>
    <p>Generated at ${escapeHtml(snapshot.overview.lastUpdatedAt)}</p>
    ${buildHtmlTable(rows)}
  </body>
</html>`;

  return downloadBlob(`tenant-${dataset}.html`, "text/html;charset=utf-8", html);
}

function buildCsv(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => escapeCsv(String(row[header] ?? ""))).join(","))
  ];
  return lines.join("\n");
}

function buildHtmlTable(rows: Array<Record<string, unknown>>) {
  if (rows.length === 0) return "<p>No rows were available for this dataset.</p>";
  const headers = Object.keys(rows[0]);
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows
    .map((row) => {
      const cells = headers.map((header) => `<td>${escapeHtml(String(row[header] ?? ""))}</td>`).join("");
      return `<tr>${cells}</tr>`;
    })
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

function downloadBlob(filename: string, mimeType: string, content: string | ArrayBuffer): ExportArtifact {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  queueMicrotask(() => { URL.revokeObjectURL(url); });
  return { filename, mimeType, byteLength: blob.size };
}

function escapeCsv(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
