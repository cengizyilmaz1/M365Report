import fs from "node:fs";
import path from "node:path";
import { normalizeConfig, parseRuntimeConfig } from "./runtime-config.mjs";

const [, , outputPath = "./public/runtime-config.json"] = process.argv;
const resolvedOutputPath = path.resolve(process.cwd(), outputPath);

const config = normalizeConfig(
  parseRuntimeConfig({
    appName: process.env.PUBLIC_APP_NAME ?? "M365 Tenant Reporter",
    siteUrl: process.env.PUBLIC_SITE_URL ?? "https://m365report.cengizyilmaz.net",
    basePath: process.env.PUBLIC_BASE_PATH ?? "/",
    authority: process.env.PUBLIC_AUTHORITY ?? "https://login.microsoftonline.com/organizations",
    clientId: process.env.PUBLIC_CLIENT_ID ?? "REPLACE_WITH_ENTRA_CLIENT_ID",
    knownAuthorities: splitList(process.env.PUBLIC_KNOWN_AUTHORITIES),
    loginRedirectPath: process.env.PUBLIC_LOGIN_REDIRECT_PATH ?? "/login",
    postLogoutRedirectPath: process.env.PUBLIC_POST_LOGOUT_REDIRECT_PATH ?? "/",
    coreScopes: splitList(
      process.env.PUBLIC_CORE_SCOPES ??
        "openid,profile,email,User.Read,User.Read.All,GroupMember.Read.All,LicenseAssignment.Read.All,MailboxSettings.Read,RoleManagement.Read.All"
    ),
    reportsScopes: splitList(process.env.PUBLIC_REPORTS_SCOPES ?? "Reports.Read.All"),
    advancedAuditScopes: splitList(process.env.PUBLIC_ADVANCED_AUDIT_SCOPES ?? "AuditLog.Read.All"),
    sitesScopes: splitList(process.env.PUBLIC_SITES_SCOPES ?? "Sites.Read.All"),
    allowAuditOptIn: normalizeBoolean(process.env.PUBLIC_ALLOW_AUDIT_OPT_IN, true)
  })
);

fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
fs.writeFileSync(resolvedOutputPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");

console.log(`Runtime config written: ${resolvedOutputPath}`);

function splitList(value) {
  return value
    ? value
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];
}

function normalizeBoolean(value, fallback) {
  if (value === undefined) {
    return fallback;
  }

  return value.toLowerCase() === "true";
}
