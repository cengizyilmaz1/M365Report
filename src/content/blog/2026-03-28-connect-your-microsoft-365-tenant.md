---
title: "How to connect your Microsoft 365 tenant to M365 Tenant Reporter"
description: "A comprehensive walkthrough of the sign-in flow — from the /login route through MSAL PKCE authentication, Microsoft Entra redirect, delegated Graph consent, and into a live reporting session."
category: "Getting Started"
reading_time: "12 min read"
keywords:
  - connect microsoft 365 tenant
  - m365report login
  - microsoft entra consent flow
  - msal pkce authentication
  - delegated graph permissions
  - microsoft 365 onboarding
  - admin consent prompt
  - single page app authentication
---

Connecting your Microsoft 365 tenant to M365 Tenant Reporter is the first step toward gaining visibility into your user inventory, licensing posture, and mailbox configuration. The process is designed to be transparent and auditable — every permission is declared upfront, no background service accounts are created, and no data leaves the browser. This guide walks through the full sign-in flow in detail so IT administrators and security reviewers can evaluate exactly what happens before, during, and after authentication.

## Starting from the /login route

The dedicated `/login` route exists to separate the authentication experience from the public marketing pages. When an administrator navigates to this route, they see a clear call to action that initiates the Microsoft Entra sign-in flow. This separation is intentional: it means the app never silently attempts authentication in the background, and operators always know when they are entering a credentialed session.

From an operational standpoint, the `/login` route is the URL you should bookmark internally, share with colleagues during onboarding, and reference in any change management documentation. Because it is a stable, predictable entry point, it simplifies testing in staging environments and makes it straightforward to verify that the correct Entra app registration is being targeted.

## What MSAL and PKCE mean for your security posture

M365 Tenant Reporter authenticates using the Microsoft Authentication Library (MSAL) with the Authorization Code flow and Proof Key for Code Exchange (PKCE). PKCE is a security extension originally designed for public clients — applications that cannot safely store a client secret, such as single-page apps running entirely in the browser.

Here is how the PKCE flow works at a high level:

- The browser generates a random `code_verifier` string and derives a `code_challenge` from it using SHA-256.
- When the user is redirected to Microsoft Entra, the `code_challenge` is sent along with the authorization request.
- After the user authenticates and consents, Entra returns an authorization code to the browser.
- The browser exchanges that code for an access token by presenting the original `code_verifier`, which Entra validates against the previously received challenge.

> **Why this matters:** PKCE ensures that even if an attacker intercepts the authorization code during the redirect, they cannot exchange it for a token because they do not possess the original `code_verifier`. This eliminates an entire class of redirect interception attacks that older implicit grant flows were vulnerable to.

Because the entire flow runs in the browser with no backend token exchange, there is no server-side component that stores or proxies tokens. The access token lives in the browser's memory for the duration of the session and is never persisted to disk, local storage, or a cookie.

## The Microsoft Entra redirect in detail

When the sign-in button is clicked, the browser redirects to Microsoft Entra (formerly Azure Active Directory) at `login.microsoftonline.com`. The redirect URL includes several important parameters:

- **client_id** — The application registration ID that identifies M365 Tenant Reporter to your tenant.
- **redirect_uri** — The URL the browser will return to after authentication completes.
- **scope** — The list of delegated Microsoft Graph permissions being requested.
- **response_type=code** — Indicates that the Authorization Code flow is being used rather than the legacy implicit flow.
- **code_challenge** and **code_challenge_method** — The PKCE parameters described above.

At the Entra login screen, the user authenticates with their organizational credentials (and any MFA policies your tenant enforces). After successful authentication, Entra presents the consent prompt, which lists every delegated permission the application is requesting. The user — or a Global Administrator performing admin consent — reviews and approves those permissions before being redirected back to the application.

## Delegated permissions vs. application permissions

Understanding the distinction between delegated and application permissions is critical for any security review. M365 Tenant Reporter uses **delegated permissions exclusively**, which means:

- The application can only access data that the signed-in user themselves has permission to see.
- Access is bounded by the intersection of the app's granted scopes and the user's own privileges.
- No background or daemon access is possible — if the browser tab is closed, the session ends.

This is fundamentally different from **application permissions**, which grant tenant-wide access that runs without a signed-in user context. Application permissions are commonly used by background services, ETL pipelines, and third-party SaaS platforms that sync data on a schedule. They represent a broader trust boundary because they are not constrained by any individual user's role.

> **For security reviewers:** Because M365 Tenant Reporter never uses application permissions, it cannot access data beyond what the signed-in administrator can already see through native Microsoft tools. The app does not elevate privileges — it reads the same data the admin could retrieve manually through the Microsoft 365 admin center or Graph Explorer.

## What happens after the redirect

Once the user is redirected back to the application with a valid authorization code, the browser completes the PKCE token exchange and receives an access token. At this point, the application transitions from the login view to the reporting workspace, where it begins collecting data from the Microsoft Graph API.

The data collection phase makes a series of Graph API calls — fetching users, group memberships, license assignments, mailbox settings, and (if the relevant scopes were consented) usage reports and audit sign-in data. All of this data is held in browser memory as a point-in-time snapshot. The reporting workspace then renders overview cards, charts, and detailed tables from that in-memory dataset.

It is worth emphasizing that no data is sent to any external server during this process. The Graph API calls go directly from the browser to `graph.microsoft.com`, and the responses are processed entirely client-side.

## Troubleshooting common consent errors

Administrators occasionally encounter errors during the consent flow. Here are the most common scenarios and their resolutions:

- **AADSTS65001 — The user or administrator has not consented to use the application.** This typically means admin consent is required for one or more scopes. A Global Administrator needs to complete the consent flow, or you can use the Entra admin center to grant admin consent for the application.
- **AADSTS650052 — The app is requesting permissions not available in the tenant.** This can occur if your tenant has restrictions on which Graph permissions can be consented. Check your Entra ID consent settings under Enterprise Applications.
- **AADSTS70011 — The provided scope is invalid.** This usually indicates a mismatch between the scopes requested by the application and those configured in the app registration. Verify the app registration in Entra matches the expected configuration.
- **Redirect URI mismatch errors.** The redirect URI configured in Entra must exactly match the one the application sends during the authorization request, including the protocol, hostname, port, and path. Trailing slashes matter.
- **Conditional Access policy blocks.** If your tenant enforces Conditional Access policies that restrict app access to compliant devices or specific network locations, the sign-in may be blocked even though the credentials are correct. Review your CA policies to ensure the M365 Tenant Reporter app registration is not inadvertently excluded.

> **Tip:** If you are evaluating the tool in a development or test tenant before rolling it out to production, consider performing the initial consent with a Global Administrator account so that all delegated scopes are approved tenant-wide. This avoids per-user consent prompts for non-admin users later.

## Best practices for IT admins onboarding the tool

When introducing M365 Tenant Reporter to your organization, consider the following onboarding practices:

1. **Review permissions before first sign-in.** Share the permissions documentation page with your security team so they can evaluate each scope against your organization's data access policies before anyone authenticates.
2. **Use a test tenant first.** If your organization has a Microsoft 365 developer tenant or sandbox environment, perform the initial evaluation there. This lets you explore the full reporting surface without touching production data.
3. **Document the app registration.** Record the client ID, redirect URI, and consented scopes in your organization's application inventory. Even though the tool does not store data server-side, it should still be tracked as a registered application in your Entra tenant.
4. **Coordinate with Conditional Access owners.** If your tenant uses Conditional Access policies, confirm that the sign-in flow works from the networks and devices your admins will use.
5. **Establish an export handling policy.** While the application itself stores nothing, the CSV, Excel, and HTML exports that users download do contain tenant data. Make sure your team knows where exports should be saved, how long they should be retained, and who is authorized to share them.

## Summary

The connection flow in M365 Tenant Reporter is built on modern, standards-based authentication — MSAL with PKCE, delegated-only permissions, and a browser-contained session lifecycle. There is no backend server receiving your data, no persistent token storage, and no application-level permissions that could be exploited outside of a user session. By starting from the `/login` route and understanding what each step of the Entra redirect does, administrators can confidently onboard the tool and explain its security model to stakeholders across the organization.
