import { useEffect, useState } from "react";
import type { PublicClientApplication, AccountInfo } from "@azure/msal-browser";
import { loadRuntimeConfig } from "@/lib/config/runtime-config";
import type { AuthConfig } from "@/lib/config/runtime-config";
import type { PermissionProfile } from "@/lib/types/reporting";
import {
  acquireAccessToken,
  createPublicClient,
  handleRedirect,
  isPlaceholderConfig,
  login,
  logout,
  probeScopeAccess,
  requestAdvancedAuditConsent
} from "./auth-client";

type AuthStatus = "loading" | "unauthenticated" | "authenticated" | "misconfigured" | "error";

interface AuthState {
  status: AuthStatus;
  config?: AuthConfig;
  instance?: PublicClientApplication;
  account: AccountInfo | null;
  permissionProfile: PermissionProfile;
  error?: string;
}

const defaultPermissionProfile: PermissionProfile = {
  core: { requested: true, granted: false },
  reports: { requested: true, granted: false },
  advancedAudit: { requested: true, granted: false },
  sites: { requested: true, granted: false }
};

export function useAuthSession() {
  const [state, setState] = useState<AuthState>({
    status: "loading",
    account: null,
    permissionProfile: defaultPermissionProfile
  });

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      try {
        const config = await loadRuntimeConfig();

        if (isPlaceholderConfig(config)) {
          if (isMounted) {
            setState({
              status: "misconfigured",
              config,
              account: null,
              permissionProfile: defaultPermissionProfile,
              error: "The runtime config still uses placeholder values."
            });
          }

          return;
        }

        const instance = await createPublicClient(config);
        const { account } = await handleRedirect(instance);
        const permissionProfile = await buildPermissionProfile(instance, config, account);

        if (!isMounted) {
          return;
        }

        setState({
          status: account ? "authenticated" : "unauthenticated",
          config,
          instance,
          account,
          permissionProfile
        });
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setState({
          status: "error",
          account: null,
          permissionProfile: defaultPermissionProfile,
          error: error instanceof Error ? error.message : "Authentication bootstrap failed."
        });
      }
    })();

    return () => {
      isMounted = false;
    };
  }, []);

  return {
    ...state,
    signIn: async () => {
      if (!state.instance || !state.config) {
        return;
      }

      await login(state.instance, state.config);
    },
    signOut: async () => {
      if (!state.instance || !state.config) {
        return;
      }

      await logout(state.instance, state.config, state.account);
    },
    enableAdvancedAudit: async () => {
      if (!state.instance || !state.config || !state.config.allowAuditOptIn) {
        return;
      }

      await requestAdvancedAuditConsent(state.instance, state.config, state.account);
    },
    acquireGraphToken: async (group: "core" | "reports" | "advancedAudit" | "sites") => {
      if (!state.instance || !state.config || !state.account) {
        throw new Error("An authenticated account is required before acquiring a token.");
      }

      return acquireAccessToken(state.instance, state.config, state.account, group);
    }
  };
}

async function buildPermissionProfile(
  instance: PublicClientApplication,
  config: AuthConfig,
  account: AccountInfo | null
): Promise<PermissionProfile> {
  return {
    core: {
      requested: true,
      granted: await probeScopeAccess(instance, config, account, "core"),
      note: "Core inventory and mailbox reporting scopes."
    },
    reports: {
      requested: config.reportsScopes.length > 0,
      granted: await probeScopeAccess(instance, config, account, "reports"),
      note: "Usage reports also require a supported Microsoft Entra role."
    },
    advancedAudit: {
      requested: config.allowAuditOptIn && config.advancedAuditScopes.length > 0,
      granted: await probeScopeAccess(instance, config, account, "advancedAudit"),
      note: "Optional last sign-in summary scope."
    },
    sites: {
      requested: config.sitesScopes.length > 0,
      granted: await probeScopeAccess(instance, config, account, "sites"),
      note: "Optional SharePoint inventory scope."
    }
  };
}
