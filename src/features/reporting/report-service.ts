import { GraphApiError, GraphClient } from "@/lib/graph/client";
import { parseCsv } from "@/lib/graph/csv";
import type { GraphGroup, GraphSubscribedSku, GraphUser } from "@/lib/graph/types";
import type {
  ActivityDataset,
  ActivityReportRow,
  ActivityWorkload,
  GroupReportRow,
  LicenseReportRow,
  MailboxReportRow,
  PermissionProfile,
  TenantOverview,
  TenantReportSnapshot,
  UserReportRow
} from "@/lib/types/reporting";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const activityWorkloads: Array<{
  workload: ActivityWorkload;
  title: string;
  endpoint: string;
}> = [
  {
    workload: "office365ActiveUsers",
    title: "Office 365 active users",
    endpoint: "/reports/getOffice365ActiveUserDetail(period='D30')"
  },
  {
    workload: "teamsActivity",
    title: "Teams user activity",
    endpoint: "/reports/getTeamsUserActivityUserDetail(period='D30')"
  },
  {
    workload: "mailboxUsage",
    title: "Mailbox usage",
    endpoint: "/reports/getMailboxUsageDetail(period='D30')"
  },
  {
    workload: "oneDriveUsage",
    title: "OneDrive usage",
    endpoint: "/reports/getOneDriveUsageAccountDetail(period='D30')"
  }
];

interface SignInCollectionResult {
  index: Map<string, string | null>;
  available: boolean;
  note?: string;
}

export async function collectTenantReportSnapshot(
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit") => Promise<string>,
  permissionProfile: PermissionProfile
): Promise<TenantReportSnapshot> {
  const graph = new GraphClient(acquireGraphToken);
  const notes: string[] = [];

  const [users, subscribedSkus, groups, signInCollection] = await Promise.all([
    graph.getAllPages<GraphUser>(
      "/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,assignedLicenses&$top=999"
    ),
    graph.getJson<{ value: GraphSubscribedSku[] }>("/subscribedSkus").then((response) => response.value),
    graph.getAllPages<GraphGroup>(
      "/groups?$select=id,displayName,mailEnabled,securityEnabled,groupTypes&$top=999"
    ),
    collectLastSignInIndex(graph, permissionProfile)
  ]);

  const skuNameById = new Map(subscribedSkus.map((sku) => [sku.skuId.toLowerCase(), sku.skuPartNumber]));
  const licenseRows = buildLicenseRows(subscribedSkus);
  const userRows = buildUserRows(users, skuNameById, signInCollection.index);
  const groupRows = await buildGroupRows(graph, groups, notes);
  const mailboxRows = await buildMailboxRows(graph, users, notes);
  const overview = buildOverview(userRows, licenseRows, groupRows, mailboxRows);
  const activity = await buildActivityDatasets(graph, permissionProfile);

  return {
    overview,
    users: userRows,
    licenses: licenseRows,
    groups: groupRows,
    mailboxes: mailboxRows,
    activity,
    lastSignInSummary: buildLastSignInSummary(signInCollection, permissionProfile),
    notes
  };
}

function buildUserRows(
  users: GraphUser[],
  skuNameById: Map<string, string>,
  signInIndex: Map<string, string | null>
): UserReportRow[] {
  return users
    .map((user) => {
      const assignedLicenseIds = (user.assignedLicenses ?? []).map((license) => license.skuId.toLowerCase());

      return {
        id: user.id,
        displayName: user.displayName ?? "Unknown user",
        userPrincipalName: user.userPrincipalName ?? "Not available",
        mail: user.mail ?? "Not available",
        accountEnabled: user.accountEnabled ?? false,
        userType: user.userType ?? "Unknown",
        assignedLicenseCount: assignedLicenseIds.length,
        assignedSkuNames: assignedLicenseIds.map((skuId) => skuNameById.get(skuId) ?? skuId),
        lastSuccessfulSignIn: signInIndex.get(user.id) ?? null
      };
    })
    .sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function buildLicenseRows(skus: GraphSubscribedSku[]): LicenseReportRow[] {
  return skus
    .map((sku) => {
      const total =
        (sku.prepaidUnits?.enabled ?? 0) +
        (sku.prepaidUnits?.lockedOut ?? 0) +
        (sku.prepaidUnits?.suspended ?? 0) +
        (sku.prepaidUnits?.warning ?? 0);

      return {
        skuId: sku.skuId,
        skuPartNumber: sku.skuPartNumber,
        capabilityStatus: sku.capabilityStatus ?? "Enabled",
        total,
        consumed: sku.consumedUnits,
        available: Math.max(total - sku.consumedUnits, 0)
      };
    })
    .sort((left, right) => left.skuPartNumber.localeCompare(right.skuPartNumber));
}

async function buildGroupRows(graph: GraphClient, groups: GraphGroup[], notes: string[]) {
  let usedFallback = false;

  const rows = await mapWithConcurrency(groups, 6, async (group) => {
    let memberCount: number;

    try {
      const countText = await graph.getText(`/groups/${group.id}/members/$count`, "core", {
        headers: {
          ConsistencyLevel: "eventual"
        }
      });
      memberCount = Number.parseInt(countText, 10);
    } catch (error) {
      usedFallback = true;
      const expanded = await graph.getJson<GraphGroup>(
        `/groups/${group.id}?$select=id&$expand=members($select=id)`
      );
      memberCount = expanded.members?.length ?? 0;

      if (error instanceof GraphApiError && error.status >= 500) {
        notes.push(`Group member count fallback was used for ${group.displayName ?? group.id}.`);
      }
    }

    return {
      id: group.id,
      groupName: group.displayName ?? "Untitled group",
      groupType: normalizeGroupType(group),
      mailEnabled: Boolean(group.mailEnabled),
      securityEnabled: Boolean(group.securityEnabled),
      memberCount
    } satisfies GroupReportRow;
  });

  if (usedFallback) {
    notes.push(
      "Some group counts used the expanded-members fallback. Microsoft documents a known v1.0 caveat around service principal members."
    );
  }

  return rows.sort((left, right) => left.groupName.localeCompare(right.groupName));
}

async function buildMailboxRows(graph: GraphClient, users: GraphUser[], notes: string[]) {
  const mailboxCandidates = users.filter((user) => Boolean(user.mail?.trim()));

  const rows = await mapWithConcurrency(mailboxCandidates, 6, async (user) => {
    try {
      const response = await graph.getJson<{ userPurpose?: string | null }>(
        `/users/${user.id}/mailboxSettings?$select=userPurpose`
      );
      const purpose = response.userPurpose ?? "unknown";

      return {
        id: user.id,
        displayName: user.displayName ?? "Unknown user",
        userPrincipalName: user.userPrincipalName ?? "Not available",
        mail: user.mail ?? "Not available",
        purpose,
        isShared: purpose === "shared"
      } satisfies MailboxReportRow;
    } catch (error) {
      if (error instanceof GraphApiError && [403, 404].includes(error.status)) {
        return {
          id: user.id,
          displayName: user.displayName ?? "Unknown user",
          userPrincipalName: user.userPrincipalName ?? "Not available",
          mail: user.mail ?? "Not available",
          purpose: "unknown",
          isShared: false,
          note: "Mailbox settings are unavailable for this account."
        } satisfies MailboxReportRow;
      }

      throw error;
    }
  });

  const unknownCount = rows.filter((row) => row.purpose === "unknown").length;

  if (unknownCount > 0) {
    notes.push(
      `${unknownCount} mail-enabled accounts did not expose mailboxSettings.userPurpose and are marked as unknown.`
    );
  }

  return rows.sort((left, right) => left.displayName.localeCompare(right.displayName));
}

function buildOverview(
  users: UserReportRow[],
  licenses: LicenseReportRow[],
  groups: GroupReportRow[],
  mailboxes: MailboxReportRow[]
): TenantOverview {
  const licensedUsers = users.filter((user) => user.assignedLicenseCount > 0).length;
  const totalPurchasedLicenses = licenses.reduce((sum, sku) => sum + sku.total, 0);
  const consumedLicenses = licenses.reduce((sum, sku) => sum + sku.consumed, 0);

  return {
    totalUsers: users.length,
    licensedUsers,
    unlicensedUsers: users.length - licensedUsers,
    sharedMailboxes: mailboxes.filter((row) => row.isShared).length,
    unknownMailboxPurposes: mailboxes.filter((row) => row.purpose === "unknown").length,
    groupCount: groups.length,
    totalGroupMembers: groups.reduce((sum, group) => sum + group.memberCount, 0),
    totalPurchasedLicenses,
    consumedLicenses,
    availableLicenses: Math.max(totalPurchasedLicenses - consumedLicenses, 0),
    lastUpdatedAt: new Date().toISOString()
  };
}

async function buildActivityDatasets(
  graph: GraphClient,
  permissionProfile: PermissionProfile
): Promise<ActivityDataset[]> {
  if (!permissionProfile.reports.granted) {
    return activityWorkloads.map((dataset) => ({
      workload: dataset.workload,
      title: dataset.title,
      rows: [],
      status: "unavailable",
      note: "Reports.Read.All has not been granted or is not currently available for this session."
    }));
  }

  const datasets = await Promise.all(
    activityWorkloads.map(async (dataset) => {
      try {
        const csvText = await graph.getText(dataset.endpoint, "reports");
        const rawRows = parseCsv(csvText);

        return {
          workload: dataset.workload,
          title: dataset.title,
          rows: rawRows.map((row) => normalizeActivityRow(dataset.workload, row)),
          status: "available"
        } satisfies ActivityDataset;
      } catch (error) {
        return {
          workload: dataset.workload,
          title: dataset.title,
          rows: [],
          status: "unavailable",
          note: buildActivityUnavailableNote(error)
        } satisfies ActivityDataset;
      }
    })
  );

  return datasets;
}

async function collectLastSignInIndex(
  graph: GraphClient,
  permissionProfile: PermissionProfile
): Promise<SignInCollectionResult> {
  const index = new Map<string, string | null>();

  if (!permissionProfile.advancedAudit.granted) {
    return {
      index,
      available: false,
      note: "Enable AuditLog.Read.All to collect last sign-in summaries."
    };
  }

  try {
    const users = await graph.getAllPages<GraphUser>(
      "/users?$select=id,signInActivity&$top=999",
      "advancedAudit"
    );

    users.forEach((user) => {
      index.set(
        user.id,
        user.signInActivity?.lastSuccessfulSignInDateTime ?? user.signInActivity?.lastSignInDateTime ?? null
      );
    });

    return {
      index,
      available: true
    };
  } catch {
    return {
      index,
      available: false,
      note: "Last sign-in summary is unavailable for this tenant, license, or role."
    };
  }
}

function buildLastSignInSummary(
  signInCollection: SignInCollectionResult,
  permissionProfile: PermissionProfile
) {
  if (!permissionProfile.advancedAudit.granted) {
    return {
      status: "unavailable",
      totalWithRecordedSignIn: 0,
      signedInLast30Days: 0,
      note: "Enable AuditLog.Read.All to collect last sign-in summaries."
    } as const;
  }

  if (!signInCollection.available) {
    return {
      status: "unavailable",
      totalWithRecordedSignIn: 0,
      signedInLast30Days: 0,
      note: signInCollection.note ?? "Last sign-in summary is unavailable for this tenant, license, or role."
    } as const;
  }

  const now = Date.now();
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const values = Array.from(signInCollection.index.values()).filter(Boolean) as string[];

  return {
    status: "available",
    totalWithRecordedSignIn: values.length,
    signedInLast30Days: values.filter((value) => new Date(value).getTime() >= thirtyDaysAgo).length
  } as const;
}

function normalizeGroupType(group: GraphGroup) {
  if (group.groupTypes?.includes("Unified")) {
    return "Microsoft 365";
  }

  if (group.mailEnabled && group.securityEnabled) {
    return "Mail-enabled security";
  }

  if (group.mailEnabled) {
    return "Distribution";
  }

  if (group.securityEnabled) {
    return "Security";
  }

  return "Other";
}

function normalizeActivityRow(workload: ActivityWorkload, raw: Record<string, string>): ActivityReportRow {
  const primaryId =
    raw["User Principal Name"] ||
    raw["Owner Principal Name"] ||
    raw["Site Url"] ||
    raw["Report Refresh Date"] ||
    "unknown";

  const displayName =
    raw["Display Name"] || raw["Owner Display Name"] || raw["Site Url"] || primaryId;

  const lastActivityDate = raw["Last Activity Date"] || raw["Report Refresh Date"];
  const metrics = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, normalizeScalar(value)])
  );

  return {
    workload,
    primaryId,
    displayName,
    lastActivityDate,
    metrics,
    raw
  };
}

function normalizeScalar(value: string) {
  const trimmed = value.trim();

  if (trimmed === "") {
    return null;
  }

  if (trimmed === "True" || trimmed === "False") {
    return trimmed === "True";
  }

  const numeric = Number(trimmed);

  if (!Number.isNaN(numeric) && trimmed !== "") {
    return numeric;
  }

  return trimmed;
}

function buildActivityUnavailableNote(error: unknown) {
  if (error instanceof GraphApiError) {
    if ([401, 403].includes(error.status)) {
      return "This workload needs Reports.Read.All and a supported Microsoft Entra reports role.";
    }

    if (error.status === 404) {
      return "This workload report is not available for the current tenant or subscription.";
    }

    return "Microsoft Graph did not return a usable workload export for this browser session.";
  }

  return "This browser-only deployment could not read the redirected workload CSV from Microsoft Graph.";
}
