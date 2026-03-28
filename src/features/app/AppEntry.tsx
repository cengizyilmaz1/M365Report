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

const tabs: Array<{ id: DatasetKey; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "users", label: "Users" },
  { id: "licenses", label: "Licenses" },
  { id: "groups", label: "Groups" },
  { id: "mailboxes", label: "Mailboxes" },
  { id: "activity", label: "Activity" }
];

const userColumns: ColumnDef<UserReportRow>[] = [
  { accessorKey: "displayName", header: "Display name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "mail", header: "Mail" },
  {
    accessorKey: "accountEnabled",
    header: "Account",
    cell: ({ row }) => (row.original.accountEnabled ? "Enabled" : "Disabled")
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
  { accessorKey: "capabilityStatus", header: "Capability status" },
  { accessorKey: "total", header: "Total" },
  { accessorKey: "consumed", header: "Consumed" },
  { accessorKey: "available", header: "Available" }
];

const groupColumns: ColumnDef<GroupReportRow>[] = [
  { accessorKey: "groupName", header: "Group name" },
  { accessorKey: "groupType", header: "Group type" },
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
    cell: ({ row }) => (row.original.isShared ? "Yes" : "No")
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
  const [collectionEnabled, setCollectionEnabled] = useState(true);
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

  const refreshReports = () => {
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

  const handleExport = (snapshot: TenantReportSnapshot, dataset: DatasetKey, format: ExportFormat) => {
    const artifact = exportDataset(snapshot, dataset, format);
    void artifact.then(setLastExport);
    return artifact;
  };

  if (auth.status === "loading") {
    return <WorkspaceShell title="Preparing the reporting workspace" body="Loading runtime configuration and Microsoft Entra session state." />;
  }

  if (auth.status === "misconfigured") {
    return (
      <WorkspaceShell
        title="Runtime configuration is still using placeholders"
        body="Update runtime-config.json or let the deploy workflow materialize it from repository variables before using the authenticated workspace."
      />
    );
  }

  if (auth.status === "error") {
    return <WorkspaceShell title="Authentication bootstrap failed" body={auth.error ?? "Unknown authentication error."} />;
  }

  if (auth.status === "unauthenticated") {
    return (
      <WorkspaceShell
        title="Sign in before generating a tenant snapshot"
        body="The app only collects Microsoft Graph data after delegated sign-in succeeds. No tenant report data is stored outside the current browser session."
        action={
          <button
            type="button"
            onClick={() => void auth.signIn()}
            className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
          >
            Sign in with Microsoft Entra
          </button>
        }
      />
    );
  }

  const snapshot = snapshotQuery.data;

  return (
    <div className="page-frame py-8">
      <section className="glass-panel rounded-[2rem] p-6 md:p-8">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">Authenticated workspace</p>
            <h1 className="text-3xl font-semibold text-ink-950 md:text-4xl">Microsoft 365 tenant reporting</h1>
            <p className="max-w-2xl text-sm leading-7 text-ink-700">
              Signed in as <strong>{auth.account?.username}</strong>. Data is collected from Microsoft Graph only inside this active session.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={refreshReports}
              className="rounded-full bg-ink-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-800"
            >
              Generate or refresh reports
            </button>
            <button
              type="button"
              onClick={clearSessionData}
              className="rounded-full border border-ink-900/10 px-4 py-3 text-sm font-semibold text-ink-800 transition hover:border-ink-900/25 hover:bg-white"
            >
              Clear session data
            </button>
            {!auth.permissionProfile.advancedAudit.granted && auth.permissionProfile.advancedAudit.requested && (
              <button
                type="button"
                onClick={() => void auth.enableAdvancedAudit()}
                className="rounded-full border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-sm font-semibold text-sky-500 transition hover:border-sky-500/50"
              >
                Enable last sign-in summary
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                reactQueryClient.clear();
                void auth.signOut();
              }}
              className="rounded-full border border-ink-900/10 px-4 py-3 text-sm font-semibold text-ink-800 transition hover:border-ink-900/25 hover:bg-white"
            >
              Sign out
            </button>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3 text-xs font-semibold uppercase tracking-[0.16em] text-ink-700">
          <PermissionPill label="Core" granted={auth.permissionProfile.core.granted} />
          <PermissionPill label="Reports" granted={auth.permissionProfile.reports.granted} />
          <PermissionPill label="Advanced audit" granted={auth.permissionProfile.advancedAudit.granted} />
        </div>

        {lastExport && (
          <p className="mt-6 rounded-2xl bg-mint-400/10 px-4 py-3 text-sm text-ink-800">
            Exported <strong>{lastExport.filename}</strong> ({formatNumber(lastExport.byteLength)} bytes).
          </p>
        )}

        {snapshotQuery.isLoading && (
          <p className="mt-6 rounded-2xl bg-sky-500/10 px-4 py-3 text-sm text-ink-800">
            Collecting users, licenses, groups, mailbox purposes, and workload reports.
          </p>
        )}

        {snapshotQuery.isError && (
          <p className="mt-6 rounded-2xl bg-rose-400/10 px-4 py-3 text-sm text-ink-800">
            {(snapshotQuery.error as Error).message}
          </p>
        )}
      </section>

      {snapshot ? (
        <div className="mt-8 space-y-8">
          {snapshot.warnings.length > 0 && (
            <section className="rounded-[1.75rem] border border-amber-400/40 bg-amber-400/10 p-5">
              <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-ink-900">Collection warnings</h2>
              <ul className="mt-3 space-y-2 text-sm leading-7 text-ink-800">
                {snapshot.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </section>
          )}

          <nav className="flex flex-wrap gap-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.id))}
                className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                  activeTab === tab.id
                    ? "bg-ink-900 text-white"
                    : "border border-ink-900/10 bg-white text-ink-700 hover:border-ink-900/25"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === "overview" && <OverviewPanel snapshot={snapshot} onExport={handleExport} />}
          {activeTab === "users" && (
            <DatasetPanel title="Users report" dataset="users" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.users} columns={userColumns} searchPlaceholder="Filter users" />
            </DatasetPanel>
          )}
          {activeTab === "licenses" && (
            <DatasetPanel title="License report" dataset="licenses" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.licenses} columns={licenseColumns} searchPlaceholder="Filter licenses" />
            </DatasetPanel>
          )}
          {activeTab === "groups" && (
            <DatasetPanel title="Groups report" dataset="groups" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.groups} columns={groupColumns} searchPlaceholder="Filter groups" />
            </DatasetPanel>
          )}
          {activeTab === "mailboxes" && (
            <DatasetPanel title="Mailbox purpose report" dataset="mailboxes" snapshot={snapshot} onExport={handleExport}>
              <DataTable data={snapshot.mailboxes} columns={mailboxColumns} searchPlaceholder="Filter mailbox rows" />
            </DatasetPanel>
          )}
          {activeTab === "activity" && <ActivityPanel snapshot={snapshot} onExport={handleExport} />}
        </div>
      ) : (
        !snapshotQuery.isLoading && (
          <section className="mt-8 rounded-[1.75rem] border border-ink-900/8 bg-white p-8 text-center">
            <h2 className="text-2xl font-semibold text-ink-950">No in-session data is loaded</h2>
            <p className="mt-3 text-sm leading-7 text-ink-700">
              Use the generate button to collect a fresh tenant snapshot. The results will remain in memory only until you clear the session, refresh, or close the tab.
            </p>
          </section>
        )
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
    { name: "Licensed users", value: snapshot.overview.licensedUsers, color: "#1f9cf0" },
    { name: "Unlicensed users", value: snapshot.overview.unlicensedUsers, color: "#f2c14e" },
    { name: "Shared mailboxes", value: snapshot.overview.sharedMailboxes, color: "#2fd38c" }
  ];

  const licenseBars = snapshot.licenses.slice(0, 8).map((row) => ({
    name: row.skuPartNumber,
    Consumed: row.consumed,
    Available: row.available
  }));

  return (
    <div className="space-y-8">
      <DatasetPanel title="Overview dashboard" dataset="overview" snapshot={snapshot} onExport={onExport}>
        <div className="grid gap-4 lg:grid-cols-4">
          <MetricCard
            label="Total users"
            value={formatNumber(snapshot.overview.totalUsers)}
            detail="All directory users returned by Microsoft Graph."
          />
          <MetricCard
            label="Licensed users"
            value={formatNumber(snapshot.overview.licensedUsers)}
            detail="Users with at least one assigned license."
            accent="positive"
          />
          <MetricCard
            label="Groups"
            value={formatNumber(snapshot.overview.groupCount)}
            detail={`${formatNumber(snapshot.overview.totalGroupMembers)} direct members counted across all groups.`}
          />
          <MetricCard
            label="Shared mailboxes"
            value={formatNumber(snapshot.overview.sharedMailboxes)}
            detail={`${formatNumber(snapshot.overview.unknownMailboxPurposes)} accounts have an unknown mailbox purpose.`}
            accent="warning"
          />
          <MetricCard
            label="Purchased licenses"
            value={formatNumber(snapshot.overview.totalPurchasedLicenses)}
            detail="Calculated from subscribedSkus prepaid units."
          />
          <MetricCard
            label="Consumed licenses"
            value={formatNumber(snapshot.overview.consumedLicenses)}
            detail="Live consumedUnits total across all returned SKUs."
            accent="positive"
          />
          <MetricCard
            label="Available licenses"
            value={formatNumber(snapshot.overview.availableLicenses)}
            detail="Purchased capacity minus consumed units."
          />
          <MetricCard
            label="Last updated"
            value={formatDateTime(snapshot.overview.lastUpdatedAt)}
            detail="This timestamp reflects the current in-browser snapshot."
          />
        </div>

        <div className="mt-8 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="rounded-[1.75rem] border border-ink-900/8 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-ink-950">User and mailbox mix</h3>
              <p className="text-sm leading-7 text-ink-700">Licensed vs unlicensed user distribution with shared mailbox count.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={userMix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={98}>
                    {userMix.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-[1.75rem] border border-ink-900/8 bg-white p-5">
            <div className="mb-4">
              <h3 className="text-lg font-semibold text-ink-950">Top license capacity</h3>
              <p className="text-sm leading-7 text-ink-700">First eight SKUs by name, comparing consumed vs available seats.</p>
            </div>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={licenseBars}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" hide />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="Consumed" fill="#1f9cf0" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="Available" fill="#2fd38c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {snapshot.lastSignInSummary && (
          <div className="mt-8 rounded-[1.75rem] border border-ink-900/8 bg-white p-5">
            <h3 className="text-lg font-semibold text-ink-950">Last sign-in summary</h3>
            <p className="mt-2 text-sm leading-7 text-ink-700">
              {snapshot.lastSignInSummary.status === "available"
                ? `${formatNumber(snapshot.lastSignInSummary.signedInLast30Days)} users recorded a sign-in during the last 30 days.`
                : snapshot.lastSignInSummary.note}
            </p>
          </div>
        )}
      </DatasetPanel>
    </div>
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
      <div className="space-y-6">
        {snapshot.activity.map((dataset) => (
          <article key={dataset.workload} className="rounded-[1.75rem] border border-ink-900/8 bg-white p-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-ink-950">{dataset.title}</h3>
                <p className="mt-2 text-sm leading-7 text-ink-700">
                  {dataset.status === "available"
                    ? `${formatNumber(dataset.rows.length)} rows collected from the current workload export.`
                    : dataset.note}
                </p>
              </div>
              <span
                className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] ${
                  dataset.status === "available"
                    ? "bg-mint-400/15 text-ink-900"
                    : dataset.status === "unavailable"
                      ? "bg-amber-400/15 text-ink-900"
                      : "bg-rose-400/15 text-ink-900"
                }`}
              >
                {dataset.status}
              </span>
            </div>
            {dataset.rows.length > 0 && (
              <div className="mt-4">
                <DataTable
                  data={toActivityTableRows(dataset)}
                  columns={buildActivityColumns(dataset)}
                  searchPlaceholder={`Filter ${dataset.title}`}
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
    <section className="glass-panel rounded-[2rem] p-6 md:p-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-ink-950">{title}</h2>
          <p className="mt-2 text-sm leading-7 text-ink-700">
            Review live normalized data and export this dataset without persisting a server-side copy.
          </p>
        </div>
        <ExportButtons dataset={dataset} onExport={(selectedDataset, format) => onExport(snapshot, selectedDataset, format)} />
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function WorkspaceShell({
  title,
  body,
  action
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-frame py-16">
      <section className="glass-panel rounded-[2rem] p-8 text-center md:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">M365 Tenant Reporter</p>
        <h1 className="mt-4 text-3xl font-semibold text-ink-950">{title}</h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-ink-700">{body}</p>
        {action ? <div className="mt-8 flex justify-center">{action}</div> : null}
      </section>
    </div>
  );
}

function PermissionPill({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span
      className={`rounded-full px-3 py-2 ${
        granted ? "bg-mint-400/15 text-ink-900" : "bg-amber-400/15 text-ink-900"
      }`}
    >
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
