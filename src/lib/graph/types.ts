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
  mailEnabled?: boolean | null;
  securityEnabled?: boolean | null;
  groupTypes?: string[];
  members?: Array<{ id: string }>;
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
