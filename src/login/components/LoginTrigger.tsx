import { useEffect, useState } from "react";
import { loadRuntimeConfig } from "@/lib/config/runtime-config";
import {
  createPublicClient,
  handleRedirect,
  isPlaceholderConfig,
  login
} from "@/features/auth/auth-client";

type Status = "idle" | "loading" | "redirecting" | "error";

export default function LoginTrigger() {
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);

  const startLogin = async () => {
    setStatus("loading");
    setError(null);

    try {
      const config = await loadRuntimeConfig();

      if (isPlaceholderConfig(config)) {
        setStatus("error");
        setError("Runtime configuration has not been set up yet.");
        return;
      }

      const instance = await createPublicClient(config);
      const { account } = await handleRedirect(instance);

      // Already authenticated — redirect to app
      if (account) {
        window.location.href = config.redirectUri;
        return;
      }

      setStatus("redirecting");
      await login(instance, config);
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "Authentication failed.");
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => void startLogin()}
        disabled={status === "loading" || status === "redirecting"}
        className="btn-primary w-full justify-center py-3.5 text-[15px]"
      >
        {status === "loading" || status === "redirecting" ? (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            {status === "redirecting" ? "Redirecting..." : "Connecting..."}
          </>
        ) : (
          <>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
              <polyline points="10 17 15 12 10 7" />
              <line x1="15" y1="12" x2="3" y2="12" />
            </svg>
            Continue with Microsoft Entra
          </>
        )}
      </button>

      {status === "error" && error && (
        <p className="mt-4 rounded-xl bg-rose-500/8 px-3 py-2 text-sm text-rose-500 text-center">{error}</p>
      )}
    </div>
  );
}
