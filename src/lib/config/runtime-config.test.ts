import { describe, expect, it } from "vitest";
import { buildAuthConfig } from "./runtime-config";

describe("buildAuthConfig", () => {
  it("resolves redirect paths against the configured base path", () => {
    const config = buildAuthConfig({
      appName: "M365 Tenant Reporter",
      siteUrl: "https://contoso.github.io",
      basePath: "/tenant-reporter/",
      authority: "https://login.microsoftonline.com/organizations",
      clientId: "00000000-0000-0000-0000-000000000000",
      knownAuthorities: [],
      loginRedirectPath: "/login",
      postLogoutRedirectPath: "/",
      coreScopes: ["openid", "User.Read"],
      reportsScopes: ["Reports.Read.All"],
      advancedAuditScopes: ["AuditLog.Read.All"],
      sitesScopes: ["Sites.Read.All"],
      allowAuditOptIn: true
    });

    expect(config.baseUrl).toBe("https://contoso.github.io/tenant-reporter");
    expect(config.redirectUri).toBe("https://contoso.github.io/tenant-reporter/login");
    expect(config.postLogoutRedirectUri).toBe("https://contoso.github.io/tenant-reporter/");
  });
});
