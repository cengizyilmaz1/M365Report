import { afterEach, describe, expect, it, vi } from "vitest";
import {
  SITES_SCOPE_NOTE,
  collectTenantReportSnapshot
} from "./report-service";

describe("collectTenantReportSnapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes overview data and degrades gracefully for group and mailbox caveats", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,jobTitle,department,companyName,officeLocation,usageLocation,preferredLanguage,createdDateTime,assignedLicenses&$top=999")) {
        return jsonResponse({
          value: [
            {
              id: "u-1",
              displayName: "Adele Vance",
              userPrincipalName: "adele@contoso.com",
              mail: "adele@contoso.com",
              accountEnabled: true,
              userType: "Member",
              assignedLicenses: [{ skuId: "sku-1" }]
            },
            {
              id: "u-2",
              displayName: "Megan Bowen",
              userPrincipalName: "megan@contoso.com",
              mail: "megan@contoso.com",
              accountEnabled: true,
              userType: "Member",
              assignedLicenses: []
            }
          ]
        });
      }

      if (url.includes("/subscribedSkus")) {
        return jsonResponse({
          value: [
            {
              skuId: "sku-1",
              skuPartNumber: "ENTERPRISEPACK",
              consumedUnits: 4,
              capabilityStatus: "Enabled",
              prepaidUnits: {
                enabled: 10,
                lockedOut: 0,
                suspended: 0,
                warning: 0
              },
              servicePlans: [
                { servicePlanId: "sp-1", servicePlanName: "EXCHANGE_S_ENTERPRISE", provisioningStatus: "Success" }
              ]
            }
          ]
        });
      }

      if (url.includes("/groups?$select=id,displayName,mail,mailEnabled,securityEnabled,groupTypes,visibility,createdDateTime&$top=999")) {
        return jsonResponse({
          value: [
            {
              id: "g-1",
              displayName: "All Employees",
              mail: "all.employees@contoso.com",
              mailEnabled: true,
              securityEnabled: false,
              groupTypes: ["Unified"]
            }
          ]
        });
      }

      if (url.endsWith("/groups/g-1/members/$count")) {
        return new Response("Server error", { status: 500 });
      }

      if (url.includes("/groups/g-1?$select=id&$expand=members($select=id)")) {
        return jsonResponse({
          id: "g-1",
          members: [{ id: "u-1" }, { id: "u-2" }]
        });
      }

      if (url.includes("/users/u-1/mailboxSettings?$select=userPurpose")) {
        return jsonResponse({ userPurpose: "shared" });
      }

      if (url.includes("/users/u-2/mailboxSettings?$select=userPurpose")) {
        return new Response("Not found", { status: 404 });
      }

      // Organization endpoint
      if (url.includes("/organization")) {
        return jsonResponse({ value: [{ id: "tenant-1", displayName: "Contoso", tenantType: "AAD", verifiedDomains: [{ name: "contoso.com", isDefault: true }], countryLetterCode: "US" }] });
      }

      // Reports endpoints — unavailable in test
      if (url.includes("/reports/")) {
        return new Response("Forbidden", { status: 403 });
      }

      // Directory roles — empty
      if (url.includes("/directoryRoles")) {
        return jsonResponse({ value: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await collectTenantReportSnapshot(
      async () => "token",
      {
        core: { requested: true, granted: true },
        reports: { requested: true, granted: false },
        advancedAudit: { requested: true, granted: false },
        sites: { requested: true, granted: false }
      }
    );

    expect(snapshot.tenantInfo?.displayName).toBe("Contoso");
    expect(snapshot.overview.totalUsers).toBe(2);
    expect(snapshot.overview.licensedUsers).toBe(1);
    expect(snapshot.overview.sharedMailboxes).toBe(1);
    expect(snapshot.overview.groupCount).toBe(1);
    expect(snapshot.overview.totalGroupMembers).toBe(2);
    expect(snapshot.overview.totalPurchasedLicenses).toBe(10);
    expect(snapshot.overview.consumedLicenses).toBe(4);
    expect(snapshot.overview.availableLicenses).toBe(6);
    expect(snapshot.users[0]?.assignedSkuNames).toContain("Office 365 E3");
    expect(snapshot.activity.every((dataset) => dataset.status === "unavailable")).toBe(true);
    expect(snapshot.activity.every((dataset) => dataset.note?.includes("Reports.Read.All"))).toBe(true);
    expect(snapshot.sharePoint.summary.status).toBe("unavailable");
    expect(snapshot.sharePoint.summary.note).toBe(SITES_SCOPE_NOTE);
    expect(snapshot.oneDrive.summary.status).toBe("unavailable");
    expect(snapshot.security).toBeDefined();
    expect(snapshot.notes.some((note) => note.includes("service principal members"))).toBe(true);
    expect(snapshot.notes.some((note) => note.includes("mailboxSettings.userPurpose"))).toBe(true);
  });

  it("collects activity reports when report scopes are granted and handles failures gracefully", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,jobTitle,department,companyName,officeLocation,usageLocation,preferredLanguage,createdDateTime,assignedLicenses&$top=999")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/subscribedSkus")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/groups?$select=id,displayName,mail,mailEnabled,securityEnabled,groupTypes,visibility,createdDateTime&$top=999")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/organization")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/reports/")) {
        return new Response("Forbidden", { status: 403 });
      }

      if (url.includes("/directoryRoles")) {
        return jsonResponse({ value: [] });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await collectTenantReportSnapshot(
      async () => "token",
      {
        core: { requested: true, granted: true },
        reports: { requested: true, granted: true },
        advancedAudit: { requested: true, granted: false },
        sites: { requested: true, granted: true }
      }
    );

    expect(snapshot.activity.every((dataset) => dataset.status === "unavailable")).toBe(true);
    expect(snapshot.sharePoint.summary.status).toBe("available");
    expect(snapshot.sharePoint.summary.note).toContain("No Microsoft 365 group-connected");
    expect(snapshot.oneDrive.summary.status).toBe("available");
  });

  it("builds a browser-safe SharePoint inventory from group document libraries when Sites.Read.All is granted", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,jobTitle,department,companyName,officeLocation,usageLocation,preferredLanguage,createdDateTime,assignedLicenses&$top=999")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/subscribedSkus")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/groups?$select=id,displayName,mail,mailEnabled,securityEnabled,groupTypes,visibility,createdDateTime&$top=999")) {
        return jsonResponse({
          value: [
            {
              id: "g-1",
              displayName: "Project Atlas",
              mail: "atlas@contoso.com",
              mailEnabled: true,
              securityEnabled: false,
              groupTypes: ["Unified"]
            }
          ]
        });
      }

      if (url.endsWith("/groups/g-1/members/$count")) {
        return new Response("1", { status: 200 });
      }

      if (url.includes("/groups/g-1/drive?$select=id,name,webUrl,driveType,lastModifiedDateTime,quota")) {
        return jsonResponse({
          id: "drive-1",
          name: "Project Atlas",
          webUrl: "https://contoso.sharepoint.com/sites/atlas/Shared%20Documents",
          lastModifiedDateTime: new Date().toISOString(),
          quota: {
            used: 1024,
            total: 4096,
            remaining: 3072,
            state: "normal"
          }
        });
      }

      if (url.includes("/organization")) {
        return jsonResponse({ value: [] });
      }

      if (url.includes("/directoryRoles")) {
        return jsonResponse({ value: [] });
      }

      // Reports and user drives
      if (url.includes("/reports/")) {
        return new Response("Forbidden", { status: 403 });
      }

      if (url.includes("/drive?$select=")) {
        return new Response("Not found", { status: 404 });
      }

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await collectTenantReportSnapshot(
      async () => "token",
      {
        core: { requested: true, granted: true },
        reports: { requested: true, granted: false },
        advancedAudit: { requested: true, granted: false },
        sites: { requested: true, granted: true }
      }
    );

    expect(snapshot.sharePoint.summary.status).toBe("available");
    expect(snapshot.sharePoint.summary.totalSites).toBe(1);
    expect(snapshot.sharePoint.sites[0]?.groupName).toBe("Project Atlas");
    expect(snapshot.sharePoint.sites[0]?.storageUsedBytes).toBe(1024);
    expect(snapshot.sharePoint.sites[0]?.driveState).toBe("normal");
  });
});

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: {
      "Content-Type": "application/json"
    }
  });
}
