import { afterEach, describe, expect, it, vi } from "vitest";
import { collectTenantReportSnapshot } from "./report-service";

describe("collectTenantReportSnapshot", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("normalizes overview data and degrades gracefully for group and mailbox caveats", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url.includes("/users?$select=id,displayName,userPrincipalName,mail,accountEnabled,userType,assignedLicenses&$top=999")) {
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

      if (url.endsWith("/subscribedSkus")) {
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
              }
            }
          ]
        });
      }

      if (url.includes("/groups?$select=id,displayName,mailEnabled,securityEnabled,groupTypes&$top=999")) {
        return jsonResponse({
          value: [
            {
              id: "g-1",
              displayName: "All Employees",
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

      throw new Error(`Unexpected request: ${url}`);
    });

    vi.stubGlobal("fetch", fetchMock);

    const snapshot = await collectTenantReportSnapshot(
      async () => "token",
      {
        core: { requested: true, granted: true },
        reports: { requested: true, granted: false },
        advancedAudit: { requested: true, granted: false }
      }
    );

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
    expect(snapshot.notes.some((note) => note.includes("service principal members"))).toBe(true);
    expect(snapshot.notes.some((note) => note.includes("mailboxSettings.userPurpose"))).toBe(true);
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
