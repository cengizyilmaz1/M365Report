import { z } from "zod";

const placeholderPattern = /REPLACE_|CHANGE_ME|example\.com/i;

export const runtimeConfigSchema = z.object({
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

export function parseRuntimeConfig(input) {
  return runtimeConfigSchema.parse(input);
}

export function hasPlaceholders(config) {
  return [
    config.appName,
    config.siteUrl,
    config.authority,
    config.clientId,
    ...config.knownAuthorities
  ].some((value) => placeholderPattern.test(value));
}

export function normalizeConfig(config) {
  return {
    ...config,
    siteUrl: config.siteUrl.replace(/\/+$/, ""),
    basePath: ensureSlashes(config.basePath),
    loginRedirectPath: ensureLeadingSlash(config.loginRedirectPath),
    postLogoutRedirectPath: ensureLeadingSlash(config.postLogoutRedirectPath)
  };
}

export function ensureLeadingSlash(value) {
  return value.startsWith("/") ? value : `/${value}`;
}

export function ensureSlashes(value) {
  const withLeadingSlash = ensureLeadingSlash(value);
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}
