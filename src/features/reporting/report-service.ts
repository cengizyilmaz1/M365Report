import { GraphApiError, GraphClient } from "@/lib/graph/client";
import { parseCsv } from "@/lib/graph/csv";
import { resolveSkuFriendlyName } from "@/lib/graph/sku-names";
import type {
  GraphDirectoryRole,
  GraphDirectoryRoleMember,
  GraphGroup,
  GraphMfaRegistrationDetail,
  GraphSubscribedSku,
  GraphUser
} from "@/lib/graph/types";
import type {
  ActivityDataset,
  ActivityReportRow,
  ActivityWorkload,
  AdminRoleRow,
  GroupReportRow,
  LicenseReportRow,
  LicenseServiceRow,
  MailboxReportRow,
  OneDriveAccountRow,
  OneDriveSummary,
  PermissionProfile,
  SecurityInsights,
  SecurityScore,
  SecurityScoreDetail,
  SecurityUserRow,
  SharePointSiteRow,
  SharePointSummary,
  TenantOverview,
  TenantReportSnapshot,
  UserReportRow
} from "@/lib/types/reporting";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const INACTIVE_THRESHOLD_DAYS = 30;

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
    graph.getJson<{ value: GraphSubscribedSku[] }>(
      "/subscribedSkus?$select=skuId,skuPartNumber,consumedUnits,capabilityStatus,prepaidUnits,servicePlans"
    ).then((r) => r.value),
    graph.getAllPages<GraphGroup>(
      "/groups?$select=id,displayName,mailEnabled,securityEnabled,groupTypes&$top=999"
    ),
    collectLastSignInIndex(graph, permissionProfile)
  ]);

  const skuNameById = new Map(
    subscribedSkus.map((sku) => [sku.skuId.toLowerCase(), resolveSkuFriendlyName(sku.skuPartNumber)])
  );
  const licenseRows = buildLicenseRows(subscribedSkus);
  const userRows = buildUserRows(users, skuNameById, signInCollection.index);

  const [groupRows, mailboxRows, activity, sharePointResult, oneDriveResult, securityResult, licenseServices] =
    await Promise.all([
      buildGroupRows(graph, groups, notes),
      buildMailboxRows(graph, users, notes),
      buildActivityDatasets(graph, permissionProfile),
      collectSharePointData(graph, permissionProfile),
      collectOneDriveData(graph, permissionProfile),
      collectSecurityInsights(graph, users, skuNameById, signInCollection, permissionProfile),
      buildLicenseServiceRows(graph, users, subscribedSkus)
    ]);

  const overview = buildOverview(userRows, licenseRows, groupRows, mailboxRows, users);

  return {
    overview,
    users: userRows,
    licenses: licenseRows,
    licenseServices,
    groups: groupRows,
    mailboxes: mailboxRows,
    activity,
    sharePoint: sharePointResult,
    oneDrive: oneDriveResult,
    security: securityResult,
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
        friendlyName: resolveSkuFriendlyName(sku.skuPartNumber),
        capabilityStatus: sku.capabilityStatus ?? "Enabled",
        total,
        consumed: sku.consumedUnits,
        available: Math.max(total - sku.consumedUnits, 0)
      };
    })
    .sort((left, right) => left.skuPartNumber.localeCompare(right.skuPartNumber));
}

async function buildLicenseServiceRows(
  _graph: GraphClient,
  users: GraphUser[],
  subscribedSkus: GraphSubscribedSku[]
): Promise<LicenseServiceRow[]> {
  const servicePlanMap = new Map<string, { skuPartNumber: string; servicePlanName: string }>();

  for (const sku of subscribedSkus) {
    for (const plan of sku.servicePlans ?? []) {
      servicePlanMap.set(plan.servicePlanId, {
        skuPartNumber: sku.skuPartNumber,
        servicePlanName: plan.servicePlanName
      });
    }
  }

  const skuServicePlanIds = new Map<string, string[]>();
  for (const sku of subscribedSkus) {
    skuServicePlanIds.set(
      sku.skuId.toLowerCase(),
      (sku.servicePlans ?? []).map((p) => p.servicePlanId)
    );
  }

  const rows: LicenseServiceRow[] = [];

  for (const user of users) {
    for (const license of user.assignedLicenses ?? []) {
      const skuId = license.skuId.toLowerCase();
      const sku = subscribedSkus.find((s) => s.skuId.toLowerCase() === skuId);
      if (!sku) continue;

      const disabledSet = new Set((license.disabledPlans ?? []).map((p) => p.toLowerCase()));
      const planIds = skuServicePlanIds.get(skuId) ?? [];

      for (const planId of planIds) {
        const planInfo = servicePlanMap.get(planId);
        if (!planInfo) continue;

        const isDisabled = disabledSet.has(planId.toLowerCase());
        rows.push({
          userPrincipalName: user.userPrincipalName ?? "N/A",
          displayName: user.displayName ?? "Unknown",
          skuPartNumber: sku.skuPartNumber,
          friendlyName: resolveSkuFriendlyName(sku.skuPartNumber),
          servicePlanName: planInfo.servicePlanName,
          status: isDisabled ? "Disabled" : "Enabled"
        });
      }
    }
  }

  return rows;
}

async function buildGroupRows(graph: GraphClient, groups: GraphGroup[], notes: string[]) {
  let usedFallback = false;

  const rows = await mapWithConcurrency(groups, 6, async (group) => {
    let memberCount: number;

    try {
      const countText = await graph.getText(`/groups/${group.id}/members/$count`, "core", {
        headers: { ConsistencyLevel: "eventual" }
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
  mailboxes: MailboxReportRow[],
  rawUsers: GraphUser[]
): TenantOverview {
  const licensedUsers = users.filter((user) => user.assignedLicenseCount > 0).length;
  const totalPurchasedLicenses = licenses.reduce((sum, sku) => sum + sku.total, 0);
  const consumedLicenses = licenses.reduce((sum, sku) => sum + sku.consumed, 0);

  return {
    totalUsers: users.length,
    licensedUsers,
    unlicensedUsers: users.length - licensedUsers,
    guestUsers: rawUsers.filter((u) => u.userType === "Guest").length,
    disabledUsers: rawUsers.filter((u) => u.accountEnabled === false).length,
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

async function collectSharePointData(
  graph: GraphClient,
  permissionProfile: PermissionProfile
): Promise<{ summary: SharePointSummary; sites: SharePointSiteRow[] }> {
  const empty: { summary: SharePointSummary; sites: SharePointSiteRow[] } = {
    summary: { totalSites: 0, activeSites: 0, inactiveSites: 0, totalStorageUsedBytes: 0, status: "unavailable", note: "Reports.Read.All required." },
    sites: []
  };

  if (!permissionProfile.reports.granted) return empty;

  try {
    const csvText = await graph.getText("/reports/getSharePointSiteUsageDetail(period='D30')", "reports");
    const rawRows = parseCsv(csvText);
    const now = Date.now();
    const thresholdMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const sites: SharePointSiteRow[] = rawRows.map((row) => {
      const lastActivity = row["Last Activity Date"] || "";
      const lastActivityTime = lastActivity ? new Date(lastActivity).getTime() : 0;
      const isActive = lastActivityTime > 0 && (now - lastActivityTime) < thresholdMs;

      return {
        siteUrl: row["Site URL"] || row["Site Url"] || "",
        siteName: row["Site URL"]?.split("/").pop() || row["Site Url"]?.split("/").pop() || "Unknown",
        lastActivityDate: lastActivity,
        fileCount: safeInt(row["File Count"]),
        storageUsedBytes: safeInt(row["Storage Used (Byte)"]),
        storageAllocatedBytes: safeInt(row["Storage Allocated (Byte)"]),
        isActive
      };
    });

    const activeSites = sites.filter((s) => s.isActive).length;

    return {
      summary: {
        totalSites: sites.length,
        activeSites,
        inactiveSites: sites.length - activeSites,
        totalStorageUsedBytes: sites.reduce((sum, s) => sum + s.storageUsedBytes, 0),
        status: "available"
      },
      sites
    };
  } catch (error) {
    return {
      summary: {
        totalSites: 0, activeSites: 0, inactiveSites: 0, totalStorageUsedBytes: 0,
        status: "unavailable",
        note: error instanceof GraphApiError ? "SharePoint usage report not accessible." : "Could not fetch SharePoint data."
      },
      sites: []
    };
  }
}

async function collectOneDriveData(
  graph: GraphClient,
  permissionProfile: PermissionProfile
): Promise<{ summary: OneDriveSummary; accounts: OneDriveAccountRow[] }> {
  const empty: { summary: OneDriveSummary; accounts: OneDriveAccountRow[] } = {
    summary: { totalAccounts: 0, activeAccounts: 0, inactiveAccounts: 0, totalStorageUsedBytes: 0, status: "unavailable", note: "Reports.Read.All required." },
    accounts: []
  };

  if (!permissionProfile.reports.granted) return empty;

  try {
    const csvText = await graph.getText("/reports/getOneDriveUsageAccountDetail(period='D30')", "reports");
    const rawRows = parseCsv(csvText);
    const now = Date.now();
    const thresholdMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

    const accounts: OneDriveAccountRow[] = rawRows.map((row) => {
      const lastActivity = row["Last Activity Date"] || "";
      const lastActivityTime = lastActivity ? new Date(lastActivity).getTime() : 0;
      const isActive = lastActivityTime > 0 && (now - lastActivityTime) < thresholdMs;

      return {
        ownerPrincipalName: row["Owner Principal Name"] || "",
        ownerDisplayName: row["Owner Display Name"] || "",
        lastActivityDate: lastActivity,
        fileCount: safeInt(row["File Count"]),
        storageUsedBytes: safeInt(row["Storage Used (Byte)"]),
        storageAllocatedBytes: safeInt(row["Storage Allocated (Byte)"]),
        isActive
      };
    });

    const activeAccounts = accounts.filter((a) => a.isActive).length;

    return {
      summary: {
        totalAccounts: accounts.length,
        activeAccounts,
        inactiveAccounts: accounts.length - activeAccounts,
        totalStorageUsedBytes: accounts.reduce((sum, a) => sum + a.storageUsedBytes, 0),
        status: "available"
      },
      accounts
    };
  } catch (error) {
    return {
      summary: {
        totalAccounts: 0, activeAccounts: 0, inactiveAccounts: 0, totalStorageUsedBytes: 0,
        status: "unavailable",
        note: error instanceof GraphApiError ? "OneDrive usage report not accessible." : "Could not fetch OneDrive data."
      },
      accounts: []
    };
  }
}

async function collectSecurityInsights(
  graph: GraphClient,
  users: GraphUser[],
  _skuNameById: Map<string, string>,
  signInCollection: SignInCollectionResult,
  _permissionProfile: PermissionProfile
): Promise<SecurityInsights> {

  const now = Date.now();
  const thresholdMs = INACTIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;

  let mfaDetails: GraphMfaRegistrationDetail[] = [];
  let mfaAvailable = false;

  try {
    mfaDetails = await graph.getAllPages<GraphMfaRegistrationDetail>(
      "/reports/authenticationMethods/userRegistrationDetails?$top=999",
      "reports"
    );
    mfaAvailable = true;
  } catch {
    // MFA registration details may not be available without proper roles
  }

  const mfaMap = new Map<string, GraphMfaRegistrationDetail>();
  for (const detail of mfaDetails) {
    if (detail.userPrincipalName) {
      mfaMap.set(detail.userPrincipalName.toLowerCase(), detail);
    }
    mfaMap.set(detail.id, detail);
  }

  let directoryRoles: GraphDirectoryRole[] = [];
  const roleMembers = new Map<string, GraphDirectoryRoleMember[]>();

  try {
    directoryRoles = await graph.getAllPages<GraphDirectoryRole>("/directoryRoles?$select=id,displayName,roleTemplateId");
    const memberResults = await mapWithConcurrency(directoryRoles, 4, async (role) => {
      try {
        const members = await graph.getAllPages<GraphDirectoryRoleMember>(
          `/directoryRoles/${role.id}/members?$select=id,displayName,userPrincipalName`
        );
        return { roleId: role.id, members };
      } catch {
        return { roleId: role.id, members: [] };
      }
    });
    for (const result of memberResults) {
      roleMembers.set(result.roleId, result.members);
    }
  } catch {
    // Directory roles may not be accessible
  }

  const adminRoles: AdminRoleRow[] = [];
  const adminUserIds = new Set<string>();

  for (const role of directoryRoles) {
    const members = roleMembers.get(role.id) ?? [];
    for (const member of members) {
      adminUserIds.add(member.id);
      const mfaInfo = mfaMap.get(member.id) ?? (member.userPrincipalName ? mfaMap.get(member.userPrincipalName.toLowerCase()) : undefined);
      adminRoles.push({
        roleDisplayName: role.displayName ?? "Unknown role",
        userId: member.id,
        userDisplayName: member.displayName ?? "Unknown",
        userPrincipalName: member.userPrincipalName ?? "N/A",
        mfaRegistered: mfaInfo?.isMfaRegistered ?? false
      });
    }
  }

  const securityUsers: SecurityUserRow[] = users.map((user) => {
    const upn = user.userPrincipalName?.toLowerCase() ?? "";
    const mfaInfo = mfaMap.get(user.id) ?? mfaMap.get(upn);
    const lastSignIn = signInCollection.index.get(user.id) ?? null;
    const lastSignInTime = lastSignIn ? new Date(lastSignIn).getTime() : 0;
    const isInactive = signInCollection.available
      ? (lastSignInTime === 0 || (now - lastSignInTime) > thresholdMs)
      : false;
    const inactiveDays = lastSignInTime > 0 ? Math.floor((now - lastSignInTime) / (24 * 60 * 60 * 1000)) : -1;
    const isLicensed = (user.assignedLicenses ?? []).length > 0;

    return {
      id: user.id,
      displayName: user.displayName ?? "Unknown",
      userPrincipalName: user.userPrincipalName ?? "N/A",
      accountEnabled: user.accountEnabled ?? false,
      userType: user.userType ?? "Unknown",
      mfaRegistered: mfaInfo?.isMfaRegistered ?? false,
      methodsRegistered: mfaInfo?.methodsRegistered ?? [],
      lastSignIn,
      isInactive,
      inactiveDays,
      isLicensed
    };
  });

  const enabledMembers = securityUsers.filter((u) => u.accountEnabled && u.userType === "Member");
  const mfaRegistered = mfaAvailable ? enabledMembers.filter((u) => u.mfaRegistered).length : 0;
  const mfaNotRegistered = mfaAvailable ? enabledMembers.length - mfaRegistered : enabledMembers.length;
  const mfaCoverage = enabledMembers.length > 0 && mfaAvailable ? Math.round((mfaRegistered / enabledMembers.length) * 100) : 0;

  const inactiveUsers = signInCollection.available ? securityUsers.filter((u) => u.isInactive && u.accountEnabled).length : 0;
  const inactiveLicensedUsers = signInCollection.available ? securityUsers.filter((u) => u.isInactive && u.isLicensed && u.accountEnabled).length : 0;

  const guests = securityUsers.filter((u) => u.userType === "Guest");
  const totalGuests = guests.length;
  const inactiveGuests = signInCollection.available ? guests.filter((u) => u.isInactive).length : 0;

  const uniqueAdmins = new Set(adminRoles.map((r) => r.userId));
  const totalAdmins = uniqueAdmins.size;
  const adminsWithoutMfa = mfaAvailable
    ? [...uniqueAdmins].filter((id) => {
        const info = mfaMap.get(id);
        return !info?.isMfaRegistered;
      }).length
    : totalAdmins;

  const securityScore = calculateSecurityScore(
    mfaCoverage, mfaAvailable,
    inactiveUsers, enabledMembers.length, signInCollection.available,
    totalGuests, inactiveGuests, users.length,
    totalAdmins, adminsWithoutMfa
  );

  return {
    mfaRegisteredCount: mfaRegistered,
    mfaNotRegisteredCount: mfaNotRegistered,
    mfaCoveragePercent: mfaCoverage,
    inactiveUsers,
    inactiveLicensedUsers,
    totalGuests,
    inactiveGuests,
    totalAdmins,
    adminsWithoutMfa,
    securityScore,
    users: securityUsers,
    adminRoles,
    status: mfaAvailable && signInCollection.available ? "available" : "partial",
    note: !mfaAvailable ? "MFA registration data requires Reports.Read.All and Authentication Administrator role." : undefined
  };
}

function calculateSecurityScore(
  mfaCoverage: number, mfaAvailable: boolean,
  inactiveUsers: number, totalEnabled: number, signInAvailable: boolean,
  totalGuests: number, inactiveGuests: number, totalUsers: number,
  totalAdmins: number, adminsWithoutMfa: number
): SecurityScore {
  const details: SecurityScoreDetail[] = [];

  let mfaScore = 0;
  if (mfaAvailable) {
    mfaScore = Math.round(mfaCoverage * 0.4);
    details.push({
      category: "MFA Coverage",
      score: mfaScore,
      maxScore: 40,
      description: `${mfaCoverage}% of enabled member accounts have MFA registered.`
    });
  } else {
    details.push({ category: "MFA Coverage", score: 0, maxScore: 40, description: "MFA data not available." });
  }

  let inactiveScore = 25;
  if (signInAvailable && totalEnabled > 0) {
    const inactiveRatio = inactiveUsers / totalEnabled;
    inactiveScore = Math.round((1 - inactiveRatio) * 25);
    details.push({
      category: "Inactive Users",
      score: inactiveScore,
      maxScore: 25,
      description: `${inactiveUsers} of ${totalEnabled} enabled accounts are inactive (${INACTIVE_THRESHOLD_DAYS}+ days).`
    });
  } else {
    details.push({ category: "Inactive Users", score: 0, maxScore: 25, description: "Sign-in data not available." });
    inactiveScore = 0;
  }

  let guestScore = 20;
  if (totalUsers > 0) {
    const guestRatio = totalGuests / totalUsers;
    const inactiveGuestPenalty = totalGuests > 0 ? (inactiveGuests / totalGuests) * 0.5 : 0;
    guestScore = Math.round((1 - Math.min(guestRatio * 2, 1) * 0.5 - inactiveGuestPenalty) * 20);
    guestScore = Math.max(guestScore, 0);
    details.push({
      category: "Guest Users",
      score: guestScore,
      maxScore: 20,
      description: `${totalGuests} guest accounts, ${inactiveGuests} inactive.`
    });
  } else {
    details.push({ category: "Guest Users", score: 20, maxScore: 20, description: "No users found." });
  }

  let adminScore = 15;
  if (totalAdmins > 0) {
    const mfaPenalty = adminsWithoutMfa > 0 ? (adminsWithoutMfa / totalAdmins) * 10 : 0;
    const countPenalty = totalAdmins > 5 ? Math.min((totalAdmins - 5) * 0.5, 5) : 0;
    adminScore = Math.round(Math.max(15 - mfaPenalty - countPenalty, 0));
    details.push({
      category: "Admin Security",
      score: adminScore,
      maxScore: 15,
      description: `${totalAdmins} admin accounts, ${adminsWithoutMfa} without MFA.`
    });
  } else {
    details.push({ category: "Admin Security", score: 15, maxScore: 15, description: "No admin roles detected." });
  }

  const overall = mfaScore + inactiveScore + guestScore + adminScore;

  return {
    overall: Math.min(overall, 100),
    mfaCoverage: mfaScore,
    inactiveRisk: inactiveScore,
    guestRisk: guestScore,
    adminRisk: adminScore,
    details
  };
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

    return { index, available: true };
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
  if (group.groupTypes?.includes("Unified")) return "Microsoft 365";
  if (group.mailEnabled && group.securityEnabled) return "Mail-enabled security";
  if (group.mailEnabled) return "Distribution";
  if (group.securityEnabled) return "Security";
  return "Other";
}

function normalizeActivityRow(workload: ActivityWorkload, raw: Record<string, string>): ActivityReportRow {
  const primaryId =
    raw["User Principal Name"] || raw["Owner Principal Name"] || raw["Site Url"] || raw["Report Refresh Date"] || "unknown";
  const displayName =
    raw["Display Name"] || raw["Owner Display Name"] || raw["Site Url"] || primaryId;
  const lastActivityDate = raw["Last Activity Date"] || raw["Report Refresh Date"];
  const metrics = Object.fromEntries(
    Object.entries(raw).map(([key, value]) => [key, normalizeScalar(value)])
  );

  return { workload, primaryId, displayName, lastActivityDate, metrics, raw };
}

function normalizeScalar(value: string) {
  const trimmed = value.trim();
  if (trimmed === "") return null;
  if (trimmed === "True" || trimmed === "False") return trimmed === "True";
  const numeric = Number(trimmed);
  if (!Number.isNaN(numeric) && trimmed !== "") return numeric;
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

function safeInt(value: string | undefined): number {
  if (!value) return 0;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? 0 : parsed;
}
