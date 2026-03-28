export interface GraphCollectionResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
}

export interface GraphAssignedLicense {
  skuId: string;
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
}

export interface GraphGroup {
  id: string;
  displayName?: string | null;
  mailEnabled?: boolean | null;
  securityEnabled?: boolean | null;
  groupTypes?: string[];
  members?: Array<{ id: string }>;
}
