import { startTransition, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider, useQuery, useQueryClient } from "@tanstack/react-query";
import type { ColumnDef } from "@tanstack/react-table";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";
import { DataTable } from "@/components/app/DataTable";
import { DetailDialog } from "@/components/app/DetailDialog";
import {
  GroupDetailContent,
  InlineError,
  LoadingDetail,
  NotesBanner,
  UserDetailContent
} from "@/components/app/DetailViews";
import { ExportButtons } from "@/components/app/ExportButtons";
import { MetricCard } from "@/components/app/MetricCard";
import { useAuthSession } from "@/features/auth/useAuthSession";
import { exportDataset } from "@/features/exports/exporters";
import type { DatasetKey, ExportFormat } from "@/features/exports/exporters";
import {
  collectGroupReportDetail,
  collectUserReportDetail
} from "@/features/reporting/detail-service";
import {
  BROWSER_ONLY_ONEDRIVE_NOTE,
  BROWSER_ONLY_REPORTS_NOTE,
  collectTenantReportSnapshot
} from "@/features/reporting/report-service";
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
  TenantInfo,
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

type TabId =
  | "overview"
  | "users"
  | "licenses"
  | "groups"
  | "mailboxes"
  | "activity"
  | "sharepoint"
  | "onedrive"
  | "security";

type PanelExport = (snapshot: TenantReportSnapshot, dataset: DatasetKey, format: ExportFormat) => Promise<ExportArtifact>;

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

const licenseServiceColumns: ColumnDef<LicenseServiceRow>[] = [
  { accessorKey: "displayName", header: "User" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "friendlyName", header: "License" },
  { accessorKey: "servicePlanName", header: "Service plan" },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => (
      <span className={`badge ${row.original.status === "Enabled" ? "badge-mint" : "badge-amber"}`}>
        {row.original.status}
      </span>
    )
  }
];

const mailboxColumns: ColumnDef<MailboxReportRow>[] = [
  { accessorKey: "displayName", header: "Name" },
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
  }
];

const sharePointColumns: ColumnDef<SharePointSiteRow>[] = [
  {
    accessorKey: "siteName",
    header: "Site",
    cell: ({ row }) => (
      <div>
        <p className="font-semibold text-ink-950">{row.original.siteName}</p>
        <p className="mt-1 text-xs text-ink-500">{row.original.groupName}</p>
      </div>
    )
  },
  { accessorKey: "siteUrl", header: "Library URL" },
  {
    accessorKey: "lastModifiedDate",
    header: "Last modified",
    cell: ({ row }) => formatDateTime(row.original.lastModifiedDate || null)
  },
  {
    accessorKey: "storageUsedBytes",
    header: "Used",
    cell: ({ row }) => formatStorageSize(row.original.storageUsedBytes)
  },
  {
    accessorKey: "storageRemainingBytes",
    header: "Remaining",
    cell: ({ row }) => formatStorageSize(row.original.storageRemainingBytes)
  },
  {
    accessorKey: "driveState",
    header: "Quota state",
    cell: ({ row }) => <span className="badge badge-neutral">{row.original.driveState}</span>
  }
];

const oneDriveColumns: ColumnDef<OneDriveAccountRow>[] = [
  { accessorKey: "ownerDisplayName", header: "Owner" },
  { accessorKey: "ownerPrincipalName", header: "UPN" },
  { accessorKey: "lastActivityDate", header: "Last activity" },
  { accessorKey: "fileCount", header: "Files" },
  {
    accessorKey: "storageUsedBytes",
    header: "Storage (MB)",
    cell: ({ row }) => formatNumber(Math.round(row.original.storageUsedBytes / 1048576))
  },
  {
    accessorKey: "isActive",
    header: "Active",
    cell: ({ row }) => (
      <span className={`badge ${row.original.isActive ? "badge-mint" : "badge-amber"}`}>
        {row.original.isActive ? "Yes" : "No"}
      </span>
    )
  }
];

const securityUserColumns: ColumnDef<SecurityUserRow>[] = [
  { accessorKey: "displayName", header: "Name" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  { accessorKey: "userType", header: "Type" },
  {
    accessorKey: "mfaRegistered",
    header: "MFA",
    cell: ({ row }) => (
      <span className={`badge ${row.original.mfaRegistered ? "badge-mint" : "badge-amber"}`}>
        {row.original.mfaRegistered ? "Yes" : "No"}
      </span>
    )
  },
  { accessorKey: "methodsRegistered", header: "Methods", cell: ({ row }) => row.original.methodsRegistered.join(", ") || "—" },
  { accessorKey: "isInactive", header: "Inactive", cell: ({ row }) => row.original.isInactive ? <span className="badge badge-amber">Yes</span> : "No" },
  { accessorKey: "inactiveDays", header: "Days", cell: ({ row }) => row.original.inactiveDays >= 0 ? row.original.inactiveDays : "—" },
  { accessorKey: "isLicensed", header: "Licensed", cell: ({ row }) => row.original.isLicensed ? "Yes" : "No" }
];

const adminRoleColumns: ColumnDef<AdminRoleRow>[] = [
  { accessorKey: "roleDisplayName", header: "Role" },
  { accessorKey: "userDisplayName", header: "User" },
  { accessorKey: "userPrincipalName", header: "UPN" },
  {
    accessorKey: "mfaRegistered",
    header: "MFA",
    cell: ({ row }) => (
      <span className={`badge ${row.original.mfaRegistered ? "badge-mint" : "badge-amber"}`}>
        {row.original.mfaRegistered ? "Yes" : "No"}
      </span>
    )
  }
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
    const handleBeforeUnload = () => {
      reactQueryClient.clear();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [reactQueryClient]);

  const snapshotQuery = useQuery({
    queryKey: [
      "tenant-snapshot",
      auth.account?.homeAccountId ?? "anonymous",
      auth.permissionProfile.reports.granted,
      auth.permissionProfile.advancedAudit.granted,
      auth.permissionProfile.sites.granted
    ],
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

  if (auth.status === "loading") {
    return <CenteredStatus title="Initializing session..." tone="neutral" animated />;
  }

  if (auth.status === "misconfigured") {
    return <CenteredStatus title="Configuration required" note="Update runtime-config.json with your deployment values." tone="warning" />;
  }

  if (auth.status === "error") {
    return (
      <CenteredStatus
        title="Authentication failed"
        note={auth.error ?? "Unknown error."}
        tone="error"
        action={<a href={withBase("/login")} className="btn-primary mt-6 inline-flex text-sm">Try again</a>}
      />
    );
  }

  if (auth.status === "unauthenticated") {
    window.location.href = withBase("/login");
    return <CenteredStatus title="Redirecting to sign in..." tone="neutral" animated />;
  }

  return (
    <div className="page-frame space-y-4 pb-8">
      <WorkspaceHeader
        auth={auth}
        lastExport={lastExport}
        isLoading={snapshotQuery.isLoading}
        isError={snapshotQuery.isError}
        errorMessage={snapshotQuery.isError ? (snapshotQuery.error as Error).message : undefined}
        onRefresh={refreshReport}
        onSignOut={() => {
          reactQueryClient.clear();
          void auth.signOut();
        }}
      />

      {snapshotQuery.isLoading && !snapshot && <LoadingCards />}
      {snapshot?.tenantInfo && <TenantInfoBanner info={snapshot.tenantInfo} />}
      {snapshot && <WorkspacePanels snapshot={snapshot} activeTab={activeTab} setActiveTab={setActiveTab} onExport={handleExport} acquireGraphToken={auth.acquireGraphToken} />}
    </div>
  );
}

function WorkspaceHeader({
  auth,
  lastExport,
  isLoading,
  isError,
  errorMessage,
  onRefresh,
  onSignOut
}: {
  auth: ReturnType<typeof useAuthSession>;
  lastExport: ExportArtifact | null;
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  onRefresh: () => void;
  onSignOut: () => void;
}) {
  return (
    <header className="glass-panel rounded-2xl px-5 py-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-linear-to-br from-sky-500 to-violet-500 text-white">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
            </svg>
          </span>
          <div>
            <h1 className="text-base font-bold tracking-tight text-ink-950">Tenant dashboard</h1>
            <p className="text-xs text-ink-500">{auth.account?.username}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <PermissionPill label="Core" granted={auth.permissionProfile.core.granted} />
          <PermissionPill label="Reports" granted={auth.permissionProfile.reports.granted} />
          <PermissionPill label="Audit" granted={auth.permissionProfile.advancedAudit.granted} />
          <PermissionPill label="Sites" granted={auth.permissionProfile.sites.granted} />
          <div className="mx-1 hidden h-5 w-px bg-ink-900/8 lg:block" />
          <button type="button" onClick={onRefresh} className="btn-primary px-4 py-2 text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="23 4 23 10 17 10" />
              <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
            </svg>
            Refresh
          </button>
          {!auth.permissionProfile.advancedAudit.granted && auth.permissionProfile.advancedAudit.requested && (
            <button type="button" onClick={() => void auth.enableAdvancedAudit()} className="badge badge-violet cursor-pointer hover:opacity-80">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Enable sign-in data
            </button>
          )}
          <button type="button" onClick={onSignOut} className="btn-secondary px-4 py-2 text-xs">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      </div>

      {lastExport && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-mint-500/15 bg-mint-500/8 px-3 py-2 text-sm text-ink-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-mint-500">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
          Exported <strong>{lastExport.filename}</strong> ({formatNumber(lastExport.byteLength)} bytes)
        </div>
      )}
      {isLoading && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-sky-500/15 bg-sky-500/8 px-3 py-2 text-sm text-ink-700">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 animate-spin text-sky-500">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
          Collecting users, licenses, groups, SharePoint inventory, and security insights...
        </div>
      )}
      {isError && errorMessage && (
        <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-500/15 bg-rose-500/8 px-3 py-2 text-sm text-ink-800">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="shrink-0 text-rose-500">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          {errorMessage}
        </div>
      )}
    </header>
  );
}

function WorkspacePanels({
  snapshot,
  activeTab,
  setActiveTab,
  onExport,
  acquireGraphToken
}: {
  snapshot: TenantReportSnapshot;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  onExport: PanelExport;
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit" | "sites") => Promise<string>;
}) {
  return (
    <div className="space-y-4">
      {snapshot.notes.length > 0 && <NotesBanner notes={snapshot.notes} />}

      <nav className="flex flex-wrap gap-1 rounded-xl border border-ink-900/6 bg-white/60 p-1">
        {tabs.map((tab, index) => {
          const prevGroup = index > 0 ? tabs[index - 1].group : null;
          const showDivider = tab.group !== prevGroup && index > 0;
          return (
            <div key={tab.id} className="flex items-center">
              {showDivider && <div className="mx-1 h-5 w-px bg-ink-900/10" />}
              <button
                type="button"
                onClick={() => startTransition(() => setActiveTab(tab.id))}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                  activeTab === tab.id ? "bg-ink-900 text-white shadow-sm" : "text-ink-600 hover:bg-white hover:text-ink-900"
                }`}
              >
                {tab.label}
              </button>
            </div>
          );
        })}
      </nav>

      {activeTab === "overview" && <OverviewPanel snapshot={snapshot} onExport={onExport} />}
      {activeTab === "users" && <UsersPanel snapshot={snapshot} onExport={onExport} acquireGraphToken={acquireGraphToken} />}
      {activeTab === "licenses" && <LicensesPanel snapshot={snapshot} onExport={onExport} />}
      {activeTab === "groups" && <GroupsPanel snapshot={snapshot} onExport={onExport} acquireGraphToken={acquireGraphToken} />}
      {activeTab === "mailboxes" && (
        <DatasetPanel title="Mailboxes" dataset="mailboxes" snapshot={snapshot} onExport={onExport}>
          <DataTable data={snapshot.mailboxes} columns={mailboxColumns} searchPlaceholder="Filter mailboxes..." />
        </DatasetPanel>
      )}
      {activeTab === "activity" && <ActivityPanel snapshot={snapshot} onExport={onExport} />}
      {activeTab === "sharepoint" && <SharePointPanel snapshot={snapshot} onExport={onExport} />}
      {activeTab === "onedrive" && <OneDrivePanel snapshot={snapshot} onExport={onExport} />}
      {activeTab === "security" && <SecurityPanel snapshot={snapshot} onExport={onExport} />}
    </div>
  );
}

function UsersPanel({
  snapshot,
  onExport,
  acquireGraphToken
}: {
  snapshot: TenantReportSnapshot;
  onExport: PanelExport;
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit" | "sites") => Promise<string>;
}) {
  const [selectedUser, setSelectedUser] = useState<UserReportRow | null>(null);
  const skuNameById = new Map(snapshot.licenses.map((license) => [license.skuId.toLowerCase(), license.friendlyName]));
  const detailQuery = useQuery({
    queryKey: ["user-detail", selectedUser?.id ?? "none"],
    enabled: Boolean(selectedUser),
    queryFn: () => collectUserReportDetail(acquireGraphToken, selectedUser!.id, skuNameById)
  });

  const userColumns: ColumnDef<UserReportRow>[] = [
    {
      accessorKey: "displayName",
      header: "User",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-ink-950">{row.original.displayName}</p>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-ink-500">
            <span>{row.original.userPrincipalName}</span>
            <span className={`badge ${row.original.accountEnabled ? "badge-mint" : "badge-neutral"}`}>
              {row.original.accountEnabled ? "Enabled" : "Disabled"}
            </span>
          </div>
        </div>
      )
    },
    { accessorKey: "jobTitle", header: "Job title" },
    { accessorKey: "department", header: "Department" },
    { accessorKey: "companyName", header: "Company" },
    { accessorKey: "officeLocation", header: "Office" },
    { accessorKey: "assignedLicenseCount", header: "Licenses" },
    { accessorKey: "createdDateTime", header: "Created", cell: ({ row }) => formatDateTime(row.original.createdDateTime) },
    { accessorKey: "lastSuccessfulSignIn", header: "Last sign-in", cell: ({ row }) => formatDateTime(row.original.lastSuccessfulSignIn) },
    {
      id: "view",
      header: "Details",
      enableSorting: false,
      cell: ({ row }) => <button type="button" onClick={() => setSelectedUser(row.original)} className="btn-secondary px-3 py-2 text-xs">View</button>
    }
  ];

  return (
    <>
      <DatasetPanel title="Users" dataset="users" snapshot={snapshot} onExport={onExport}>
        <div className="mb-4 rounded-2xl border border-ink-900/6 bg-white px-4 py-3 text-sm text-ink-600">
          Open a user record to inspect richer profile data, mailbox configuration, manager details, and supported read-only limitations for forwarding and quota reporting.
        </div>
        <DataTable data={snapshot.users} columns={userColumns} searchPlaceholder="Filter users..." />
      </DatasetPanel>

      <DetailDialog open={Boolean(selectedUser)} onOpenChange={(open) => !open && setSelectedUser(null)} title={selectedUser?.displayName ?? "User detail"} description="Detailed Microsoft Entra profile and Exchange-backed mailbox settings.">
        {!selectedUser ? null : detailQuery.isLoading ? <LoadingDetail /> : detailQuery.isError ? <InlineError note={(detailQuery.error as Error).message} /> : detailQuery.data ? <UserDetailContent detail={detailQuery.data} /> : null}
      </DetailDialog>
    </>
  );
}

function GroupsPanel({
  snapshot,
  onExport,
  acquireGraphToken
}: {
  snapshot: TenantReportSnapshot;
  onExport: PanelExport;
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit" | "sites") => Promise<string>;
}) {
  const [selectedGroup, setSelectedGroup] = useState<GroupReportRow | null>(null);
  const detailQuery = useQuery({
    queryKey: ["group-detail", selectedGroup?.id ?? "none"],
    enabled: Boolean(selectedGroup),
    queryFn: () => collectGroupReportDetail(acquireGraphToken, selectedGroup!.id)
  });

  const groupColumns: ColumnDef<GroupReportRow>[] = [
    {
      accessorKey: "groupName",
      header: "Group",
      cell: ({ row }) => (
        <div>
          <p className="font-semibold text-ink-950">{row.original.groupName}</p>
          <p className="mt-1 text-xs text-ink-500">{row.original.mail}</p>
        </div>
      )
    },
    { accessorKey: "groupType", header: "Type", cell: ({ row }) => <span className="badge badge-neutral">{row.original.groupType}</span> },
    { accessorKey: "visibility", header: "Visibility" },
    { accessorKey: "memberCount", header: "Members" },
    { accessorKey: "createdDateTime", header: "Created", cell: ({ row }) => formatDateTime(row.original.createdDateTime ?? null) },
    {
      id: "view",
      header: "Details",
      enableSorting: false,
      cell: ({ row }) => <button type="button" onClick={() => setSelectedGroup(row.original)} className="btn-secondary px-3 py-2 text-xs">View</button>
    }
  ];

  return (
    <>
      <DatasetPanel title="Groups" dataset="groups" snapshot={snapshot} onExport={onExport}>
        <div className="mb-4 rounded-2xl border border-ink-900/6 bg-white px-4 py-3 text-sm text-ink-600">
          Open a group to inspect members, owners, role-assignable status, visibility, and dynamic membership configuration.
        </div>
        <DataTable data={snapshot.groups} columns={groupColumns} searchPlaceholder="Filter groups..." />
      </DatasetPanel>

      <DetailDialog open={Boolean(selectedGroup)} onOpenChange={(open) => !open && setSelectedGroup(null)} title={selectedGroup?.groupName ?? "Group detail"} description="Membership, owners, and directory metadata for the selected group.">
        {!selectedGroup ? null : detailQuery.isLoading ? <LoadingDetail /> : detailQuery.isError ? <InlineError note={(detailQuery.error as Error).message} /> : detailQuery.data ? <GroupDetailContent detail={detailQuery.data} /> : null}
      </DetailDialog>
    </>
  );
}

function OverviewPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const overview = snapshot.overview;
  const securityScore = snapshot.security.securityScore.overall;
  const userMix = [
    { name: "Licensed", value: overview.licensedUsers, color: "#0ea5e9" },
    { name: "Unlicensed", value: overview.unlicensedUsers, color: "#fbbf24" },
    { name: "Shared", value: overview.sharedMailboxes, color: "#10b981" },
    { name: "Guests", value: overview.guestUsers, color: "#8b5cf6" }
  ];
  const licenseBars = snapshot.licenses.slice(0, 8).map((row) => ({
    name: row.friendlyName,
    Consumed: row.consumed,
    Available: row.available
  }));

  return (
    <DatasetPanel title="Overview" dataset="overview" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total users" value={formatNumber(overview.totalUsers)} detail={`${formatNumber(overview.guestUsers)} guests, ${formatNumber(overview.disabledUsers)} disabled`} />
        <MetricCard label="Licensed" value={formatNumber(overview.licensedUsers)} detail={`${formatNumber(overview.unlicensedUsers)} unlicensed`} accent="positive" />
        <MetricCard label="Groups" value={formatNumber(overview.groupCount)} detail={`${formatNumber(overview.totalGroupMembers)} direct members`} />
        <MetricCard label="Security score" value={`${securityScore}/100`} detail={securityScore >= 70 ? "Strong posture" : securityScore >= 40 ? "Needs attention" : "Critical gaps"} accent={securityScore >= 70 ? "positive" : "warning"} />
        <MetricCard label="Purchased licenses" value={formatNumber(overview.totalPurchasedLicenses)} detail="From subscribedSkus" />
        <MetricCard label="Consumed" value={formatNumber(overview.consumedLicenses)} detail="Across all SKUs" accent="positive" />
        <MetricCard label="Available" value={formatNumber(overview.availableLicenses)} detail="Purchased minus consumed" />
        <MetricCard label="Shared mailboxes" value={formatNumber(overview.sharedMailboxes)} detail={`${formatNumber(overview.unknownMailboxPurposes)} unknown`} />
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <InsightCard
          title="SharePoint Sites"
          status={snapshot.sharePoint.summary.status}
          metric={snapshot.sharePoint.summary.status === "available" ? `${formatNumber(snapshot.sharePoint.summary.totalSites)} libraries tracked` : "N/A"}
          note={snapshot.sharePoint.summary.note}
          accent="sky"
        />
        <InsightCard
          title="OneDrive"
          status={snapshot.oneDrive.summary.status}
          metric={snapshot.oneDrive.summary.status === "available" ? `${formatNumber(snapshot.oneDrive.summary.totalAccounts)} drives tracked` : "N/A"}
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
        <ChartCard title="User mix" subtitle="Licensed, unlicensed, shared, and guests">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={userMix} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {userMix.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="License capacity" subtitle="Top 8 license families">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
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
            <p className="mt-1 text-xs text-ink-500">{formatNumber(snapshot.licenseServices.length)} service plan rows across all users</p>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setShowServices((value) => !value)} className="btn-secondary px-4 py-2 text-xs">
              {showServices ? "Hide details" : "Show details"}
            </button>
            <ExportButtons dataset="licenseServices" onExport={(dataset, format) => onExport(snapshot, dataset, format)} />
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
  const browserOnlyReportsBlocked = snapshot.activity.every(
    (dataset) => dataset.status === "unavailable" && dataset.note === BROWSER_ONLY_REPORTS_NOTE
  );

  if (browserOnlyReportsBlocked) {
    return <UnavailablePanel title="Activity" note="Microsoft Graph usage detail reports require the Reports Reader admin role and Reports.Read.All permission. If the CSV download redirects cannot be read, ensure your account has the correct Entra role assignment and try refreshing." />;
  }

  return (
    <DatasetPanel title="Activity" dataset="activity" snapshot={snapshot} onExport={onExport}>
      <div className="grid gap-3 sm:grid-cols-2">
        {snapshot.activity.map((dataset) => (
          <article key={dataset.workload} className="rounded-2xl border border-ink-900/6 bg-white p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div className={`icon-container ${dataset.status === "available" ? "bg-mint-500/10 text-mint-500" : "bg-ink-900/5 text-ink-500"}`}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-ink-950">{dataset.title}</h3>
                  {dataset.status === "available" ? (
                    <p className="mt-1 text-xs text-ink-600">{formatNumber(dataset.rows.length)} rows</p>
                  ) : (
                    <p className="mt-1 text-xs text-ink-500">{dataset.note?.includes("Reports.Read.All") ? "Requires Reports Reader role" : dataset.note ?? "Not available"}</p>
                  )}
                </div>
              </div>
              <span className={`badge text-[10px] ${dataset.status === "available" ? "badge-mint" : "badge-neutral"}`}>
                {dataset.status === "available" ? "Ready" : "N/A"}
              </span>
            </div>

            {dataset.rows.length > 0 && (
              <div className="mt-4">
                <DataTable data={toActivityTableRows(dataset)} columns={buildActivityColumns(dataset)} searchPlaceholder={`Filter ${dataset.title}...`} />
              </div>
            )}
          </article>
        ))}
      </div>
    </DatasetPanel>
  );
}

function SharePointPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const sharePoint = snapshot.sharePoint;

  if (sharePoint.summary.status === "unavailable") {
    return <UnavailablePanel title="SharePoint Sites" note={sharePoint.summary.note} />;
  }

  const activityData = [
    { name: "Recently modified", value: sharePoint.summary.activeSites, color: "#0ea5e9" },
    { name: "Older libraries", value: sharePoint.summary.inactiveSites, color: "#fbbf24" }
  ];
  const topSitesByStorage = [...sharePoint.sites]
    .sort((left, right) => right.storageUsedBytes - left.storageUsedBytes)
    .slice(0, 10)
    .map((site) => ({
      name: site.siteName.slice(0, 20),
      GB: Number((site.storageUsedBytes / 1073741824).toFixed(2))
    }));

  return (
    <DatasetPanel title="SharePoint Sites" dataset="sharepoint" snapshot={snapshot} onExport={onExport}>
      {sharePoint.summary.note && (
        <div className="mb-4 rounded-2xl border border-sky-500/15 bg-sky-500/6 px-4 py-3 text-sm text-ink-700">
          {sharePoint.summary.note}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Tracked libraries" value={formatNumber(sharePoint.summary.totalSites)} detail="Microsoft 365 group-connected document libraries" />
        <MetricCard label="Recently modified" value={formatNumber(sharePoint.summary.activeSites)} detail="Modified in the last 30 days" accent="positive" />
        <MetricCard label="Older libraries" value={formatNumber(sharePoint.summary.inactiveSites)} detail="No recent modifications detected" accent="warning" />
        <MetricCard label="Storage used" value={formatStorageSize(sharePoint.summary.totalStorageUsedBytes)} detail="Combined quota usage across tracked libraries" />
      </div>

      <div className="mb-6 grid gap-4 xl:grid-cols-2">
        <ChartCard title="Library recency" subtitle="Recently modified vs older libraries">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={activityData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {activityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Top libraries by storage" subtitle="Largest document libraries in the current session">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topSitesByStorage}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
              <XAxis dataKey="name" hide />
              <YAxis stroke="rgba(22,39,66,0.15)" fontSize={11} />
              <Tooltip contentStyle={tooltipStyle} />
              <Bar dataKey="GB" fill="#0ea5e9" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      <DataTable data={sharePoint.sites} columns={sharePointColumns} searchPlaceholder="Filter SharePoint sites..." />
    </DatasetPanel>
  );
}

function OneDrivePanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const oneDrive = snapshot.oneDrive;

  if (oneDrive.summary.status === "unavailable") {
    return <UnavailablePanel title="OneDrive" note={oneDrive.summary.note ?? BROWSER_ONLY_ONEDRIVE_NOTE} />;
  }

  const activityData = [
    { name: "Active drives", value: oneDrive.summary.activeAccounts, color: "#0ea5e9" },
    { name: "Inactive drives", value: oneDrive.summary.inactiveAccounts, color: "#fbbf24" }
  ];
  const topByStorage = [...oneDrive.accounts]
    .sort((left, right) => right.storageUsedBytes - left.storageUsedBytes)
    .slice(0, 10)
    .map((account) => ({
      name: account.ownerDisplayName.slice(0, 18),
      GB: Number((account.storageUsedBytes / 1073741824).toFixed(2))
    }));

  return (
    <DatasetPanel title="OneDrive" dataset="onedrive" snapshot={snapshot} onExport={onExport}>
      {oneDrive.summary.note && (
        <div className="mb-4 rounded-2xl border border-sky-500/15 bg-sky-500/6 px-4 py-3 text-sm text-ink-700">
          {oneDrive.summary.note}
        </div>
      )}

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="Total drives" value={formatNumber(oneDrive.summary.totalAccounts)} detail="Licensed user OneDrive accounts" />
        <MetricCard label="Active drives" value={formatNumber(oneDrive.summary.activeAccounts)} detail="Modified in the last 30 days" accent="positive" />
        <MetricCard label="Inactive drives" value={formatNumber(oneDrive.summary.inactiveAccounts)} detail="No recent modifications" accent="warning" />
        <MetricCard label="Storage used" value={formatStorageSize(oneDrive.summary.totalStorageUsedBytes)} detail="Combined across all drives" />
      </div>

      {oneDrive.accounts.length > 0 && (
        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <ChartCard title="Drive activity" subtitle="Active vs inactive OneDrive accounts">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={activityData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                  {activityData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top drives by storage" subtitle="Largest OneDrive accounts">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topByStorage}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(22,39,66,0.06)" />
                <XAxis dataKey="name" hide />
                <YAxis stroke="rgba(22,39,66,0.15)" fontSize={11} />
                <Tooltip contentStyle={tooltipStyle} />
                <Bar dataKey="GB" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      <DataTable data={oneDrive.accounts} columns={oneDriveColumns} searchPlaceholder="Filter OneDrive accounts..." />
    </DatasetPanel>
  );
}

function SecurityPanel({ snapshot, onExport }: { snapshot: TenantReportSnapshot; onExport: PanelExport }) {
  const security = snapshot.security;
  const score = security.securityScore;
  const [activeView, setActiveView] = useState<"overview" | "users" | "admins">("overview");
  const scoreColor = score.overall >= 70 ? "#10b981" : score.overall >= 40 ? "#f59e0b" : "#ef4444";
  const mfaData = [
    { name: "MFA registered", value: security.mfaRegisteredCount, color: "#10b981" },
    { name: "No MFA", value: security.mfaNotRegisteredCount, color: "#ef4444" }
  ];
  const scoreBreakdown = score.details.map((detail) => ({
    name: detail.category,
    Score: detail.score,
    Max: detail.maxScore - detail.score
  }));

  return (
    <div className="space-y-4">
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
            <ExportButtons dataset="security" onExport={(dataset, format) => onExport(snapshot, dataset, format)} />
          </div>
        </div>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard label="MFA coverage" value={`${security.mfaCoveragePercent}%`} detail={`${formatNumber(security.mfaRegisteredCount)} registered`} accent={security.mfaCoveragePercent >= 80 ? "positive" : "warning"} />
        <MetricCard label="Inactive users" value={formatNumber(security.inactiveUsers)} detail={`${formatNumber(security.inactiveLicensedUsers)} licensed`} accent={security.inactiveUsers === 0 ? "positive" : "warning"} />
        <MetricCard label="Guest users" value={formatNumber(security.totalGuests)} detail={`${formatNumber(security.inactiveGuests)} inactive`} accent={security.inactiveGuests === 0 ? "positive" : "warning"} />
        <MetricCard label="Admin accounts" value={formatNumber(security.totalAdmins)} detail={`${formatNumber(security.adminsWithoutMfa)} without MFA`} accent={security.adminsWithoutMfa === 0 ? "positive" : "warning"} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <ChartCard title="MFA registration" subtitle="Enabled member accounts">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={mfaData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={95} strokeWidth={2} stroke="#fff">
                {mfaData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
              </Pie>
              <Tooltip contentStyle={tooltipStyle} />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Score breakdown" subtitle="By security category">
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

      <section className="glass-panel rounded-2xl p-5 md:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {(["overview", "users", "admins"] as const).map((view) => (
            <button key={view} type="button" onClick={() => setActiveView(view)} className={`rounded-lg px-3 py-2 text-xs font-semibold transition ${activeView === view ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-white"}`}>
              {view === "overview" ? "Score details" : view === "users" ? "All users" : "Admin roles"}
            </button>
          ))}
          <div className="ml-auto">
            <ExportButtons dataset="adminRoles" onExport={(dataset, format) => onExport(snapshot, dataset, format)} />
          </div>
        </div>

        {activeView === "overview" && (
          <div className="space-y-3">
            {score.details.map((detail) => (
              <div key={detail.category} className="flex items-center gap-4 rounded-xl border border-ink-900/6 bg-white p-4">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-ink-900/5 text-sm font-bold text-ink-950">
                  {detail.score}/{detail.maxScore}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-950">{detail.category}</p>
                  <p className="text-xs text-ink-600">{detail.description}</p>
                </div>
              </div>
            ))}
          </div>
        )}
        {activeView === "users" && <DataTable data={security.users} columns={securityUserColumns} searchPlaceholder="Filter security users..." />}
        {activeView === "admins" && <DataTable data={security.adminRoles} columns={adminRoleColumns} searchPlaceholder="Filter admin roles..." />}
      </section>
    </div>
  );
}

function DatasetPanel({ title, dataset, snapshot, onExport, children }: { title: string; dataset: DatasetKey; snapshot: TenantReportSnapshot; onExport: PanelExport; children: ReactNode }) {
  return (
    <section className="glass-panel rounded-2xl p-5 md:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-bold tracking-tight text-ink-950">{title}</h2>
        <ExportButtons dataset={dataset} onExport={(selectedDataset, format) => onExport(snapshot, selectedDataset, format)} />
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

function InsightCard({ title, status, metric, note, accent }: { title: string; status: string; metric: string; note?: string; accent: "sky" | "violet" | "mint" }) {
  const colorMap: Record<string, string> = {
    sky: "bg-sky-500/10 text-sky-500",
    violet: "bg-violet-500/10 text-violet-500",
    mint: "bg-mint-500/10 text-mint-500"
  };

  return (
    <div className="rounded-2xl border border-ink-900/6 bg-white p-5">
      <div className="flex items-center gap-3">
        <div className={`icon-container ${colorMap[accent]}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
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
      <div className="mx-auto max-w-lg">
        <div className="mb-4 flex justify-center">
          <div className="icon-container-lg bg-ink-900/5 text-ink-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
        </div>
        <h2 className="text-lg font-bold text-ink-950">{title}</h2>
        <p className="mt-2 text-sm text-ink-600">{note ?? "This report requires additional delegated permissions and a supported Microsoft Entra role."}</p>
      </div>
    </section>
  );
}

function PermissionPill({ label, granted }: { label: string; granted: boolean }) {
  return (
    <span className={`badge text-[10px] ${granted ? "badge-mint" : "badge-amber"}`}>
      {granted ? (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
        </svg>
      )}
      {label}
    </span>
  );
}

function CenteredStatus({ title, note, tone, animated, action }: { title: string; note?: string; tone: "neutral" | "warning" | "error"; animated?: boolean; action?: ReactNode }) {
  const toneClass = tone === "error" ? "bg-rose-400/10 text-rose-500" : tone === "warning" ? "bg-amber-500/10 text-amber-500" : "bg-sky-500/10 text-sky-500";

  return (
    <div className="page-frame flex min-h-[60vh] items-center justify-center">
      <div className={`glass-panel max-w-md rounded-2xl p-8 text-center ${animated ? "animate-fade-up" : ""}`}>
        <div className="mb-4 flex justify-center">
          <div className={`icon-container-lg ${toneClass}`}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {tone === "error" ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="15" y1="9" x2="9" y2="15" />
                  <line x1="9" y1="9" x2="15" y2="15" />
                </>
              ) : tone === "warning" ? (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              ) : (
                <path d="M21 12a9 9 0 1 1-6.219-8.56" className={animated ? "animate-spin" : ""} />
              )}
            </svg>
          </div>
        </div>
        <h2 className="text-lg font-bold text-ink-950">{title}</h2>
        {note && <p className="mt-2 text-sm text-ink-600">{note}</p>}
        {action}
      </div>
    </div>
  );
}

function TenantInfoBanner({ info }: { info: TenantInfo }) {
  return (
    <div className="glass-panel rounded-2xl px-5 py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="icon-container bg-violet-500/10 text-violet-500">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z" />
              <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2" />
              <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2" />
              <path d="M10 6h4" /><path d="M10 10h4" /><path d="M10 14h4" /><path d="M10 18h4" />
            </svg>
          </div>
          <div>
            <h2 className="text-sm font-bold text-ink-950">{info.displayName}</h2>
            <p className="text-xs text-ink-500">{info.primaryDomain} &middot; {info.tenantType} &middot; {info.countryCode}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {info.verifiedDomains.slice(0, 4).map((domain) => (
            <span key={domain} className="badge badge-neutral text-[10px]">{domain}</span>
          ))}
          {info.verifiedDomains.length > 4 && (
            <span className="badge badge-neutral text-[10px]">+{info.verifiedDomains.length - 4} more</span>
          )}
        </div>
      </div>
    </div>
  );
}

function LoadingCards() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="glass-panel animate-pulse rounded-2xl p-5">
          <div className="mb-3 h-3 w-16 rounded bg-ink-900/8" />
          <div className="mb-2 h-6 w-20 rounded bg-ink-900/8" />
          <div className="h-3 w-28 rounded bg-ink-900/6" />
        </div>
      ))}
    </div>
  );
}

const tooltipStyle = {
  borderRadius: "10px",
  border: "1px solid rgba(22,39,66,0.08)",
  boxShadow: "0 4px 12px rgba(7,17,31,0.06)",
  fontSize: "12px"
};

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

function formatStorageSize(bytes: number) {
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, exponent)).toFixed(1)} ${units[exponent]}`;
}
