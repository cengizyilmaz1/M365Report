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
  AdminRoleRow,
  ExportArtifact,
  GroupReportRow,
  LicenseReportRow,
  LicenseServiceRow,
  MailboxReportRow,
  OneDriveAccountRow,
  SecurityUserRow,
  SharePointSiteRow,
  TenantReportSnapshot,
  UserReportRow
} from "@/lib/types/reporting";
import { formatDateTime, formatNumber } from "@/lib/utils/format";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 0, gcTime: 0, refetchOnWindowFocus: false } }
});

type TabId = "overview" | "users" | "licenses" | "groups" | "mailboxes" | "activity" | "sharepoint" | "onedrive" | "security";

const tabs: Array<{ id: TabId; label: string; group?: string }> = [
  { id: "overview", label: "Overview", group: "Core" },
  { id: "users", label: "Users", group: "Core" },
  { id: "licenses", label: "Licenses", group: "Core" },
  { id: "groups", label: "Groups", group: "Core" },
  { id: "mailboxes", label: "Mailboxes", group: "Core" },
  { id: "activity", label: "Activity", group: "Usage" },
  { id: "sharepoint", label: "SharePoint", group: "Usage" },
  { id: "onedrive", label: "OneDrive", group: "Usage" },
  { id: "security", label: "Security", group: "Security" }
];

/* ── Column definitions ── */

const userColumns: ColumnDef<UserReportRow>[] = [
  { accessorKey: "displayName", header: "Name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  { accessorKey: "accountEnabled", header: "Status", cell: ({ row }) => <span className={`badge ${row.original.accountEnabled ? "badge-mint" : "badge-neutral"}`}>{row.original.accountEnabled ? "Enabled" : "Disabled"}</span> },
  { accessorKey: "userType", header: "Type" },
  { accessorKey: "assignedLicenseCount", header: "Licenses" },
  { accessorKey: "assignedSkuNames", header: "SKUs", cell: ({ row }) => row.original.assignedSkuNames.join(", ") },
  { accessorKey: "lastSuccessfulSignIn", header: "Last sign-in", cell: ({ row }) => formatDateTime(row.original.lastSuccessfulSignIn) }
];

const licenseColumns: ColumnDef<LicenseReportRow>[] = [
  { accessorKey: "friendlyName", header: "License" },
  { accessorKey: "skuPartNumber", header: "SKU" },
  { accessorKey: "capabilityStatus", header: "Status", cell: ({ row }) => <span className={`badge ${row.original.capabilityStatus === "Enabled" ? "badge-mint" : "badge-amber"}`}>{row.original.capabilityStatus}</span> },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "consumed", header: "Consumed" },
  { accessorKey: "available", header: "Available" }
];

const licenseServiceColumns: ColumnDef<LicenseServiceRow>[] = [
  { accessorKey: "displayName", header: "User" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "friendlyName", header: "License" },
  { accessorKey: "servicePlanName", header: "Service plan" },
  { accessorKey: "status", header: "Status", cell: ({ row }) => <span className={`badge ${row.original.status === "Enabled" ? "badge-mint" : "badge-amber"}`}>{row.original.status}</span> }
];

const groupColumns: ColumnDef<GroupReportRow>[] = [
  { accessorKey: "groupName", header: "Group" },
  { accessorKey: "groupType", header: "Type", cell: ({ row }) => <span className="badge badge-neutral">{row.original.groupType}</span> },
  { accessorKey: "mailEnabled", header: "Mail", cell: ({ row }) => row.original.mailEnabled ? "Yes" : "No" },
  { accessorKey: "securityEnabled", header: "Security", cell: ({ row }) => row.original.securityEnabled ? "Yes" : "No" },
  { accessorKey: "memberCount", header: "Members" }
];

const mailboxColumns: ColumnDef<MailboxReportRow>[] = [
  { accessorKey: "displayName", header: "Name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  { accessorKey: "purpose", header: "Purpose" },
  { accessorKey: "isShared", header: "Shared", cell: ({ row }) => <span className={`badge ${row.original.isShared ? "badge-violet" : "badge-neutral"}`}>{row.original.isShared ? "Yes" : "No"}</span> }
];

const sharePointColumns: ColumnDef<SharePointSiteRow>[] = [
  { accessorKey: "siteName", header: "Site" },
  { accessorKey: "siteUrl", header: "URL" },
  { accessorKey: "lastActivityDate", header: "Last activity" },
  { accessorKey: "fileCount", header: "Files" },
  { accessorKey: "storageUsedBytes", header: "Storage (MB)", cell: ({ row }) => formatNumber(Math.round(row.original.storageUsedBytes / 1048576)) },
  { accessorKey: "isActive", header: "Active", cell: ({ row }) => <span className={`badge ${row.original.isActive ? "badge-mint" : "badge-amber"}`}>{row.original.isActive ? "Yes" : "No"}</span> }
];

const oneDriveColumns: ColumnDef<OneDriveAccountRow>[] = [
  { accessorKey: "ownerDisplayName", header: "Owner" },
  { accessorKey: "ownerPrincipalName", header: "UPN" },
  { accessorKey: "lastActivityDate", header: "Last activity" },
  { accessorKey: "fileCount", header: "Files" },
  { accessorKey: "storageUsedBytes", header: "Storage (MB)", cell: ({ row }) => formatNumber(Math.round(row.original.storageUsedBytes / 1048576)) },
  { accessorKey: "isActive", header: "Active", cell: ({ row }) => <span className={`badge ${row.original.isActive ? "badge-mint" : "badge-amber"}`}>{row.original.isActive ? "Yes" : "No"}</span> }
];

const securityUserColumns: ColumnDef<SecurityUserRow>[] = [
  { accessorKey: "displayName", header: "Name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "userType", header: "Type" },
  { accessorKey: "mfaRegistered", header: "MFA", cell: ({ row }) => <span className={`badge ${row.original.mfaRegistered ? "badge-mint" : "badge-amber"}`}>{row.original.mfaRegistered ? "Yes" : "No"}</span> },
  { accessorKey: "methodsRegistered", header: "Methods", cell: ({ row }) => row.original.methodsRegistered.join(", ") || "—" },
  { accessorKey: "isInactive", header: "Inactive", cell: ({ row }) => row.original.isInactive ? <span className="badge badge-amber">Yes</span> : "No" },
  { accessorKey: "inactiveDays", header: "Days", cell: ({ row }) => row.original.inactiveDays >= 0 ? row.original.inactiveDays : "—" },
  { accessorKey: "isLicensed", header: "Licensed", cell: ({ row }) => row.original.isLicensed ? "Yes" : "No" }
];

const adminRoleColumns: ColumnDef<AdminRoleRow>[] = [
  { accessorKey: "roleDisplayName", header: "Role" },
  { accessorKey: "userDisplayName", header: "User" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mfaRegistered", header: "MFA", cell: ({ row }) => <span className={`badge ${row.original.mfaRegistered ? "badge-mint" : "badge-amber"}`}>{row.original.mfaRegistered ? "Yes" : "No"}</span> }
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
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [lastExport, setLastExport] = useState<ExportArtifact | null>(null);

  useEffect(() => {
    const handleBeforeUnload = () => { reactQueryClient.clear(); };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [reactQueryClient]);

  // Auto-fetch: start collection immediately when authenticated
  const snapshotQuery = useQuery({
    queryKey: ["tenant-snapshot", auth.account?.homeAccountId ?? "anonymous", auth.permissionProfile.advancedAudit.granted],
    enabled: auth.status === "authenticated",
    queryFn: () => collectTenantReportSnapshot(auth.acquireGraphToken, auth.permissionProfile)
  });

  const snapshot = snapshotQuery.data;

  const refreshReport = () => {
    startTransition(() => {
      reactQueryClient.removeQueries({ queryKey: ["tenant-snapshot"] });
      void snapshotQuery.refetch();
    });
  };

  const handleExport = (loadedSnapshot: TenantReportSnapshot, dataset: DatasetKey, format: ExportFormat) => {
    const artifact = exportDataset(loadedSnapshot, dataset, format);
    void artifact.then(setLastExport);
    return artifact;
  };

  /* ── Auth states ── */

  if (auth.status === "loading") {
    return (
      <div className="page-frame flex min-h-[60vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3 animate-fade-up">
          <div className="relative">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-violet-500 shadow-lg shadow-sky-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </span>
            <span className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full border-2 border-white bg-sky-500 animate-pulse" />
          </div>
          <p className="text-sm font-medium text-ink-600">Initializing session...</p>
        </div>
      </div>
    );
  }

  if (auth.status === "misconfigured") {
    return (
      <div className="page-frame flex min-h-[60vh] items-center justify-center">
        <div className="glass-panel max-w-md rounded-2xl p-8 text-center animate-fade-up">
          <div className="mb-4 flex justify-center"><div className="icon-container-lg bg-amber-500/10 text-amber-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div></div>
          <h2 className="text-lg font-bold text-ink-950">Configuration required</h2>
          <p className="mt-2 text-sm text-ink-600">Update runtime-config.json with your deployment values.</p>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="page-frame flex min-h-[60vh] items-center justify-center">
        <div className="glass-panel max-w-md rounded-2xl p-8 text-center animate-fade-up">
          <div className="mb-4 flex justify-center"><div className="icon-container-lg bg-rose-400/10 text-rose-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg></div></div>
          <h2 className="text-lg font-bold text-ink-950">Authentication failed</h2>
          <p className="mt-2 text-sm text-ink-600">{auth.error ?? "Unknown error."}</p>
          <a href={withBase("/login")} className="btn-primary mt-6 inline-flex text-sm">Try again</a>
        </div>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="page-frame flex min-h-[60vh] items-center justify-center">
        <div className="glass-panel max-w-sm rounded-3xl p-10 text-center animate-fade-up">
          <div className="mb-6 flex justify-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-violet-500 shadow-lg shadow-sky-500/20">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-ink-950" style={{ fontFamily: "var(--font-display)" }}>Welcome back</h2>
          <p className="mt-2 text-sm text-ink-600">Sign in to start collecting tenant reports.</p>
          <button type="button" onClick={() => void auth.signIn()} className="btn-primary mt-6 w-full justify-center py-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
            Continue with Microsoft Entra
          </button>
        </div>
      </div>
    );
  }

  /* ── Authenticated dashboard ── */

  return (
    <div className="page-frame space-y-4 pb-8">
      {/* Top bar */}
      <header className="glass-panel rounded-2xl px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-violet-500 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
            </span>
            <div>
              <h1 className="text-base font-bold tracking-tight text-ink-950">Dashboard</h1>
              <p className="text-xs text-ink-500">{auth.account?.username}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <PermissionPill label="Core" granted={auth.permissionProfile.core.granted} />
            <PermissionPill label="Reports" granted={auth.permissionProfile.reports.granted} />
            <PermissionPill label="Audit" granted={auth.permissionProfile.advancedAudit.granted} />
            <div className="h-5 w-px bg-ink-900/8 mx-1 hidden lg:block" />
            <button type="button" onClick={refreshReport} className="btn-primary py-2 px-4 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
              Refresh
            </button>
            {!auth.permissionProfile.advancedAudit.granted && auth.permissionProfile.advancedAudit.requested && (
              <button type="button" onClick={() => void auth.enableAdvancedAudit()} className="badge badge-violet cursor-pointer hover:opacity-80">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Enable sign-in data
              </button>
            )}
            <button type="button" onClick={() => { reactQueryClient.clear(); void auth.signOut(); }} className="btn-secondary py-2 px-4 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
              Sign out
            </button>
          </div>
        </div>

        {/* Status messages */}
        {lastExport && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-mint-500/8 border border-mint-500/15 px-3 py-2 text-sm text-ink-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-mint-500 shrink-0"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
            Exported <strong>{lastExport.filename}</strong> ({formatNumber(lastExport.byteLength)} bytes)
          </div>
        )}
        {snapshotQuery.isLoading && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-sky-500/8 border border-sky-500/15 px-3 py-2 text-sm text-ink-700">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin text-sky-500 shrink-0"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            Collecting tenant data — users, licenses, groups, usage, and security insights...
          </div>
        )}
        {snapshotQuery.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/8 border border-rose-500/15 px-3 py-2 text-sm text-ink-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-500 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            {(snapshotQuery.error as Error).message}
          </div>
        )}
      </header>

      {/* Loading skeleton */}
      {snapshotQuery.isLoading && !snapshot && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="glass-panel rounded-2xl p-5 animate-pulse">
              <div className="h-3 w-16 rounded bg-ink-900/8 mb-3" />
              <div className="h-6 w-20 rounded bg-ink-900/8 mb-2" />
              <div className="h-3 w-28 rounded bg-ink-900/6" />
            </div>
          ))}
        </div>
      )}

      {/* Report content */}
      {snapshot && (
        <div className="space-y-4">
          {snapshot.notes.length > 0 && (
            <div className="flex items-start gap-2 rounded-xl border border-sky-500/15 bg-sky-500/6 px-4 py-3 text-sm text-ink-700">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-sky-500 mt-0.5 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" /></svg>
              <ul className="space-y-0.5">{snapshot.notes.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          )}

          {/* Tab nav */}
          <nav className="flex flex-wrap gap-1 rounded-xl bg-white/60 border border-ink-900/6 p-1">
            {tabs.map((tab, i) => {
              const prevGroup = i > 0 ? tabs[i - 1].group : null;
              const showDivider = tab.group !== prevGroup && i > 0;
              return (
                <div key={tab.id} className="flex items-center">
                  {showDivider && <div className="h-5 w-px bg-ink-900/10 mx-1" />}
                  <button
                    type="button"
                    onClick={() => startTransition(() => setActiveTab(tab.id))}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                      activeTab === tab.id
                        ? "bg-ink-900 text-white shadow-sm"
                        : "text-ink-600 hover:text-ink-900 hover:bg-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                </div>
              );
            })}
          </nav>

          {activeTab === "overview" && <OverviewPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "users" && (
            <DatasetPanel title="Users" dataset="users" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.users} columns={userColumns} searchPlaceholder="Filter users..." />
            </DatasetPanel>
          )}
          {activeTab === "licenses" && <LicensesPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "groups" && (
            <DatasetPanel title="Groups" dataset="groups" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.groups} columns={groupColumns} searchPlaceholder="Filter groups..." />
            </DatasetPanel>
          )}
          {activeTab === "mailboxes" && (
            <DatasetPanel title="Mailboxes" dataset="mailboxes" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.mailboxes} columns={mailboxColumns} searchPlaceholder="Filter mailboxes..." />
            </DatasetPanel>
          )}
          {activeTab === "activity" && <ActivityPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "sharepoint" && <SharePointPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "onedrive" && <OneDrivePanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "security" && <SecurityPanel snapshot={snapshot} onExport={handleExport} />}
        </div>
      )}
    </div>
  );
}

/* ── Panel components ── */

type PanelExport = (s: TenantReportSnapshot, d: DatasetKey, f: ExportFormat) => Promise<ExportArtifact>;

function OverviewPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const o = snapshot.overview;
  const secScore = snapshot.security.securityScore.overall;

  const userMix = [
    { name: "Licensed", value: o.licensedUsers, color: "#0ea5e9" },
    { name: "Unlicensed", value: o.unlicensedUsers, color: "#fbbf24" },
    { name: "Shared", value: o.sharedMailboxes, color: "#10b981" },
    { name: "Guests", value: o.guestUsers, color: "#8b5cf6" }
  ];
  const licenseBars = snapshot.licenses.slice(0, 8).map((r) => ({ name: r.friendlyName, Consumed: r.consumed, Available: r.available }));

  return (
    <DatasetPanel title="Overview" dataset="overview" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total users" value={formatNumber(o.totalUsers)} detail={`${formatNumber(o.guestUsers)} guests, ${formatNumber(o.disabledUsers)} disabled`} />
        <MetricCard label="Licensed" value={formatNumber(o.licensedUsers)} detail={`${formatNumber(o.unlicensedUsers)} unlicensed`} accent="positive" />
        <MetricCard label="Groups" value={formatNumber(o.groupCount)} detail={`${formatNumber(o.totalGroupMembers)} total members`} />
        <MetricCard label="Security score" value={`${secScore}/100`} detail={secScore >= 70 ? "Good posture" : secScore >= 40 ? "Needs attention" : "Critical"} accent={secScore >= 70 ? "positive" : "warning"} />
        <MetricCard label="Purchased licenses" value={formatNumber(o.totalPurchasedLicenses)} detail="From subscribedSkus" />
        <MetricCard label="Consumed" value={formatNumber(o.consumedLicenses)} detail="Across all SKUs" accent="positive" />
        <MetricCard label="Available" value={formatNumber(o.availableLicenses)} detail="Purchased minus consumed" />
        <MetricCard label="Shared mailboxes" value={formatNumber(o.sharedMailboxes)} detail={`${formatNumber(o.unknownMailboxPurposes)} unknown`} />
      </div>

      {/* Quick insight cards */}
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InsightCard
          title="SharePoint"
          status={snapshot.sharePoint.summary.status}
          metric={snapshot.sharePoint.summary.status === "available" ? `${formatNumber(snapshot.sharePoint.summary.activeSites)} active / ${formatNumber(snapshot.sharePoint.summary.totalSites)} total` : "N/A"}
          note={snapshot.sharePoint.summary.note}
          accent="sky"
        />
        <InsightCard
          title="OneDrive"
          status={snapshot.oneDrive.summary.status}
          metric={snapshot.oneDrive.summary.status === "available" ? `${formatNumber(snapshot.oneDrive.summary.activeAccounts)} active / ${formatNumber(snapshot.oneDrive.summary.totalAccounts)} total` : "N/A"}
          note={snapshot.oneDrive.summary.note}
          accent="violet"
        />
        <InsightCard
          title="MFA Coverage"
          status={snapshot.security.status === "unavailable" ? "unavailable" : "available"}
          metric={snapshot.security.status !== "unavailable" ? `${snapshot.security.mfaCoveragePercent}%` : "N/A"}
          note={snapshot.security.note}
          accent="mint"
        />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="User mix" subtitle="Licensed / unlicensed / shared / guests">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={userMix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {userMix.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="License capacity" subtitle="Top 8 SKUs">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={licenseBars}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Consumed" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
              <Bar dataKey="Available" fill="#10b981" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {snapshot.lastSignInSummary && (
        <div className="mt-6 flex items-center gap-3 rounded-xl border border-ink-900/6 bg-white p-4">
          <div className="icon-container bg-violet-500/10 text-violet-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
          </div>
          <div>
            <p className="text-sm font-semibold text-ink-950">Last sign-in summary</p>
            <p className="text-sm text-ink-600">
              {snapshot.lastSignInSummary.status === "available"
                ? `${formatNumber(snapshot.lastSignInSummary.signedInLast30Days)} users signed in during the last 30 days.`
                : snapshot.lastSignInSummary.note}
            </p>
          </div>
        </div>
      )}
    </DatasetPanel>
  );
}

function LicensesPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const [showServices, setShowServices] = useState(false);

  return (
    <div className="space-y-4">
      <DatasetPanel title="Licenses" dataset="licenses" snapshot={snapshot} onExport={onExport}>
        <DataTable data={snapshot.licenses} columns={licenseColumns} searchPlaceholder="Filter licenses..." />
      </DatasetPanel>
      <section className="glass-panel rounded-2xl p-5 md:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-ink-950">Service plan assignments</h2>
            <p className="text-xs text-ink-500 mt-1">{formatNumber(snapshot.licenseServices.length)} service plan rows across all users</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowServices((v) => !v)} className="btn-secondary py-2 px-4 text-xs">
              {showServices ? "Hide details" : "Show details"}
            </button>
            <ExportButtons dataset={"licenseServices"} onExport={(d, f) => onExport(snapshot, d, f)} />
          </div>
        </div>
        {showServices && (
          <div className="mt-4">
            <DataTable data={snapshot.licenseServices} columns={licenseServiceColumns} searchPlaceholder="Filter service plans..." />
          </div>
        )}
      </section>
    </div>
  );
}

function ActivityPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  return (
    <DatasetPanel title="Activity" dataset="activity" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2">
        {snapshot.activity.map((ds) => (
          <article key={ds.workload} className="rounded-2xl border border-ink-900/6 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`icon-container ${ds.status === "available" ? "bg-mint-500/10 text-mint-500" : "bg-ink-900/5 text-ink-500"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-950">{ds.title}</h3>
                  {ds.status === "available"
                    ? <p className="mt-1 text-xs text-ink-600">{formatNumber(ds.rows.length)} rows</p>
                    : <p className="mt-1 text-xs text-ink-500">{ds.note?.includes("Reports.Read.All") ? "Requires Reports Reader role" : ds.note ?? "Not available"}</p>}
                </div>
              </div>
              <span className={`badge text-[10px] ${ds.status === "available" ? "badge-mint" : "badge-neutral"}`}>
                {ds.status === "available" ? "Ready" : "N/A"}
              </span>
            </div>
            {ds.rows.length > 0 && (
              <div className="mt-4"><DataTable data={toActivityTableRows(ds)} columns={buildActivityColumns(ds)} searchPlaceholder={`Filter ${ds.title}...`} /></div>
            )}
          </article>
        ))}
      </div>
    </DatasetPanel>
  );
}

function SharePointPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const sp = snapshot.sharePoint;

  if (sp.summary.status === "unavailable") {
    return <UnavailablePanel title="SharePoint Usage" note={sp.summary.note} />;
  }

  const activityData = [
    { name: "Active", value: sp.summary.activeSites, color: "#0ea5e9" },
    { name: "Inactive", value: sp.summary.inactiveSites, color: "#fbbf24" }
  ];

  return (
    <DatasetPanel title="SharePoint Usage" dataset="sharepoint" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard label="Total sites" value={formatNumber(sp.summary.totalSites)} detail="All SharePoint sites" />
        <MetricCard label="Active sites" value={formatNumber(sp.summary.activeSites)} detail="Activity in last 30 days" accent="positive" />
        <MetricCard label="Inactive sites" value={formatNumber(sp.summary.inactiveSites)} detail="No recent activity" accent="warning" />
        <MetricCard label="Storage used" value={formatStorageSize(sp.summary.totalStorageUsedBytes)} detail="Across all sites" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2 mb-6">
        <ChartCard title="Site activity" subtitle="Active vs inactive">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={activityData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {activityData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top sites by storage" subtitle="Top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sp.sites.sort((a, b) => b.storageUsedBytes - a.storageUsedBytes).slice(0, 10).map((s) => ({ name: s.siteName.slice(0, 20), MB: Math.round(s.storageUsedBytes / 1048576) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="MB" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <DataTable data={sp.sites} columns={sharePointColumns} searchPlaceholder="Filter sites..." />
    </DatasetPanel>
  );
}

function OneDrivePanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const od = snapshot.oneDrive;

  if (od.summary.status === "unavailable") {
    return <UnavailablePanel title="OneDrive Usage" note={od.summary.note} />;
  }

  const activityData = [
    { name: "Active", value: od.summary.activeAccounts, color: "#8b5cf6" },
    { name: "Inactive", value: od.summary.inactiveAccounts, color: "#fbbf24" }
  ];

  return (
    <DatasetPanel title="OneDrive Usage" dataset="onedrive" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <MetricCard label="Total accounts" value={formatNumber(od.summary.totalAccounts)} detail="All OneDrive accounts" />
        <MetricCard label="Active" value={formatNumber(od.summary.activeAccounts)} detail="Activity in last 30 days" accent="positive" />
        <MetricCard label="Inactive" value={formatNumber(od.summary.inactiveAccounts)} detail="No recent activity" accent="warning" />
        <MetricCard label="Storage used" value={formatStorageSize(od.summary.totalStorageUsedBytes)} detail="Across all accounts" />
      </div>
      <div className="grid gap-4 xl:grid-cols-2 mb-6">
        <ChartCard title="Account activity" subtitle="Active vs inactive">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={activityData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {activityData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top users by storage" subtitle="Top 10">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={od.accounts.sort((a, b) => b.storageUsedBytes - a.storageUsedBytes).slice(0, 10).map((a) => ({ name: a.ownerDisplayName.slice(0, 20), MB: Math.round(a.storageUsedBytes / 1048576) }))}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="MB" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
      <DataTable data={od.accounts} columns={oneDriveColumns} searchPlaceholder="Filter accounts..." />
    </DatasetPanel>
  );
}

function SecurityPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const sec = snapshot.security;
  const score = sec.securityScore;
  const [activeView, setActiveView] = useState<"overview" | "users" | "admins">("overview");

  const scoreColor = score.overall >= 70 ? "#10b981" : score.overall >= 40 ? "#f59e0b" : "#ef4444";

  const mfaData = [
    { name: "MFA registered", value: sec.mfaRegisteredCount, color: "#10b981" },
    { name: "No MFA", value: sec.mfaNotRegisteredCount, color: "#ef4444" }
  ];

  const scoreBreakdown = score.details.map((d) => ({
    name: d.category,
    Score: d.score,
    Max: d.maxScore - d.score
  }));

  return (
    <div className="space-y-4">
      {/* Score hero */}
      <section className="glass-panel rounded-2xl p-6 md:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-6">
            <div className="relative flex h-24 w-24 items-center justify-center">
              <svg viewBox="0 0 36 36" className="h-24 w-24 -rotate-90">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(22,39,66,0.06)" strokeWidth="3" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke={scoreColor} strokeWidth="3" strokeLinecap="round" strokeDasharray={`${score.overall * 0.974} 100`} />
              </svg>
              <span className="absolute text-2xl font-bold text-ink-950">{score.overall}</span>
            </div>
            <div>
              <h2 className="text-xl font-bold text-ink-950">Security Score</h2>
              <p className="mt-1 text-sm text-ink-600">
                {score.overall >= 70 ? "Your tenant security posture is strong." : score.overall >= 40 ? "Some areas need improvement." : "Critical security gaps detected."}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <ExportButtons dataset={"security"} onExport={(d, f) => onExport(snapshot, d, f)} />
          </div>
        </div>
      </section>

      {/* Risk cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MFA coverage" value={`${sec.mfaCoveragePercent}%`} detail={`${formatNumber(sec.mfaRegisteredCount)} registered`} accent={sec.mfaCoveragePercent >= 80 ? "positive" : "warning"} />
        <MetricCard label="Inactive users" value={formatNumber(sec.inactiveUsers)} detail={`${formatNumber(sec.inactiveLicensedUsers)} licensed`} accent={sec.inactiveUsers === 0 ? "positive" : "warning"} />
        <MetricCard label="Guest users" value={formatNumber(sec.totalGuests)} detail={`${formatNumber(sec.inactiveGuests)} inactive`} accent={sec.inactiveGuests === 0 ? "positive" : "warning"} />
        <MetricCard label="Admin accounts" value={formatNumber(sec.totalAdmins)} detail={`${formatNumber(sec.adminsWithoutMfa)} without MFA`} accent={sec.adminsWithoutMfa === 0 ? "positive" : "warning"} />
      </div>

      {/* Charts */}
      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="MFA registration" subtitle="Enabled member accounts">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mfaData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {mfaData.map((e) => <Cell key={e.name} fill={e.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Score breakdown" subtitle="By category">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={scoreBreakdown} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgba(22,39,66,0.06)" />
              <XAxis type="number" domain={[0, 40]} stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <YAxis type="category" dataKey="name" width={110} stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="Score" stackId="a" fill="#10b981" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Max" stackId="a" fill="rgba(22,39,66,0.06)" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Detail tabs */}
      <section className="glass-panel rounded-2xl p-5 md:p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {(["overview", "users", "admins"] as const).map((view) => (
            <button key={view} type="button" onClick={() => setActiveView(view)}
              className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeView === view ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-white"}`}>
              {view === "overview" ? "Score details" : view === "users" ? "All users" : "Admin roles"}
            </button>
          ))}
          <div className="ml-auto">
            <ExportButtons dataset={"adminRoles"} onExport={(d, f) => onExport(snapshot, d, f)} />
          </div>
        </div>

        {activeView === "overview" && (
          <div className="space-y-3">
            {score.details.map((d) => (
              <div key={d.category} className="flex items-center gap-4 rounded-xl border border-ink-900/6 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900/5 text-sm font-bold text-ink-950">{d.score}/{d.maxScore}</div>
                <div>
                  <p className="text-sm font-semibold text-ink-950">{d.category}</p>
                  <p className="text-xs text-ink-600">{d.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeView === "users" && <DataTable data={sec.users} columns={securityUserColumns} searchPlaceholder="Filter security users..." />}
        {activeView === "admins" && <DataTable data={sec.adminRoles} columns={adminRoleColumns} searchPlaceholder="Filter admin roles..." />}
      </section>
    </div>
  );
}

/* ── Shared components ── */

function DatasetPanel({ title, dataset, snapshot, onExport, children }: { title: string; dataset: DatasetKey; snapshot: TenantReportSnapshot; onExport: PanelExport; children: ReactNode }) {
  return (
    <section className="glass-panel rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold tracking-tight text-ink-950">{title}</h2>
        <ExportButtons dataset={dataset} onExport={(d, f) => onExport(snapshot, d, f)} />
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

function ChartCard({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="rounded-2xl border border-ink-900/6 bg-white p-5">
      <div className="mb-3">
        <h3 className="text-sm font-bold text-ink-950">{title}</h3>
        <p className="text-xs text-ink-500">{subtitle}</p>
      </div>
      <div className="h-64">{children}</div>
    </div>
  );
}

function InsightCard({ title, status, metric, note, accent }: { title: string; status: string; metric: string; note?: string; accent: string }) {
  const colorMap: Record<string, string> = { sky: "bg-sky-500/10 text-sky-500", violet: "bg-violet-500/10 text-violet-500", mint: "bg-mint-500/10 text-mint-500" };
  return (
    <div className="rounded-2xl border border-ink-900/6 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`icon-container ${colorMap[accent] ?? colorMap.sky}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-ink-500">{title}</p>
          <p className="text-lg font-bold text-ink-950">{metric}</p>
        </div>
      </div>
      {status === "unavailable" && note && <p className="mt-2 text-xs text-ink-500">{note}</p>}
    </div>
  );
}

function UnavailablePanel({ title, note }: { title: string; note?: string }) {
  return (
    <section className="glass-panel rounded-2xl p-8 text-center">
      <div className="mx-auto max-w-sm">
        <div className="mb-4 flex justify-center"><div className="icon-container-lg bg-ink-900/5 text-ink-500"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg></div></div>
        <h2 className="text-lg font-bold text-ink-950">{title}</h2>
        <p className="mt-2 text-sm text-ink-600">{note ?? "This report requires Reports.Read.All permission and a supported Microsoft Entra role."}</p>
      </div>
    </section>
  );
}

function PermissionPill({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span className={`badge text-[10px] ${granted ? "badge-mint" : "badge-amber"}`}>
      {granted
        ? <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        : <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /></svg>}
      {label}
    </span>
  );
}

/* ── Helpers ── */

const tooltipStyle = { borderRadius: "10px", border: "1px solid rgba(22,39,66,0.08)", boxShadow: "0 4px 12px rgba(7,17,31,0.06)", fontSize: "12px" };

function toActivityTableRows(dataset: ActivityDataset) {
  return dataset.rows.map((row) => ({ primaryId: row.primaryId, displayName: row.displayName, lastActivityDate: row.lastActivityDate ?? "", ...row.metrics }));
}

function buildActivityColumns(dataset: ActivityDataset): ColumnDef<Record<string, unknown>>[] {
  const firstRow = toActivityTableRows(dataset)[0] ?? {};
  return Object.keys(firstRow).map((key) => ({ accessorKey: key, header: key, cell: ({ row }) => String(row.original[key] ?? "") }));
}

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}
