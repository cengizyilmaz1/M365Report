export interface PermissionCapability {
  requested: boolean;
  granted: boolean;
  note?: string;
}

export interface PermissionProfile {
  core: PermissionCapability;
  reports: PermissionCapability;
  advancedAudit: PermissionCapability;
}

export interface TenantOverview {
  totalUsers: number;
  licensedUsers: number;
  unlicensedUsers: number;
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
  assignedLicenseCount: number;
  assignedSkuNames: string[];
  lastSuccessfulSignIn?: string | null;
}

export interface LicenseReportRow {
  skuId: string;
  skuPartNumber: string;
  capabilityStatus: string;
  total: number;
  consumed: number;
  available: number;
}

export interface GroupReportRow {
  id: string;
  groupName: string;
  groupType: string;
  mailEnabled: boolean;
  securityEnabled: boolean;
  memberCount: number;
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

export interface TenantReportSnapshot {
  overview: TenantOverview;
  users: UserReportRow[];
  licenses: LicenseReportRow[];
  groups: GroupReportRow[];
  mailboxes: MailboxReportRow[];
  activity: ActivityDataset[];
  lastSignInSummary?: LastSignInSummary;
  warnings: string[];
}

export interface ExportArtifact {
  filename: string;
  mimeType: string;
  byteLength: number;
}
