import {
  BrowserCacheLocation,
  InteractionRequiredAuthError,
  PublicClientApplication
} from "@azure/msal-browser";
import type { AccountInfo, AuthenticationResult, SilentRequest } from "@azure/msal-browser";
import type { AuthConfig } from "@/lib/config/runtime-config";

export type PermissionGroup = "core" | "reports" | "advancedAudit";

export function isPlaceholderConfig(config: AuthConfig) {
  return /REPLACE_|CHANGE_ME|example\.com/i.test(`${config.clientId}${config.siteUrl}`);
}

export async function createPublicClient(config: AuthConfig) {
  const instance = new PublicClientApplication({
    auth: {
      clientId: config.clientId,
      authority: config.authority,
      knownAuthorities: config.knownAuthorities,
      redirectUri: config.redirectUri,
      postLogoutRedirectUri: config.postLogoutRedirectUri
    },
    cache: {
      cacheLocation: BrowserCacheLocation.SessionStorage
    }
  });

  await instance.initialize();

  return instance;
}

export async function handleRedirect(instance: PublicClientApplication) {
  const result = await instance.handleRedirectPromise();
  const account = result?.account ?? instance.getActiveAccount() ?? instance.getAllAccounts()[0] ?? null;

  if (account) {
    instance.setActiveAccount(account);
  }

  return {
    account,
    result
  };
}

export function getScopes(config: AuthConfig, group: PermissionGroup, includeIdentityScopes = false) {
  if (group === "core") {
    return includeIdentityScopes ? config.coreScopes : withoutIdentityScopes(config.coreScopes);
  }

  if (group === "reports") {
    return config.reportsScopes;
  }

  return config.advancedAuditScopes;
}

export async function login(instance: PublicClientApplication, config: AuthConfig) {
  await instance.loginRedirect({
    scopes: [...config.coreScopes, ...config.reportsScopes],
    redirectStartPage: window.location.href
  });
}

export async function requestAdvancedAuditConsent(
  instance: PublicClientApplication,
  config: AuthConfig,
  account: AccountInfo | null
) {
  await instance.acquireTokenRedirect({
    scopes: config.advancedAuditScopes,
    account: account ?? undefined,
    redirectStartPage: window.location.href
  });
}

export async function logout(instance: PublicClientApplication, config: AuthConfig, account: AccountInfo | null) {
  await instance.logoutRedirect({
    account: account ?? undefined,
    postLogoutRedirectUri: config.postLogoutRedirectUri
  });
}

export async function acquireAccessToken(
  instance: PublicClientApplication,
  config: AuthConfig,
  account: AccountInfo,
  group: PermissionGroup
) {
  const request: SilentRequest = {
    account,
    scopes: getScopes(config, group)
  };

  try {
    const result = await instance.acquireTokenSilent(request);
    return result.accessToken;
  } catch (error) {
    if (error instanceof InteractionRequiredAuthError) {
      throw new Error(`The ${group} permission set requires additional user interaction.`, {
        cause: error
      });
    }

    throw error;
  }
}

export async function probeScopeAccess(
  instance: PublicClientApplication,
  config: AuthConfig,
  account: AccountInfo | null,
  group: PermissionGroup
) {
  if (!account) {
    return false;
  }

  const scopes = getScopes(config, group);

  if (scopes.length === 0) {
    return false;
  }

  try {
    const response = await instance.acquireTokenSilent({
      account,
      scopes
    });

    return hasGrantedScopes(response, scopes);
  } catch {
    return false;
  }
}

function hasGrantedScopes(result: AuthenticationResult, expectedScopes: string[]) {
  const granted = new Set(result.scopes.map((scope) => scope.toLowerCase()));
  return expectedScopes.every((scope) => granted.has(scope.toLowerCase()));
}

function withoutIdentityScopes(scopes: string[]) {
  return scopes.filter((scope) => !["openid", "profile", "email"].includes(scope));
}
