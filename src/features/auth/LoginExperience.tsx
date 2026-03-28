import * as Dialog from "@radix-ui/react-dialog";
import { withBase } from "@/lib/paths";
import { useAuthSession } from "./useAuthSession";

export default function LoginExperience() {
  const auth = useAuthSession();

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="glass-panel rounded-[2rem] p-8">
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-sky-500">
            Session-only access
          </span>
          <span className="rounded-full border border-ink-900/8 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-ink-700">
            Delegated Graph scopes
          </span>
        </div>

        <h2 className="mt-5 text-3xl font-semibold leading-tight text-ink-950">
          Review the permission model before connecting your tenant.
        </h2>
        <p className="mt-4 max-w-2xl text-base leading-8 text-ink-700">
          Core Microsoft Graph scopes are requested during sign-in. Reporting scopes are also included so the app can collect workload usage exports when your account has the required Microsoft Entra role.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void auth.signIn()}
            disabled={auth.status === "loading" || auth.status === "misconfigured"}
            className="rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5 hover:bg-ink-800 disabled:cursor-not-allowed disabled:bg-ink-700/40"
          >
            {auth.status === "authenticated" ? "Continue to app" : "Sign in with Microsoft Entra"}
          </button>
          <a
            href={withBase("/docs/permissions")}
            className="rounded-full border border-ink-900/10 bg-white/90 px-5 py-3 text-sm font-semibold text-ink-800 transition hover:-translate-y-0.5 hover:border-ink-900/25"
          >
            Review permissions
          </a>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <div className="rounded-[1.4rem] border border-ink-900/8 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">Read-only</p>
            <p className="mt-2 text-sm leading-7 text-ink-700">The product reports only and does not perform remediation.</p>
          </div>
          <div className="rounded-[1.4rem] border border-ink-900/8 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">Zero-storage</p>
            <p className="mt-2 text-sm leading-7 text-ink-700">Tenant data stays in memory for the active browser session.</p>
          </div>
          <div className="rounded-[1.4rem] border border-ink-900/8 bg-white/85 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">Export-ready</p>
            <p className="mt-2 text-sm leading-7 text-ink-700">Generate CSV, JSON, Excel, and HTML outputs locally.</p>
          </div>
        </div>

        {auth.status === "authenticated" && auth.account && (
          <p className="mt-6 rounded-2xl bg-mint-400/10 px-4 py-3 text-sm text-ink-800">
            Signed in as <strong>{auth.account.username}</strong>. Open the reporting workspace to generate a fresh tenant snapshot.
          </p>
        )}

        {auth.error && (
          <p className="mt-6 rounded-2xl bg-rose-400/10 px-4 py-3 text-sm text-ink-800">{auth.error}</p>
        )}
      </section>

      <aside className="glass-panel rounded-[2rem] p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-sky-500">What happens next</p>
        <div className="mt-6 grid gap-4">
          {[
            "Microsoft Entra completes delegated sign-in with PKCE.",
            "The app acquires tokens in sessionStorage only.",
            "Graph responses are normalized in memory after you open the app.",
            "Exports are generated locally and downloaded to your device."
          ].map((step, index) => (
            <div key={step} className="rounded-[1.45rem] border border-ink-900/8 bg-white/85 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-ink-600">Step {index + 1}</p>
              <p className="mt-2 text-sm leading-7 text-ink-700">{step}</p>
            </div>
          ))}
        </div>

        <Dialog.Root>
          <Dialog.Trigger className="mt-8 rounded-full border border-ink-900/10 bg-white/90 px-5 py-3 text-sm font-semibold text-ink-800 transition hover:-translate-y-0.5 hover:border-ink-900/25">
            View scope details
          </Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Overlay className="fixed inset-0 bg-ink-950/50 backdrop-blur-sm" />
            <Dialog.Content className="fixed top-1/2 left-1/2 w-[min(92vw,44rem)] -translate-x-1/2 -translate-y-1/2 rounded-[2rem] border border-ink-900/8 bg-white p-8 shadow-2xl">
              <Dialog.Title className="text-2xl font-semibold text-ink-950">Delegated scope groups</Dialog.Title>
              <Dialog.Description className="mt-3 text-sm leading-7 text-ink-700">
                Core scopes support inventory reporting, Reports.Read.All powers usage datasets, and AuditLog.Read.All remains optional for last sign-in insights.
              </Dialog.Description>
              <div className="mt-6 grid gap-4">
                <div className="rounded-[1.5rem] border border-ink-900/10 bg-sand-100 p-4">
                  <p className="font-semibold text-ink-900">Core scopes</p>
                  <p className="mt-2 text-sm leading-7 text-ink-700">openid, profile, email, User.Read, User.Read.All, GroupMember.Read.All, LicenseAssignment.Read.All, MailboxSettings.Read</p>
                </div>
                <div className="rounded-[1.5rem] border border-ink-900/10 bg-sand-100 p-4">
                  <p className="font-semibold text-ink-900">Reports scope</p>
                  <p className="mt-2 text-sm leading-7 text-ink-700">Reports.Read.All enables usage exports, but your account still needs a supported Entra admin or reports reader role.</p>
                </div>
                <div className="rounded-[1.5rem] border border-ink-900/10 bg-sand-100 p-4">
                  <p className="font-semibold text-ink-900">Advanced audit</p>
                  <p className="mt-2 text-sm leading-7 text-ink-700">AuditLog.Read.All is only requested if you explicitly enable last sign-in summaries from inside the app.</p>
                </div>
              </div>
              <Dialog.Close className="mt-6 rounded-full bg-ink-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-ink-800">
                Close
              </Dialog.Close>
            </Dialog.Content>
          </Dialog.Portal>
        </Dialog.Root>
      </aside>
    </div>
  );
}
