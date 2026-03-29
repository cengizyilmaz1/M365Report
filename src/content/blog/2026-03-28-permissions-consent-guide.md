---
title: "How Microsoft Graph permissions and admin consent work in M365 Tenant Reporter"
description: "A detailed breakdown of every delegated permission scope — openid, profile, email, User.Read, User.Read.All, GroupMember.Read.All, LicenseAssignment.Read.All, MailboxSettings.Read, Organization.Read.All, RoleManagement.Read.All, Sites.Read.All, Reports.Read.All, and AuditLog.Read.All — with guidance on admin consent, security review conversations, and optional scope groups."
category: "Permissions"
reading_time: "14 min read"
keywords:
  - microsoft graph delegated permissions
  - reports.read.all
  - auditlog.read.all
  - admin consent microsoft 365
  - graph api scopes explained
  - openid profile email scopes
  - user.read.all permission
  - groupmember.read.all
  - licenseassignment.read.all
  - mailboxsettings.read
  - organization.read.all
  - delegated vs application permissions
  - microsoft entra permission review
---

Permission scopes are the foundation of trust between M365 Tenant Reporter and your Microsoft 365 tenant. Every piece of data the tool can access is governed by the delegated scopes you consent to during sign-in. This guide provides a thorough explanation of each scope, why it is needed, what data it unlocks, and how to communicate the permission model to security and compliance teams during evaluation.

## How delegated permissions work in Microsoft Graph

Before diving into individual scopes, it is important to understand the delegated permission model. When a user signs into M365 Tenant Reporter, the application receives an access token that carries two constraints simultaneously:

- **The scopes granted to the application** — These define the maximum boundary of what the app is allowed to request from the Graph API.
- **The signed-in user's own permissions** — The user cannot access data through the app that they could not access through native Microsoft tools.

The effective permission is always the intersection of these two constraints. This means that even if the app has been granted `User.Read.All`, a user without directory read privileges in your tenant will not be able to retrieve the full user list. Delegated permissions do not elevate a user's access — they merely allow the application to act within the user's existing authorization boundary.

> **Key distinction:** Application permissions (used by background services and daemon apps) are not constrained by a user context. M365 Tenant Reporter does not use application permissions at all. Every Graph call requires an active, authenticated user session.

## Identity scopes: openid, profile, and email

These three scopes are part of the OpenID Connect standard and are required for any modern authentication flow against Microsoft Entra.

### openid

The `openid` scope is mandatory for any OpenID Connect authentication request. It tells Microsoft Entra to return an ID token alongside the access token. The ID token contains claims about the authenticated user — such as their object ID, tenant ID, and the time of authentication — that the application uses to establish the session context.

This scope does not grant access to any Microsoft Graph data. It is purely an authentication mechanism.

### profile

The `profile` scope grants access to basic identity claims: the user's display name, first name, last name, and username (UPN). M365 Tenant Reporter uses these claims to show the signed-in user's name in the reporting workspace header, confirming which account is currently authenticated.

### email

The `email` scope provides the user's primary email address from their Entra profile. This is used alongside the profile claims to display the authenticated identity and does not grant access to the user's mailbox content or Exchange data.

> **For security reviewers:** These three identity scopes are standard for any application that authenticates against Microsoft Entra. They do not expose tenant directory data, mailbox content, or any other organizational information. Declining them would prevent authentication entirely.

## User.Read — signed-in user profile

The `User.Read` scope allows the application to read the profile of the currently signed-in user. This is the most basic Graph permission and is included by default in nearly every Microsoft Entra app registration. It provides access to properties like `displayName`, `mail`, `jobTitle`, `department`, and `officeLocation` for the authenticated user only.

M365 Tenant Reporter uses this scope to populate the session header and to confirm the signed-in user's tenant context before initiating broader data collection. Without this scope, the app would not be able to verify which user is authenticated or which tenant the session belongs to.

## User.Read.All — full directory user inventory

The `User.Read.All` scope is the first scope that requires admin consent. It allows the application to read the complete user directory for the tenant, including all member accounts, guest accounts, and service accounts visible in Microsoft Entra.

This scope unlocks the core user reporting capability. Specifically, it enables M365 Tenant Reporter to:

- Retrieve every user object from the `/users` endpoint, including properties like `userType`, `accountEnabled`, `createdDateTime`, `assignedLicenses`, and `signInActivity` (when combined with audit scopes).
- Distinguish between member users and guest users based on the `userType` field.
- Identify disabled accounts that may still consume licenses.
- Build the total users, licensed users, and unlicensed users reports.

Without `User.Read.All`, the application would only be able to see the signed-in user's own profile, making tenant-wide reporting impossible.

> **Why admin consent is required:** This scope exposes directory data for all users in the tenant, not just the signed-in user. Microsoft requires a Global Administrator (or a user with the appropriate admin role) to consent to this scope on behalf of the organization.

## GroupMember.Read.All — group membership visibility

The `GroupMember.Read.All` scope provides read access to group memberships across the tenant. This includes Microsoft 365 Groups, Security Groups, Distribution Lists, and Mail-Enabled Security Groups.

M365 Tenant Reporter uses this scope to:

- Report on total group counts and group type distribution.
- Show which groups a given user belongs to.
- Identify groups with large membership counts that may warrant governance attention.
- Distinguish between dynamic membership groups and statically assigned groups.

Group membership data is essential for understanding the collaboration and access control landscape of a tenant. Organizations that rely heavily on group-based license assignment, Conditional Access policies targeting groups, or Teams provisioning through group membership will find this data particularly valuable for operational reviews.

## LicenseAssignment.Read.All — license inventory

The `LicenseAssignment.Read.All` scope enables the application to read license assignment information across the tenant. This includes both directly assigned licenses and group-based license assignments.

This scope powers the licensed users and unlicensed users reports by providing:

- The list of `assignedLicenses` on each user object, including the SKU ID for each assigned license.
- The ability to resolve SKU IDs to human-readable product names (such as "Microsoft 365 E3" or "Power BI Pro") using the tenant's `subscribedSkus` data.
- Visibility into license stacking — users who have multiple SKU assignments, which may indicate redundancy or intentional entitlement layering.
- Identification of users with zero assigned licenses who may be candidates for cleanup or may be shared mailbox accounts that do not require licensing.

> **Procurement relevance:** This scope is what makes M365 Tenant Reporter useful for license optimization and renewal planning conversations. Without it, the application can see users but cannot determine their licensing posture.

## MailboxSettings.Read — mailbox purpose classification

The `MailboxSettings.Read` scope allows the application to read mailbox settings for users in the tenant. This does not provide access to mailbox content (emails, calendar items, contacts) — it only exposes configuration metadata such as the mailbox type, automatic reply settings, language, and time zone.

M365 Tenant Reporter uses this scope primarily to classify mailboxes by purpose:

- **User mailboxes** — Standard mailboxes attached to licensed user accounts.
- **Shared mailboxes** — Mailboxes that do not require a license and are accessed by multiple users through delegation.
- **Room and equipment mailboxes** — Resource mailboxes used for booking meeting rooms or shared equipment.

This classification is operationally important because shared mailboxes and resource mailboxes frequently appear in user counts but represent a fundamentally different licensing and management posture. Being able to filter them out — or report on them separately — gives administrators a more accurate picture of true user-based consumption.

## Organization.Read.All — tenant identity and verified domains

The `Organization.Read.All` scope allows the application to read the current organization's richer directory profile. While `User.Read` is enough to access only the most basic organization properties such as `id`, `displayName`, and `verifiedDomains`, M365 Tenant Reporter now also uses organization metadata like tenant type, country code, creation date, preferred language, and technical notification contacts to enrich the dashboard header.

This scope enables the application to:

- Read `/organization` with a full property set rather than receiving `null` for non-basic fields.
- Show the tenant information banner with the primary verified domain, tenant type, and country code.
- Provide additional administrative context when reviewing reports across multiple tenants or subsidiaries.

This is still a read-only delegated scope. It does not allow any changes to tenant branding, domains, licenses, or directory settings.

## RoleManagement.Read.All — admin role inventory

The `RoleManagement.Read.All` scope allows the application to read directory role definitions and their assigned members. M365 Tenant Reporter uses this data in the security section to understand which accounts hold privileged Microsoft Entra roles and whether those privileged accounts have MFA registered.

This scope enables the application to:

- Enumerate activated directory roles through `/directoryRoles`.
- Read the members of each role through `/directoryRoles/{id}/members`.
- Build the admin security summary, including total privileged accounts and admins without MFA registration.

Because this is still a read-only delegated permission, the app can inspect privileged role assignments but cannot change them.

## Sites.Read.All — SharePoint library inventory

The `Sites.Read.All` scope allows the application to read SharePoint site and document library metadata through delegated Microsoft Graph calls. In the current browser-only architecture, M365 Tenant Reporter uses this scope for a constrained, read-only inventory of Microsoft 365 group-connected SharePoint document libraries and their storage quotas.

This scope enables the application to:

- Read each Microsoft 365 group's default document library through `/groups/{id}/drive`.
- Capture quota metadata such as used, remaining, and total storage.
- Build the SharePoint section without persisting data or relying on server-side workers.

This scope does **not** grant write access to files or sites. It also does not turn the app into a SharePoint administration portal. The implementation intentionally stays within read-only metadata collection and avoids operations that would modify site content or permissions.

## Reports.Read.All — Microsoft 365 usage reports

The `Reports.Read.All` scope grants read access to Microsoft 365 service usage reports. These are the same reports available in the Microsoft 365 admin center under Reports > Usage, but accessed programmatically through the Graph API.

This scope enables M365 Tenant Reporter to collect:

- **Email activity reports** — Message send and receive counts per user over configurable time periods.
- **OneDrive and SharePoint usage** — Storage consumption and file activity metrics.
- **Teams activity** — Message counts, calls, and meeting participation.
- **Yammer / Viva Engage activity** — Post and engagement metrics for organizations using the platform.

> **Important consideration:** In many tenants, usage report data is restricted to administrators by default. If your organization has enabled the "conceal user, group, and site names in all reports" privacy setting in the Microsoft 365 admin center, the Graph API will return obfuscated user identifiers instead of display names. M365 Tenant Reporter will still function, but user-level attribution in usage reports will be anonymized.

This scope is part of the **optional** scope group. Organizations that only need user inventory and licensing data can decline this scope and still use the core reporting features.

## AuditLog.Read.All — sign-in activity and audit data

The `AuditLog.Read.All` scope provides read access to the Microsoft Entra audit and sign-in logs. This is the most sensitive optional scope and is separated from the core permission set so organizations can evaluate it independently.

With this scope enabled, M365 Tenant Reporter can:

- Retrieve the `signInActivity` property on user objects, which includes the last interactive and non-interactive sign-in timestamps.
- Read `/reports/authenticationMethods/userRegistrationDetails` to calculate MFA registration coverage and flag privileged users without MFA.
- Identify stale accounts that have not signed in for extended periods — a critical finding for security hygiene and license reclamation.
- Support time-based filtering in reports, such as "show me all users who have not signed in within the last 90 days."

Without this scope, the user reports will still function but the last sign-in columns will be empty or unavailable. The tool degrades gracefully — it does not fail if audit data is inaccessible.

> **When to enable this scope:** Enable `AuditLog.Read.All` when your reporting needs include security posture assessment, stale account identification, or license reclamation based on activity. If your initial goal is strictly inventory and licensing, you can defer this scope and add it later through a re-consent flow.

## How admin consent works in practice

For scopes that require admin consent, a Global Administrator (or an administrator with the Cloud Application Administrator role and appropriate consent policy) must approve the permissions on behalf of the organization. There are two common approaches:

1. **Inline consent during first sign-in.** If a Global Administrator is the first person to sign into the application, the consent prompt will include an "on behalf of your organization" checkbox. Checking this box grants the permissions tenant-wide so that subsequent users do not see a consent prompt.

2. **Pre-consent through the Entra admin center.** Navigate to Enterprise Applications in the Microsoft Entra admin center, locate the M365 Tenant Reporter app registration, go to Permissions, and click "Grant admin consent." This approach is preferred in organizations with formal change management processes because it separates the consent decision from the first sign-in.

After admin consent is granted, the permissions appear in the application's consent record in Entra and will not prompt users again unless the application requests additional scopes in a future update.

## Communicating scopes to security teams

When presenting M365 Tenant Reporter to a security review board or InfoSec team, frame the permissions conversation around three key points:

- **Read-only access.** Every scope in the permission set is a read scope. The application cannot modify users, change group memberships, assign licenses, reset passwords, or alter any tenant configuration.
- **Delegated, not application-level.** The app acts within the signed-in user's existing authorization boundary. There is no daemon or service principal running in the background with tenant-wide access.
- **Modular consent.** Core scopes (user inventory, groups, licensing, mailbox settings) are separated from optional scopes (usage reports, audit logs). Teams can consent to only what they need for their reporting objectives.

Providing the full scope list in a table format — with each scope, its purpose, whether it requires admin consent, and what data it exposes — is an effective way to accelerate security reviews. Most enterprise security teams are familiar with Microsoft Graph permission documentation and will appreciate the transparency of a scope-by-scope breakdown.

## Summary

M365 Tenant Reporter requests only the delegated read permissions necessary to power its reporting modules. The permission model is modular, transparent, and designed for incremental consent. Core scopes cover tenant identity, user inventory, group memberships, license assignments, and mailbox classification. Optional scopes extend the reporting surface to include SharePoint and OneDrive inventory, Microsoft 365 usage analytics, and Entra sign-in activity. By understanding each scope and its purpose, administrators and security reviewers can make informed decisions about what data to expose and when.
