import { startTransition, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { DataTable } from "@/components/app/DataTable";
import { ExportButtons } from "@/components/app/ExportButtons";
import { MetricCard } from "@/components/app/MetricCard";
import { exportDataset } from "@/features/exports/exporters";
import type { DatasetKey, ExportFormat } from "@/features/exports/exporters";
import { useAuthSession } from "@/features/auth/useAuthSession";
import { collectTenantReportSnapshot } from "@/features/reporting/report-service";
import { withBase } from "@/lib/paths";
import type {
  ActivityDataset,
  ExportArtifact,
  GroupReportRow,
  LicenseReportRow,
  MailboxReportRow,
  TenantReportSnapshot,
  UserReportRow
} from "@/lib/types/reporting";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 0,
      gcTime: 0,
      refetchOnWindowFocus: false
    }
  }
});

const tabs: Array<{ id: DatasetKey; label: string; icon: string }> = [
  { id: "overview", label: "Overview", icon: "M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" },
  { id: "users", label: "Users", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M23 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75" },
  { id: "licenses", label: "Licenses", icon: "M1 4v16h22V4H1z M1 10h22" },
  { id: "groups", label: "Groups", icon: "M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2 M9 7a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M19 8v6 M22 11h-6" },
  { id: "mailboxes", label: "Mailboxes", icon: "M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z M22 6l-10 7L2 6" },
  { id: "activity", label: "Activity", icon: "M22 12h-4l-3 9L9 3l-3 9H2" }
];

const userColumns: ColumnDef<UserReportRow>[] = [
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  {
    accessorKey: "accountEnabled",
    header: "Account",
    cell: ({ row }) => (
      <span className={`badge ${row.original.accountEnabled ? "badge-mint" : "badge-neutral"}`}>
        {row.original.accountEnabled ? "Enabled" : "Disabled"}
      </span>
    )
  },
  { accessorKey: "userType", header: "User type" },
  { accessorKey: "assignedLicenseCount", header: "Assigned licenses" },
  {
    accessorKey: "assignedSkuNames",
    header: "Assigned SKUs",
    cell: ({ row }) => row.original.assignedSkuNames.join(", ")
  },
  {
    accessorKey: "lastSuccessfulSignIn",
    header: "Last successful sign-in",
    cell: ({ row }) => formatDateTime(row.original.lastSuccessfulSignIn)
  }
];

const licenseColumns: ColumnDef<LicenseReportRow>[] = [
  { accessorKey: "skuPartNumber", header: "SKU part number" },
  {
    accessorKey: "capabilityStatus",
    header: "Status",
    cell: ({ row }) => (
      <span className={`badge ${row.original.capabilityStatus === "Enabled" ? "badge-mint" : "badge-amber"}`}>
        {row.original.capabilityStatus}
      </span>
    )
  },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "consumed", header: "Consumed" },
  { accessorKey: "available", header: "Available" }
];

const groupColumns: ColumnDef<GroupReportRow>[] = [
  { accessorKey: "groupName", header: "Group name" },
  {
    accessorKey: "groupType",
    header: "Group type",
    cell: ({ row }) => (
      <span className="badge badge-neutral">{row.original.groupType}</span>
    )
  },
  {
    accessorKey: "mailEnabled",
    header: "Mail enabled",
    cell: ({ row }) => (row.original.mailEnabled ? "Yes" : "No")
  },
  {
    accessorKey: "securityEnabled",
    header: "Security enabled",
    cell: ({ row }) => (row.original.securityEnabled ? "Yes" : "No")
  },
  { accessorKey: "memberCount", header: "Members" }
];

const mailboxColumns: ColumnDef<MailboxReportRow>[] = [
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  { accessorKey: "purpose", header: "User purpose" },
  {
    accessorKey: "isShared",
    header: "Shared mailbox",
    cell: ({ row }) => (
      <span className={`badge ${row.original.isShared ? "badge-violet" : "badge-neutral"}`}>
        {row.original.isShared ? "Yes" : "No"}
      </span>
    )
  },
  { accessorKey: "note", header: "Note" }
];

export default function AppEntry() {
  return (
    <QueryClientProvider client={queryClient}>
      <ReportingWorkspace />
    </QueryClientProvider>
  );
}

function ReportingWorkspace() {
  const auth = useAuthSession();
  const reactQueryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DatasetKey>("overview");
  const [collectionEnabled, setCollectionEnabled] = useState(false);
  const [runNonce, setRunNonce] = useState(0);
  const [lastExport, setLastExport] = useState<ExportArtifact | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => {
      reactQueryClient.clear();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [reactQueryClient]);

  const snapshotQuery = useQuery({
    queryKey: ["tenant-snapshot", auth.account?.homeAccountId ?? "anonymous", runNonce, auth.permissionProfile.advancedAudit.granted],
    enabled: auth.status === "authenticated" && collectionEnabled,
    queryFn: () => collectTenantReportSnapshot(auth.acquireGraphToken, auth.permissionProfile)
  });

  const snapshot = snapshotQuery.data;
  const reportButtonLabel = snapshot ? "Refresh report" : "Generate report";

  const generateReport = () => {
    startTransition(() => {
      setCollectionEnabled(true);
      setRunNonce((value) => value + 1);
      reactQueryClient.removeQueries({ queryKey: ["tenant-snapshot"] });
    });
  };

  const clearSessionData = () => {
    startTransition(() => {
      setCollectionEnabled(false);
      setLastExport(null);
      reactQueryClient.removeQueries({ queryKey: ["tenant-snapshot"] });
    });
  };

  const handleExport = (loadedSnapshot: TenantReportSnapshot, dataset: DatasetKey, format: ExportFormat) => {
    const artifact = exportDataset(loadedSnapshot, dataset, format);
    void artifact.then(setLastExport);
    return artifact;
  };

  if (auth.status === "loading") {
    return (
      <StatePanel
        title="Preparing secure sign-in"
        body="Loading runtime configuration and Microsoft Entra session state."
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-sky-500">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        }
      />
    );
  }

  if (auth.status === "misconfigured") {
    return (
      <StatePanel
        title="Runtime configuration still uses placeholders"
        body="Update runtime-config.json or let the deploy workflow materialize the public runtime values before opening the reporting flow."
        tone="warning"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        }
      />
    );
  }

  if (auth.status === "error") {
    return (
      <StatePanel
        title="Authentication bootstrap failed"
        body={auth.error ?? "Unknown authentication error."}
        tone="danger"
        icon={
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        }
      />
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="page-frame">
        <section className="glass-panel rounded-3xl p-6 md:p-8">
          <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-center">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                <span className="badge badge-sky">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                  Session-only access
                </span>
                <span className="badge badge-neutral">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                  </svg>
                  Delegated Graph scopes
                </span>
              </div>

              <div>
                <h2 className="text-3xl font-bold leading-tight tracking-tight text-ink-950 md:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
                  Connect your tenant to generate a report.
                </h2>
                <p className="mt-4 max-w-2xl text-base leading-8 text-ink-600">
                  Sign-in happens with Microsoft Entra. Report data is only collected after you choose to generate a snapshot, and the data stays inside the current browser session.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => void auth.signIn()}
                  className="btn-primary"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                    <polyline points="10 17 15 12 10 7" />
                    <line x1="15" y1="12" x2="3" y2="12" />
                  </svg>
                  Sign in with Microsoft Entra
                </button>
                <a
                  href={withBase("/docs/permissions")}
                  className="btn-secondary"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                  </svg>
                  Review permissions
                </a>
              </div>

              {auth.error && (
                <div className="flex items-center gap-3 rounded-2xl bg-rose-500/8 border border-rose-500/15 px-4 py-3">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500 shrink-0">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="8" x2="12" y2="12" />
                    <line x1="12" y1="16" x2="12.01" y2="16" />
                  </svg>
                  <p className="text-sm text-ink-800">{auth.error}</p>
                </div>
              )}
            </div>

            <div className="grid gap-3">
              {[
                {
                  title: "Read-only by design",
                  body: "The product does not assign licenses, change settings, or run remediation.",
                  iconColor: "bg-sky-500/10 text-sky-500",
                  icon: "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z M12 12m-3 0a3 3 0 1 0 6 0 3 3 0 1 0-6 0"
                },
                {
                  title: "Local export flow",
                  body: "CSV, JSON, Excel, and HTML files are generated locally in the browser.",
                  iconColor: "bg-mint-500/10 text-mint-500",
                  icon: "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4 M7 10l5 5 5-5 M12 15V3"
                },
                {
                  title: "Clear operational limits",
                  body: "If a workload is unavailable, you see a direct explanation instead of a broken report.",
                  iconColor: "bg-violet-500/10 text-violet-500",
                  icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                }
              ].map((card) => (
                <article key={card.title} className="fine-border rounded-2xl bg-white/80 p-5">
                  <div className="flex items-start gap-4">
                    <div className={`icon-container ${card.iconColor}`}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={card.icon} />
                      </svg>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-ink-950">{card.title}</h3>
                      <p className="mt-1 text-sm leading-6 text-ink-600">{card.body}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-frame space-y-5">
      <section className="glass-panel rounded-3xl p-6 md:p-8">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="icon-container-lg bg-sky-500/10 text-sky-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-ink-950 md:text-3xl" style={{ fontFamily: "var(--font-display)" }}>Tenant reporting</h2>
                <p className="text-sm text-ink-600">
                  Signed in as <strong className="text-ink-800">{auth.account?.username}</strong>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={generateReport} className="btn-primary py-2.5 px-5 text-[13px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              {reportButtonLabel}
            </button>
            <button type="button" onClick={clearSessionData} className="btn-secondary py-2.5 px-5 text-[13px]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear session
            </button>
            {!auth.permissionProfile.advancedAudit.granted && auth.permissionProfile.advancedAudit.requested && (
              <button
                type="button"
                onClick={() => void auth.enableAdvancedAudit()}
                className="inline-flex items-center gap-1.5 rounded-full border border-violet-500/20 bg-violet-500/8 px-5 py-2.5 text-[13px] font-semibold text-violet-500 transition hover:-translate-y-0.5 hover:border-violet-500/30"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="10" />
                  <polyline points="12 6 12 12 16 14" />
                </svg>
                Enable last sign-in
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                reactQueryClient.clear();
                void auth.signOut();
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-ink-900/8 bg-white/90 px-5 py-2.5 text-[13px] font-semibold text-ink-600 transition hover:-translate-y-0.5 hover:text-ink-900 hover:border-ink-900/15"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-2">
          <PermissionPill label="Core" granted={auth.permissionProfile.core.granted} />
          <PermissionPill label="Reports" granted={auth.permissionProfile.reports.granted} />
          <PermissionPill label="Advanced audit" granted={auth.permissionProfile.advancedAudit.granted} />
        </div>

        {lastExport && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-mint-500/8 border border-mint-500/15 px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mint-500 shrink-0">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
            <p className="text-sm text-ink-700">
              Exported <strong className="text-ink-900">{lastExport.filename}</strong> ({formatNumber(lastExport.byteLength)} bytes)
            </p>
          </div>
        )}

        {snapshotQuery.isLoading && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-sky-500/8 border border-sky-500/15 px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-sky-500 shrink-0">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            <p className="text-sm text-ink-700">Collecting a fresh tenant snapshot from Microsoft Graph...</p>
          </div>
        )}

        {snapshotQuery.isError && (
          <div className="mt-5 flex items-center gap-3 rounded-2xl bg-rose-500/8 border border-rose-500/15 px-4 py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-rose-500 shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p className="text-sm text-ink-800">{(snapshotQuery.error as Error).message}</p>
          </div>
        )}
      </section>

      {!snapshot && !snapshotQuery.isLoading && (
        <section className="glass-panel rounded-3xl p-6 md:p-8">
          <div className="grid gap-4 lg:grid-cols-3">
            {[
              {
                title: "Ready to generate",
                body: "Use the generate button to collect a fresh snapshot for the current session.",
                iconColor: "bg-sky-500/10 text-sky-500",
                icon: "M22 12h-4l-3 9L9 3l-3 9H2"
              },
              {
                title: "What you get",
                body: "Overview, users, licenses, groups, mailbox purpose, and local export buttons.",
                iconColor: "bg-mint-500/10 text-mint-500",
                icon: "M9 11l3 3L22 4 M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"
              },
              {
                title: "What may vary",
                body: "Some activity workloads depend on Reports Reader-type roles or browser support.",
                iconColor: "bg-amber-500/10 text-amber-500",
                icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
              }
            ].map((card) => (
              <article key={card.title} className="fine-border rounded-2xl bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className={`icon-container ${card.iconColor}`}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d={card.icon} />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-ink-950">{card.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-ink-600">{card.body}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {snapshot && (
        <div className="space-y-5">
          {snapshot.notes.length > 0 && (
            <section className="flex items-start gap-3 rounded-2xl border border-sky-500/15 bg-sky-500/6 p-5">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-sky-500 mt-0.5 shrink-0">
                <circle cx="12" cy="12" r="10" />
                <line x1="12" y1="16" x2="12" y2="12" />
                <line x1="12" y1="8" x2="12.01" y2="8" />
              </svg>
              <div>
                <h3 className="text-sm font-semibold text-ink-900">Collection notes</h3>
                <ul className="mt-2 space-y-1 text-sm leading-7 text-ink-700">
                  {snapshot.notes.map((note) => (
                    <li key={note}>{note}</li>
                  ))}
                </ul>
              </div>
            </section>
          )}

          <nav className="flex flex-wrap gap-1.5 rounded-2xl bg-white/60 border border-ink-900/6 p-1.5">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.id))}
                className={`inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-ink-900 text-white shadow-md shadow-ink-900/15"
                    : "text-ink-600 hover:text-ink-900 hover:bg-white"
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d={tab.icon} />
                </svg>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && <OverviewPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "users" && (
            <DatasetPanel title="Users report" dataset="users" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.users} columns={userColumns} searchPlaceholder="Filter users..." />
            </DatasetPanel>
          )}
          {activeTab === "licenses" && (
            <DatasetPanel title="License report" dataset="licenses" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.licenses} columns={licenseColumns} searchPlaceholder="Filter licenses..." />
            </DatasetPanel>
          )}
          {activeTab === "groups" && (
            <DatasetPanel title="Groups report" dataset="groups" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.groups} columns={groupColumns} searchPlaceholder="Filter groups..." />
            </DatasetPanel>
          )}
          {activeTab === "mailboxes" && (
            <DatasetPanel title="Mailbox purpose report" dataset="mailboxes" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.mailboxes} columns={mailboxColumns} searchPlaceholder="Filter mailbox rows..." />
            </DatasetPanel>
          )}
          {activeTab === "activity" && <ActivityPanel snapshot={snapshot} onExport={handleExport} />}
        </div>
      )}
    </div>
  );
}

function OverviewPanel({
  snapshot,
  onExport
}: {
  snapshot: TenantReportSnapshot;
  onExport: (
    snapshot: TenantReportSnapshot,
    dataset: DatasetKey,
    format: ExportFormat
  ) => Promise<ExportArtifact>;
}) {
  const userMix = [
    { name: "Licensed users", value: snapshot.overview.licensedUsers, color: "#0ea5e9" },
    { name: "Unlicensed users", value: snapshot.overview.unlicensedUsers, color: "#fbbf24" },
    { name: "Shared mailboxes", value: snapshot.overview.sharedMailboxes, color: "#10b981" }
  ];

  const licenseBars = snapshot.licenses.slice(0, 8).map((row) => ({
    name: row.skuPartNumber,
    Consumed: row.consumed,
    Available: row.available
  }));

  return (
    <DatasetPanel title="Overview" dataset="overview" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-4 lg:grid-cols-4">
        <MetricCard label="Total users" value={formatNumber(snapshot.overview.totalUsers)} detail="All users returned from Microsoft Graph." />
        <MetricCard
          label="Licensed users"
          value={formatNumber(snapshot.overview.licensedUsers)}
          detail="Users with at least one assigned license."
          accent="positive"
        />
        <MetricCard
          label="Groups"
          value={formatNumber(snapshot.overview.groupCount)}
          detail={`${formatNumber(snapshot.overview.totalGroupMembers)} direct members across all groups.`}
        />
        <MetricCard
          label="Shared mailboxes"
          value={formatNumber(snapshot.overview.sharedMailboxes)}
          detail={`${formatNumber(snapshot.overview.unknownMailboxPurposes)} mailbox rows remain unknown.`}
          accent="warning"
        />
        <MetricCard
          label="Purchased licenses"
          value={formatNumber(snapshot.overview.totalPurchasedLicenses)}
          detail="From subscribedSkus prepaid units."
        />
        <MetricCard
          label="Consumed licenses"
          value={formatNumber(snapshot.overview.consumedLicenses)}
          detail="Live consumedUnits total across SKUs."
          accent="positive"
        />
        <MetricCard
          label="Available licenses"
          value={formatNumber(snapshot.overview.availableLicenses)}
          detail="Purchased capacity minus consumed."
        />
        <MetricCard
          label="Last updated"
          value={formatDateTime(snapshot.overview.lastUpdatedAt)}
          detail="Timestamp for the current snapshot."
        />
      </div>

      <div className="mt-8 grid gap-5 xl:grid-cols-2">
        <div className="rounded-2xl border border-ink-900/6 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="icon-container bg-sky-500/10 text-sky-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.21 15.89A10 10 0 1 1 8 2.83" />
                <path d="M22 12A10 10 0 0 0 12 2v10z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-950">User mix</h3>
              <p className="text-sm text-ink-600">Licensed, unlicensed, and shared mailbox</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={userMix} dataKey="value" nameKey="name" innerRadius={65} outerRadius={100} strokeWidth={2} stroke="#fff">
                  {userMix.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(22,39,66,0.08)", boxShadow: "0 4px 12px rgba(7,17,31,0.08)" }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border border-ink-900/6 bg-white p-5">
          <div className="mb-4 flex items-center gap-3">
            <div className="icon-container bg-mint-500/10 text-mint-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="20" x2="18" y2="10" />
                <line x1="12" y1="20" x2="12" y2="4" />
                <line x1="6" y1="20" x2="6" y2="14" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-bold text-ink-950">License capacity</h3>
              <p className="text-sm text-ink-600">Consumed vs available seats</p>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={licenseBars}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
                <XAxis dataKey="name" hide />
                <YAxis stroke="rgba(22,39,66,0.2)" fontSize={12} />
                <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(22,39,66,0.08)", boxShadow: "0 4px 12px rgba(7,17,31,0.08)" }} />
                <Bar dataKey="Consumed" fill="#0ea5e9" radius={[8, 8, 0, 0]} />
                <Bar dataKey="Available" fill="#10b981" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {snapshot.lastSignInSummary && (
        <div className="mt-8 flex items-start gap-4 rounded-2xl border border-ink-900/6 bg-white p-5">
          <div className="icon-container bg-violet-500/10 text-violet-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-ink-950">Last sign-in summary</h3>
            <p className="mt-1 text-sm leading-7 text-ink-600">
              {snapshot.lastSignInSummary.status === "available"
                ? `${formatNumber(snapshot.lastSignInSummary.signedInLast30Days)} users recorded a sign-in during the last 30 days.`
                : snapshot.lastSignInSummary.note}
            </p>
          </div>
        </div>
      )}
    </DatasetPanel>
  );
}

function ActivityPanel({
  snapshot,
  onExport
}: {
  snapshot: TenantReportSnapshot;
  onExport: (
    snapshot: TenantReportSnapshot,
    dataset: DatasetKey,
    format: ExportFormat
  ) => Promise<ExportArtifact>;
}) {
  return (
    <DatasetPanel title="Activity reports" dataset="activity" snapshot={snapshot} onExport={onExport}>
      <div className="space-y-5">
        {snapshot.activity.map((dataset) => (
          <article key={dataset.workload} className="rounded-2xl border border-ink-900/6 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div className="flex items-start gap-3">
                <div className={`icon-container ${dataset.status === "available" ? "bg-mint-500/10 text-mint-500" : "bg-amber-500/10 text-amber-500"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-base font-bold text-ink-950">{dataset.title}</h3>
                  <p className="mt-1 text-sm leading-7 text-ink-600">
                    {dataset.status === "available"
                      ? `${formatNumber(dataset.rows.length)} rows collected.`
                      : dataset.note}
                  </p>
                </div>
              </div>
              <span className={`badge ${dataset.status === "available" ? "badge-mint" : "badge-amber"}`}>
                {dataset.status}
              </span>
            </div>
            {dataset.rows.length > 0 && (
              <div className="mt-4">
                <DataTable
                  data={toActivityTableRows(dataset)}
                  columns={buildActivityColumns(dataset)}
                  searchPlaceholder={`Filter ${dataset.title}...`}
                />
              </div>
            )}
          </article>
        ))}
      </div>
    </DatasetPanel>
  );
}

function DatasetPanel({
  title,
  dataset,
  snapshot,
  onExport,
  children
}: {
  title: string;
  dataset: DatasetKey;
  snapshot: TenantReportSnapshot;
  onExport: (
    snapshot: TenantReportSnapshot,
    dataset: DatasetKey,
    format: ExportFormat
  ) => Promise<ExportArtifact>;
  children: ReactNode;
}) {
  return (
    <section className="glass-panel rounded-3xl p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-ink-950" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
          <p className="mt-1 text-sm text-ink-600">
            Review the current session snapshot and export this dataset locally.
          </p>
        </div>
        <ExportButtons dataset={dataset} onExport={(selectedDataset, format) => onExport(snapshot, selectedDataset, format)} />
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function StatePanel({
  title,
  body,
  tone = "default",
  icon
}: {
  title: string;
  body: string;
  tone?: "default" | "warning" | "danger";
  icon?: ReactNode;
}) {
  const borderColor = tone === "danger" ? "border-rose-500/15" : tone === "warning" ? "border-amber-500/15" : "border-sky-500/15";
  return (
    <div className="page-frame">
      <section className={`glass-panel rounded-3xl p-8 text-center md:p-12 border ${borderColor}`}>
        {icon && <div className="mb-4 flex justify-center">{icon}</div>}
        <h2 className="text-2xl font-bold tracking-tight text-ink-950" style={{ fontFamily: "var(--font-display)" }}>{title}</h2>
        <p className="mx-auto mt-3 max-w-2xl text-base leading-8 text-ink-600">{body}</p>
      </section>
    </div>
  );
}

function PermissionPill({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span className={`badge ${granted ? "badge-mint" : "badge-amber"}`}>
      {granted ? (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      )}
      {label}: {granted ? "ready" : "limited"}
    </span>
  );
}

function toActivityTableRows(dataset: ActivityDataset) {
  return dataset.rows.map((row) => ({
    primaryId: row.primaryId,
    displayName: row.displayName,
    lastActivityDate: row.lastActivityDate ?? "",
    ...row.metrics
  }));
}

function buildActivityColumns(dataset: ActivityDataset): ColumnDef<Record<string, unknown>>[] {
  const firstRow = toActivityTableRows(dataset)[0] ?? {};
  return Object.keys(firstRow).map((key) => ({
    accessorKey: key,
    header: key,
    cell: ({ row }) => String(row.original[key] ?? "")
  }));
}
