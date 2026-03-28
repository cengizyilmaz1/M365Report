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
  { accessorKey: "assignedLicenseCount", header: "Licenses" },
  {
    accessorKey: "assignedSkuNames",
    header: "Assigned SKUs",
    cell: ({ row }) => row.original.assignedSkuNames.join(", ")
  },
  {
    accessorKey: "lastSuccessfulSignIn",
    header: "Last sign-in",
    cell: ({ row }) => formatDateTime(row.original.lastSuccessfulSignIn)
  }
];

const licenseColumns: ColumnDef<LicenseReportRow>[] = [
  { accessorKey: "friendlyName", header: "License" },
  { accessorKey: "skuPartNumber", header: "SKU" },
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
    header: "Type",
    cell: ({ row }) => <span className="badge badge-neutral">{row.original.groupType}</span>
  },
  {
    accessorKey: "mailEnabled",
    header: "Mail",
    cell: ({ row }) => (row.original.mailEnabled ? "Yes" : "No")
  },
  {
    accessorKey: "securityEnabled",
    header: "Security",
    cell: ({ row }) => (row.original.securityEnabled ? "Yes" : "No")
  },
  { accessorKey: "memberCount", header: "Members" }
];

const mailboxColumns: ColumnDef<MailboxReportRow>[] = [
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  { accessorKey: "purpose", header: "Purpose" },
  {
    accessorKey: "isShared",
    header: "Shared",
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
      <div className="page-frame flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin text-sky-500">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          <p className="text-sm text-ink-600">Loading session...</p>
        </div>
      </div>
    );
  }

  if (auth.status === "misconfigured") {
    return (
      <div className="page-frame flex min-h-[50vh] items-center justify-center">
        <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="icon-container-lg bg-amber-500/10 text-amber-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-ink-950">Configuration required</h2>
          <p className="mt-2 text-sm text-ink-600">Update runtime-config.json with your deployment values.</p>
        </div>
      </div>
    );
  }

  if (auth.status === "error") {
    return (
      <div className="page-frame flex min-h-[50vh] items-center justify-center">
        <div className="glass-panel max-w-md rounded-2xl p-8 text-center">
          <div className="mb-4 flex justify-center">
            <div className="icon-container-lg bg-rose-400/10 text-rose-500">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            </div>
          </div>
          <h2 className="text-lg font-bold text-ink-950">Authentication failed</h2>
          <p className="mt-2 text-sm text-ink-600">{auth.error ?? "Unknown error."}</p>
          <a href={withBase("/login")} className="btn-primary mt-6 inline-flex text-sm">Try again</a>
        </div>
      </div>
    );
  }

  if (auth.status === "unauthenticated") {
    return (
      <div className="page-frame flex min-h-[50vh] items-center justify-center">
        <div className="glass-panel max-w-sm rounded-3xl p-8 text-center animate-fade-up">
          <div className="mb-5 flex justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-sky-500 to-violet-500 shadow-lg shadow-sky-500/20">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                <polyline points="10 17 15 12 10 7" />
                <line x1="15" y1="12" x2="3" y2="12" />
              </svg>
            </span>
          </div>
          <h2 className="text-xl font-bold tracking-tight text-ink-950" style={{ fontFamily: "var(--font-display)" }}>Sign in to continue</h2>
          <p className="mt-2 text-sm text-ink-600">Connect your Microsoft 365 tenant to generate reports.</p>

          <button
            type="button"
            onClick={() => void auth.signIn()}
            className="btn-primary mt-6 w-full justify-center py-3"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Sign in with Microsoft Entra
          </button>

          {auth.error && (
            <p className="mt-4 rounded-xl bg-rose-500/8 px-3 py-2 text-sm text-rose-500">{auth.error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="page-frame space-y-4">
      {/* Top bar */}
      <section className="glass-panel rounded-2xl px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-violet-500 text-white">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
              </svg>
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
            <button type="button" onClick={generateReport} className="btn-primary py-2 px-4 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                <polyline points="17 6 23 6 23 12" />
              </svg>
              {reportButtonLabel}
            </button>
            {!auth.permissionProfile.advancedAudit.granted && auth.permissionProfile.advancedAudit.requested && (
              <button type="button" onClick={() => void auth.enableAdvancedAudit()} className="badge badge-violet cursor-pointer hover:opacity-80">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                Enable sign-in data
              </button>
            )}
            <button type="button" onClick={clearSessionData} className="btn-secondary py-2 px-4 text-xs">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
              Clear
            </button>
            <button
              type="button"
              onClick={() => { reactQueryClient.clear(); void auth.signOut(); }}
              className="btn-secondary py-2 px-4 text-xs"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
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
            Collecting tenant snapshot...
          </div>
        )}
        {snapshotQuery.isError && (
          <div className="mt-3 flex items-center gap-2 rounded-xl bg-rose-500/8 border border-rose-500/15 px-3 py-2 text-sm text-ink-800">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-rose-500 shrink-0"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
            {(snapshotQuery.error as Error).message}
          </div>
        )}
      </section>

      {/* Empty state */}
      {!snapshot && !snapshotQuery.isLoading && (
        <section className="glass-panel rounded-2xl p-8 text-center">
          <div className="mx-auto max-w-sm">
            <div className="mb-4 flex justify-center">
              <div className="icon-container-lg bg-sky-500/10 text-sky-500">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>
              </div>
            </div>
            <h2 className="text-lg font-bold text-ink-950">No report yet</h2>
            <p className="mt-2 text-sm text-ink-600">Click "Generate report" to collect a fresh tenant snapshot from Microsoft Graph.</p>
          </div>
        </section>
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

          <nav className="flex flex-wrap gap-1 rounded-xl bg-white/60 border border-ink-900/6 p-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.id))}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-ink-900 text-white shadow-sm"
                    : "text-ink-600 hover:text-ink-900 hover:bg-white"
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={tab.icon} /></svg>
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && <OverviewPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "users" && (
            <DatasetPanel title="Users" dataset="users" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.users} columns={userColumns} searchPlaceholder="Filter users..." />
            </DatasetPanel>
          )}
          {activeTab === "licenses" && (
            <DatasetPanel title="Licenses" dataset="licenses" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.licenses} columns={licenseColumns} searchPlaceholder="Filter licenses..." />
            </DatasetPanel>
          )}
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
        </div>
      )}
    </div>
  );
}

function OverviewPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: (s: TenantReportSnapshot, d: DatasetKey, f: ExportFormat) => Promise<ExportArtifact> }) {
  const userMix = [
    { name: "Licensed", value: snapshot.overview.licensedUsers, color: "#0ea5e9" },
    { name: "Unlicensed", value: snapshot.overview.unlicensedUsers, color: "#fbbf24" },
    { name: "Shared", value: snapshot.overview.sharedMailboxes, color: "#10b981" }
  ];
  const licenseBars = snapshot.licenses.slice(0, 8).map((r) => ({ name: r.friendlyName, Consumed: r.consumed, Available: r.available }));

  return (
    <DatasetPanel title="Overview" dataset="overview" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total users" value={formatNumber(snapshot.overview.totalUsers)} detail="All users from Microsoft Graph." />
        <MetricCard label="Licensed" value={formatNumber(snapshot.overview.licensedUsers)} detail="At least one assigned license." accent="positive" />
        <MetricCard label="Groups" value={formatNumber(snapshot.overview.groupCount)} detail={`${formatNumber(snapshot.overview.totalGroupMembers)} total members.`} />
        <MetricCard label="Shared mailboxes" value={formatNumber(snapshot.overview.sharedMailboxes)} detail={`${formatNumber(snapshot.overview.unknownMailboxPurposes)} unknown.`} accent="warning" />
        <MetricCard label="Purchased" value={formatNumber(snapshot.overview.totalPurchasedLicenses)} detail="From subscribedSkus." />
        <MetricCard label="Consumed" value={formatNumber(snapshot.overview.consumedLicenses)} detail="Across all SKUs." accent="positive" />
        <MetricCard label="Available" value={formatNumber(snapshot.overview.availableLicenses)} detail="Purchased minus consumed." />
        <MetricCard label="Snapshot" value={formatDateTime(snapshot.overview.lastUpdatedAt)} detail="Current session timestamp." />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="User mix" subtitle="Licensed vs unlicensed">
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

function ActivityPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: (s: TenantReportSnapshot, d: DatasetKey, f: ExportFormat) => Promise<ExportArtifact> }) {
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
                  {ds.status === "available" ? (
                    <p className="mt-1 text-xs text-ink-600">{formatNumber(ds.rows.length)} rows collected</p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-500">
                      {ds.note?.includes("Reports.Read.All")
                        ? "Requires Reports Reader role"
                        : ds.note?.includes("redirected workload CSV")
                          ? "Requires Reports Reader role or direct CSV access"
                          : ds.note ?? "Not available"}
                    </p>
                  )}
                </div>
              </div>
              <span className={`badge text-[10px] ${ds.status === "available" ? "badge-mint" : "badge-neutral"}`}>
                {ds.status === "available" ? "Ready" : "N/A"}
              </span>
            </div>
            {ds.rows.length > 0 && (
              <div className="mt-4">
                <DataTable data={toActivityTableRows(ds)} columns={buildActivityColumns(ds)} searchPlaceholder={`Filter ${ds.title}...`} />
              </div>
            )}
          </article>
        ))}
      </div>
    </DatasetPanel>
  );
}

function DatasetPanel({ title, dataset, snapshot, onExport, children }: { title: string; dataset: DatasetKey; snapshot: TenantReportSnapshot; onExport: (s: TenantReportSnapshot, d: DatasetKey, f: ExportFormat) => Promise<ExportArtifact>; children: ReactNode }) {
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

function PermissionPill({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span className={`badge text-[10px] ${granted ? "badge-mint" : "badge-amber"}`}>
      {granted ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18" /></svg>
      )}
      {label}
    </span>
  );
}

const tooltipStyle = { borderRadius: "10px", border: "1px solid rgba(22,39,66,0.08)", boxShadow: "0 4px 12px rgba(7,17,31,0.06)", fontSize: "12px" };

function toActivityTableRows(dataset: ActivityDataset) {
  return dataset.rows.map((row) => ({ primaryId: row.primaryId, displayName: row.displayName, lastActivityDate: row.lastActivityDate ?? "", ...row.metrics }));
}

function buildActivityColumns(dataset: ActivityDataset): ColumnDef<Record<string, unknown>>[] {
  const firstRow = toActivityTableRows(dataset)[0] ?? {};
  return Object.keys(firstRow).map((key) => ({ accessorKey: key, header: key, cell: ({ row }) => String(row.original[key] ?? "") }));
}
