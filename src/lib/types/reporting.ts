export interface PermissionCapability {
  requested: boolean;
  granted: boolean;
  note?: string;
}

export interface PermissionProfile {
  core: PermissionCapability;
  reports: PermissionCapability;
  advancedAudit: PermissionCapability;
  sites: PermissionCapability;
}

export interface TenantOverview {
  totalUsers: number;
  licensedUsers: number;
  unlicensedUsers: number;
  guestUsers: number;
  disabledUsers: number;
  sharedMailboxes: number;
  unknownMailboxPurposes: number;
  groupCount: number;
  totalGroupMembers: number;
  totalPurchasedLicenses: number;
  consumedLicenses: number;
  availableLicenses: number;
  lastUpdatedAt: string;
}

export interface UserReportRow {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  accountEnabled: boolean;
  userType: string;
  jobTitle: string;
  department: string;
  officeLocation: string;
  usageLocation: string;
  preferredLanguage: string;
  assignedLicenseCount: number;
  assignedSkuNames: string[];
  lastSuccessfulSignIn?: string | null;
}

export interface LicenseReportRow {
  skuId: string;
  skuPartNumber: string;
  friendlyName: string;
  capabilityStatus: string;
  total: number;
  consumed: number;
  available: number;
}

export interface ServicePlanAssignment {
  skuPartNumber: string;
  friendlyName: string;
  servicePlanName: string;
  servicePlanId: string;
  provisioningStatus: string;
}

export interface LicenseServiceRow {
  userPrincipalName: string;
  displayName: string;
  skuPartNumber: string;
  friendlyName: string;
  servicePlanName: string;
  status: string;
}

export interface GroupReportRow {
  id: string;
  groupName: string;
  groupType: string;
  mail: string;
  visibility: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  memberCount: number;
  createdDateTime?: string | null;
}

export interface MailboxReportRow {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  purpose: string;
  isShared: boolean;
  note?: string;
}

export type ActivityWorkload =
  | "office365ActiveUsers"
  | "teamsActivity"
  | "mailboxUsage"
  | "oneDriveUsage";

export interface ActivityReportRow {
  workload: ActivityWorkload;
  primaryId: string;
  displayName: string;
  lastActivityDate?: string;
  metrics: Record<string, string | number | boolean | null>;
  raw: Record<string, string>;
}

export interface ActivityDataset {
  workload: ActivityWorkload;
  title: string;
  rows: ActivityReportRow[];
  status: "available" | "unavailable" | "error";
  note?: string;
}

export interface LastSignInSummary {
  status: "available" | "unavailable";
  totalWithRecordedSignIn: number;
  signedInLast30Days: number;
  note?: string;
}

export interface SharePointSiteRow {
  siteId: string;
  siteUrl: string;
  siteName: string;
  groupId: string;
  groupName: string;
  lastModifiedDate: string;
  storageUsedBytes: number;
  storageAllocatedBytes: number;
  storageRemainingBytes: number;
  driveState: string;
  isActive: boolean;
}

export interface SharePointSummary {
  totalSites: number;
  activeSites: number;
  inactiveSites: number;
  totalStorageUsedBytes: number;
  status: "available" | "unavailable";
  note?: string;
}

export interface OneDriveAccountRow {
  ownerPrincipalName: string;
  ownerDisplayName: string;
  lastActivityDate: string;
  fileCount: number;
  storageUsedBytes: number;
  storageAllocatedBytes: number;
  isActive: boolean;
}

export interface OneDriveSummary {
  totalAccounts: number;
  activeAccounts: number;
  inactiveAccounts: number;
  totalStorageUsedBytes: number;
  status: "available" | "unavailable";
  note?: string;
}

export interface SecurityUserRow {
  id: string;
  displayName: string;
  userPrincipalName: string;
  accountEnabled: boolean;
  userType: string;
  mfaRegistered: boolean;
  methodsRegistered: string[];
  lastSignIn: string | null;
  isInactive: boolean;
  inactiveDays: number;
  isLicensed: boolean;
}

export interface AdminRoleRow {
  roleDisplayName: string;
  userId: string;
  userDisplayName: string;
  userPrincipalName: string;
  mfaRegistered: boolean;
}

export interface SecurityScore {
  overall: number;
  mfaCoverage: number;
  inactiveRisk: number;
  guestRisk: number;
  adminRisk: number;
  details: SecurityScoreDetail[];
}

export interface SecurityScoreDetail {
  category: string;
  score: number;
  maxScore: number;
  description: string;
}

export interface DetailAvailability {
  status: "available" | "unavailable";
  value: string;
  note?: string;
}

export interface UserReportDetail {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  accountEnabled: boolean;
  userType: string;
  givenName: string;
  surname: string;
  jobTitle: string;
  department: string;
  companyName: string;
  officeLocation: string;
  city: string;
  state: string;
  country: string;
  usageLocation: string;
  preferredLanguage: string;
  mobilePhone: string;
  businessPhones: string[];
  employeeId: string;
  employeeType: string;
  createdDateTime?: string | null;
  onPremisesSyncEnabled?: boolean | null;
  managerDisplayName: string;
  managerUserPrincipalName: string;
  assignedLicenseCount: number;
  assignedSkuNames: string[];
  mailboxPurpose: string;
  mailboxTimeZone: string;
  mailboxLanguage: string;
  automaticRepliesStatus: string;
  delegateMeetingMessageDelivery: string;
  forwarding: DetailAvailability;
  mailboxQuota: DetailAvailability;
  notes: string[];
}

export interface DirectoryObjectRow {
  id: string;
  displayName: string;
  userPrincipalName: string;
  mail: string;
  objectType: string;
}

export interface GroupReportDetail {
  id: string;
  displayName: string;
  description: string;
  mail: string;
  mailNickname: string;
  groupType: string;
  visibility: string;
  createdDateTime?: string | null;
  membershipRule: string;
  membershipRuleProcessingState: string;
  isAssignableToRole: boolean;
  mailEnabled: boolean;
  securityEnabled: boolean;
  ownerCount: number;
  memberCount: number;
  owners: DirectoryObjectRow[];
  members: DirectoryObjectRow[];
  notes: string[];
}

export interface SecurityInsights {
  mfaRegisteredCount: number;
  mfaNotRegisteredCount: number;
  mfaCoveragePercent: number;
  inactiveUsers: number;
  inactiveLicensedUsers: number;
  totalGuests: number;
  inactiveGuests: number;
  totalAdmins: number;
  adminsWithoutMfa: number;
  securityScore: SecurityScore;
  users: SecurityUserRow[];
  adminRoles: AdminRoleRow[];
  status: "available" | "partial" | "unavailable";
  note?: string;
}

export interface TenantReportSnapshot {
  overview: TenantOverview;
  users: UserReportRow[];
  licenses: LicenseReportRow[];
  licenseServices: LicenseServiceRow[];
  groups: GroupReportRow[];
  mailboxes: MailboxReportRow[];
  activity: ActivityDataset[];
  sharePoint: { summary: SharePointSummary; sites: SharePointSiteRow[] };
  oneDrive: { summary: OneDriveSummary; accounts: OneDriveAccountRow[] };
  security: SecurityInsights;
  lastSignInSummary?: LastSignInSummary;
  notes: string[];
}

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  byteLength: number;
}
