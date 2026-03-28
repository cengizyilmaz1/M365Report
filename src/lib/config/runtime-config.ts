import { z } from "zod";
import { withBaseOrigin } from "@/lib/paths";

const runtimeConfigSchema = z.object({
  appName: z.string().trim().min(1),
  siteUrl: z.url(),
  basePath: z.string().trim().min(1),
  authority: z.url(),
  clientId: z.string().trim().min(1),
  knownAuthorities: z.array(z.string().trim().min(1)).default([]),
  loginRedirectPath: z.string().trim().min(1),
  postLogoutRedirectPath: z.string().trim().min(1),
  coreScopes: z.array(z.string().trim().min(1)).min(1),
  reportsScopes: z.array(z.string().trim().min(1)).default([]),
  advancedAuditScopes: z.array(z.string().trim().min(1)).default([]),
  allowAuditOptIn: z.boolean().default(true)
});

export type RuntimeConfig = z.infer<typeof runtimeConfigSchema>;

export interface AuthConfig extends RuntimeConfig {
  baseUrl: string;
  redirectUri: string;
  postLogoutRedirectUri: string;
}

export async function loadRuntimeConfig() {
  const response = await fetch(`${import.meta.env.BASE_URL}runtime-config.json`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("Unable to load runtime configuration.");
  }

  const json = await response.json();
  const parsed = runtimeConfigSchema.parse(json);

  return buildAuthConfig(parsed);
}

export function buildAuthConfig(config: RuntimeConfig): AuthConfig {
  const siteUrl = config.siteUrl.replace(/\/+$/, "");
  const basePath = ensureSlashes(config.basePath);
  const baseUrl = new URL(basePath, `${siteUrl}/`).toString().replace(/\/+$/, "");
  const redirectUri = withBaseOrigin(siteUrl, basePath, config.loginRedirectPath);
  const postLogoutRedirectUri = withBaseOrigin(siteUrl, basePath, config.postLogoutRedirectPath);

  return {
    ...config,
    siteUrl,
    basePath,
    baseUrl,
    redirectUri,
    postLogoutRedirectUri
  };
}

function ensureLeadingSlash(value: string) {
  return value.startsWith("/") ? value : `/${value}`;
}

function ensureSlashes(value: string) {
  const withLeadingSlash = ensureLeadingSlash(value);
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}
