export interface GraphCollectionResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export interface GraphAssignedLicense {
  skuId: string;
  disabledPlans?: string[];
}

export interface GraphSignInActivity {
  lastSignInDateTime?: string | null;
  lastSuccessfulSignInDateTime?: string | null;
}

export interface GraphUser {
  id: string;
  displayName?: string | null;
  userPrincipalName?: string | null;
  mail?: string | null;
  accountEnabled?: boolean | null;
  userType?: string | null;
  givenName?: string | null;
  surname?: string | null;
  jobTitle?: string | null;
  department?: string | null;
  officeLocation?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  companyName?: string | null;
  usageLocation?: string | null;
  preferredLanguage?: string | null;
  mobilePhone?: string | null;
  businessPhones?: string[];
  employeeId?: string | null;
  employeeType?: string | null;
  createdDateTime?: string | null;
  onPremisesSyncEnabled?: boolean | null;
  assignedLicenses?: GraphAssignedLicense[];
  signInActivity?: GraphSignInActivity | null;
}

export interface GraphServicePlan {
  servicePlanId: string;
  servicePlanName: string;
  provisioningStatus?: string | null;
  appliesTo?: string | null;
}

export interface GraphPrepaidUnits {
  enabled?: number;
  lockedOut?: number;
  suspended?: number;
  warning?: number;
}

export interface GraphSubscribedSku {
  skuId: string;
  skuPartNumber: string;
  consumedUnits: number;
  capabilityStatus?: string | null;
  prepaidUnits?: GraphPrepaidUnits | null;
  servicePlans?: GraphServicePlan[];
}

export interface GraphGroup {
  id: string;
  displayName?: string | null;
  description?: string | null;
  mail?: string | null;
  mailNickname?: string | null;
  visibility?: string | null;
  createdDateTime?: string | null;
  membershipRule?: string | null;
  membershipRuleProcessingState?: string | null;
  isAssignableToRole?: boolean | null;
  mailEnabled?: boolean | null;
  securityEnabled?: boolean | null;
  groupTypes?: string[];
  members?: Array<{ id: string }>;
}

export interface GraphMailboxLanguage {
  locale?: string | null;
  displayName?: string | null;
}

export interface GraphAutomaticRepliesSetting {
  status?: string | null;
}

export interface GraphMailboxSettings {
  userPurpose?: string | null;
  timeZone?: string | null;
  language?: GraphMailboxLanguage | null;
  delegateMeetingMessageDeliveryOptions?: string | null;
  automaticRepliesSetting?: GraphAutomaticRepliesSetting | null;
}

export interface GraphDirectoryObject {
  id: string;
  "@odata.type"?: string;
  displayName?: string | null;
  userPrincipalName?: string | null;
  mail?: string | null;
}

export interface GraphDriveQuota {
  deleted?: number | null;
  remaining?: number | null;
  state?: string | null;
  total?: number | null;
  used?: number | null;
}

export interface GraphDrive {
  id: string;
  name?: string | null;
  driveType?: string | null;
  webUrl?: string | null;
  lastModifiedDateTime?: string | null;
  quota?: GraphDriveQuota | null;
}

export interface GraphDirectoryRole {
  id: string;
  displayName?: string | null;
  description?: string | null;
  roleTemplateId?: string | null;
}

export interface GraphDirectoryRoleMember {
  id: string;
  displayName?: string | null;
  userPrincipalName?: string | null;
}

export interface GraphVerifiedDomain {
  name?: string | null;
  isDefault?: boolean | null;
  isInitial?: boolean | null;
  type?: string | null;
}

export interface GraphOrganization {
  id: string;
  displayName?: string | null;
  tenantType?: string | null;
  verifiedDomains?: GraphVerifiedDomain[];
  createdDateTime?: string | null;
  countryLetterCode?: string | null;
  preferredLanguage?: string | null;
  technicalNotificationMails?: string[];
}

export interface GraphMfaRegistrationDetail {
  id: string;
  userPrincipalName?: string | null;
  userDisplayName?: string | null;
  isMfaRegistered?: boolean;
  isMfaCapable?: boolean;
  isSsprRegistered?: boolean;
  isSsprEnabled?: boolean;
  isSsprCapable?: boolean;
  isPasswordlessCapable?: boolean;
  methodsRegistered?: string[];
}
