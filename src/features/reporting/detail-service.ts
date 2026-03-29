import { GraphApiError, GraphClient } from "@/lib/graph/client";
import type {
  GraphDirectoryObject,
  GraphGroup,
  GraphMailboxSettings,
  GraphUser
} from "@/lib/graph/types";
import type { GroupReportDetail, UserReportDetail } from "@/lib/types/reporting";

const MAIL_FORWARDING_NOTE =
  "Microsoft Graph mailboxSettings does not expose mailbox forwarding status in this app's delegated browser flow.";
const MAILBOX_QUOTA_NOTE =
  "Mailbox quota and storage usage are exposed through redirected usage-report CSV downloads such as getMailboxUsageDetail, which cannot be read in this browser-only deployment.";

export async function collectUserReportDetail(
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit" | "sites") => Promise<string>,
  userId: string,
  skuNameById: Map<string, string>
): Promise<UserReportDetail> {
  const graph = new GraphClient(acquireGraphToken);

  const [userResult, mailboxResult, managerResult] = await Promise.allSettled([
    graph.getJson<GraphUser>(
      `/users/${userId}?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,givenName,surname,jobTitle,department,companyName,officeLocation,city,state,country,usageLocation,preferredLanguage,mobilePhone,businessPhones,employeeId,employeeType,createdDateTime,onPremisesSyncEnabled,assignedLicenses`
    ),
    graph.getJson<GraphMailboxSettings>(
      `/users/${userId}/mailboxSettings?$select=userPurpose,timeZone,language,delegateMeetingMessageDeliveryOptions,automaticRepliesSetting`
    ),
    graph.getJson<GraphDirectoryObject>(`/users/${userId}/manager?$select=id,displayName,userPrincipalName,mail`)
  ]);

  if (userResult.status !== "fulfilled") {
    throw normalizeDetailError(userResult.reason, "user");
  }

  const user = userResult.value;
  const mailbox = mailboxResult.status === "fulfilled" ? mailboxResult.value : undefined;
  const manager = managerResult.status === "fulfilled" ? managerResult.value : undefined;
  const assignedSkuNames = (user.assignedLicenses ?? []).map((license) => {
    const normalizedSkuId = license.skuId.toLowerCase();
    return skuNameById.get(normalizedSkuId) ?? normalizedSkuId;
  });

  const notes: string[] = [];
  if (mailboxResult.status !== "fulfilled") {
    notes.push("Mailbox settings were not available for this account.");
  }
  notes.push(MAIL_FORWARDING_NOTE);
  notes.push(MAILBOX_QUOTA_NOTE);

  return {
    id: user.id,
    displayName: user.displayName ?? "Unknown user",
    userPrincipalName: user.userPrincipalName ?? "Not available",
    mail: user.mail ?? "Not available",
    accountEnabled: user.accountEnabled ?? false,
    userType: user.userType ?? "Unknown",
    givenName: user.givenName ?? "Not available",
    surname: user.surname ?? "Not available",
    jobTitle: user.jobTitle ?? "Not set",
    department: user.department ?? "Not set",
    companyName: user.companyName ?? "Not set",
    officeLocation: user.officeLocation ?? "Not set",
    city: user.city ?? "Not set",
    state: user.state ?? "Not set",
    country: user.country ?? "Not set",
    usageLocation: user.usageLocation ?? "Not set",
    preferredLanguage: user.preferredLanguage ?? "Not set",
    mobilePhone: user.mobilePhone ?? "Not set",
    businessPhones: user.businessPhones?.length ? user.businessPhones : ["Not set"],
    employeeId: user.employeeId ?? "Not set",
    employeeType: user.employeeType ?? "Not set",
    createdDateTime: user.createdDateTime ?? null,
    onPremisesSyncEnabled: user.onPremisesSyncEnabled ?? null,
    managerDisplayName: manager?.displayName ?? "Not assigned",
    managerUserPrincipalName: manager?.userPrincipalName ?? manager?.mail ?? "Not assigned",
    assignedLicenseCount: assignedSkuNames.length,
    assignedSkuNames,
    mailboxPurpose: mailbox?.userPurpose ?? "Unknown",
    mailboxTimeZone: mailbox?.timeZone ?? "Not available",
    mailboxLanguage: formatMailboxLanguage(mailbox),
    automaticRepliesStatus: mailbox?.automaticRepliesSetting?.status ?? "Not configured",
    delegateMeetingMessageDelivery: mailbox?.delegateMeetingMessageDeliveryOptions ?? "Not configured",
    forwarding: {
      status: "unavailable",
      value: "Unavailable",
      note: MAIL_FORWARDING_NOTE
    },
    mailboxQuota: {
      status: "unavailable",
      value: "Unavailable",
      note: MAILBOX_QUOTA_NOTE
    },
    notes
  };
}

export async function collectGroupReportDetail(
  acquireGraphToken: (group: "core" | "reports" | "advancedAudit" | "sites") => Promise<string>,
  groupId: string
): Promise<GroupReportDetail> {
  const graph = new GraphClient(acquireGraphToken);

  const [group, members, owners] = await Promise.all([
    graph.getJson<GraphGroup>(
      `/groups/${groupId}?$select=id,displayName,description,mail,mailNickname,mailEnabled,securityEnabled,groupTypes,visibility,createdDateTime,membershipRule,membershipRuleProcessingState,isAssignableToRole`
    ),
    graph.getAllPages<GraphDirectoryObject>(
      `/groups/${groupId}/members?$select=id,displayName,userPrincipalName,mail&$top=999`
    ),
    graph.getAllPages<GraphDirectoryObject>(
      `/groups/${groupId}/owners?$select=id,displayName,userPrincipalName,mail&$top=999`
    ).catch((error) => {
      if (error instanceof GraphApiError && [403, 404].includes(error.status)) {
        return [];
      }

      throw error;
    })
  ]);

  const ownerRows = owners.map(normalizeDirectoryObject).sort(compareDirectoryRows);
  const memberRows = members.map(normalizeDirectoryObject).sort(compareDirectoryRows);
  const notes: string[] = [];

  if (ownerRows.length === 0) {
    notes.push(
      "Owners may be unavailable for Exchange-created groups, synchronized groups, or service principal owners on the Microsoft Graph v1.0 endpoint."
    );
  }

  return {
    id: group.id,
    displayName: group.displayName ?? "Untitled group",
    description: group.description ?? "No description",
    mail: group.mail ?? "Not available",
    mailNickname: group.mailNickname ?? "Not available",
    groupType: normalizeGroupType(group),
    visibility: group.visibility ?? "Not set",
    createdDateTime: group.createdDateTime ?? null,
    membershipRule: group.membershipRule ?? "Not configured",
    membershipRuleProcessingState: group.membershipRuleProcessingState ?? "Not configured",
    isAssignableToRole: Boolean(group.isAssignableToRole),
    mailEnabled: Boolean(group.mailEnabled),
    securityEnabled: Boolean(group.securityEnabled),
    ownerCount: ownerRows.length,
    memberCount: memberRows.length,
    owners: ownerRows,
    members: memberRows,
    notes
  };
}

function normalizeDirectoryObject(entry: GraphDirectoryObject) {
  return {
    id: entry.id,
    displayName: entry.displayName ?? "Unknown object",
    userPrincipalName: entry.userPrincipalName ?? "Not available",
    mail: entry.mail ?? "Not available",
    objectType: normalizeObjectType(entry["@odata.type"])
  };
}

function normalizeObjectType(value?: string) {
  if (!value) {
    return "directoryObject";
  }

  return value.replace("#microsoft.graph.", "");
}

function compareDirectoryRows(left: { displayName: string }, right: { displayName: string }) {
  return left.displayName.localeCompare(right.displayName);
}

function formatMailboxLanguage(mailbox?: GraphMailboxSettings) {
  if (!mailbox?.language) {
    return "Not available";
  }

  const displayName = mailbox.language.displayName?.trim();
  const locale = mailbox.language.locale?.trim();

  if (displayName && locale) {
    return `${displayName} (${locale})`;
  }

  return displayName || locale || "Not available";
}

function normalizeDetailError(error: unknown, resourceType: string) {
  if (error instanceof Error) {
    return new Error(`Unable to load ${resourceType} detail: ${error.message}`);
  }

  return new Error(`Unable to load ${resourceType} detail.`);
}

function normalizeGroupType(group: GraphGroup) {
  if (group.groupTypes?.includes("Unified")) return "Microsoft 365";
  if (group.mailEnabled && group.securityEnabled) return "Mail-enabled security";
  if (group.mailEnabled) return "Distribution";
  if (group.securityEnabled) return "Security";
  return "Other";
}
