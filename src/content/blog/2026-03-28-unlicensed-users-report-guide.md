---
title: "How to review unlicensed users and close coverage gaps in Microsoft 365"
description: "A comprehensive guide to identifying, triaging, and remediating unlicensed identities in your Microsoft 365 tenant using the M365 Tenant Reporter unlicensed users report."
category: "Licensing"
reading_time: "14 min read"
keywords:
  - unlicensed users report
  - microsoft 365 unlicensed accounts
  - license coverage gap
  - stale identity cleanup
  - guest user audit
  - service account licensing
  - microsoft entra unlicensed
  - license provisioning workflow
  - identity hygiene
---

Every Microsoft 365 tenant accumulates unlicensed identities over time. Some are entirely expected -- external guests collaborating on a project, shared mailboxes that do not require a paid license, or service accounts that authenticate through application credentials rather than interactive sign-in. Others represent genuine provisioning failures where a new hire was created in Microsoft Entra but never received the licenses they need to do their job. The unlicensed users report in M365 Tenant Reporter exists to surface all of these identities in a single, sortable view so administrators can separate the expected from the actionable.

## What "unlicensed" actually means in Microsoft 365

An identity is considered unlicensed when its `assignedLicenses` collection in Microsoft Graph is empty. This is a straightforward check: M365 Tenant Reporter queries `/users` with the `assignedLicenses` property selected and counts zero entries. It is important to understand that "unlicensed" does not necessarily mean "broken." The Microsoft 365 identity model allows user objects to exist in the directory for purposes that have nothing to do with consuming a paid subscription seat.

> A user object with zero assigned licenses is not inherently a problem. It becomes a problem when the identity was supposed to have a license and does not, or when the identity no longer serves any purpose and is consuming directory space without oversight.

The report displays every user whose `assignedLicenseCount` is zero, along with their display name, user principal name, account enabled status, user type (Member or Guest), and last successful sign-in timestamp when AuditLog.Read.All is consented. This combination of columns makes it possible to triage quickly without switching between the Microsoft Entra admin center, Exchange admin center, and PowerShell.

## Common reasons an identity is unlicensed

Understanding the typical categories of unlicensed accounts helps you build a mental model for what to expect. In most tenants, unlicensed identities fall into five buckets:

- **Guest users.** External identities invited through Microsoft Entra B2B collaboration are created as user objects with `userType: Guest`. They do not consume licenses from your tenant's subscriptions. Their presence in the unlicensed report is expected and usually requires no action beyond periodic access review.
- **Shared mailboxes.** When Exchange Online provisions a shared mailbox, it creates a user object in the directory. Shared mailboxes under 50 GB do not require a license, so they show up as unlicensed by design. M365 Tenant Reporter cross-references mailbox purpose data to help you identify these.
- **Service accounts and application identities.** Some organizations create standard user objects for service integrations rather than using app registrations. These accounts are often left unlicensed because they authenticate through client credentials or certificates rather than interactive flows.
- **Disabled accounts pending deletion.** When an employee departs, many organizations disable the account and remove licenses before the retention period expires. These accounts are unlicensed but still present in the directory.
- **Provisioning failures.** The genuinely problematic category. A user was created through HR-driven provisioning, Azure AD Connect sync, or manual creation, but the license assignment step was skipped, failed silently, or was blocked by insufficient available seats.

## How to triage unlicensed users by type

The most efficient triage workflow starts by segmenting the unlicensed population into sub-groups. M365 Tenant Reporter provides sortable columns that support this directly in the browser:

### Step 1: Filter out guests

Sort or scan by the user type column. Guest accounts are expected to be unlicensed in your tenant. If you have a large guest population, note the count for your access review records but do not treat them as provisioning gaps. If guests appear with licenses assigned, that may actually warrant investigation -- it could indicate accidental license assignment that is consuming paid seats.

### Step 2: Identify disabled accounts

Look at the account enabled column. Disabled accounts with zero licenses are typically in a deprovisioning pipeline. Confirm that your organization's retention policy is being followed. If you find disabled accounts that have been sitting unlicensed for longer than your retention window, those are candidates for permanent deletion.

### Step 3: Cross-reference shared mailboxes

If you have the mailbox report available in the same snapshot, check whether any unlicensed identities correspond to shared mailboxes. M365 Tenant Reporter reads `mailboxSettings.userPurpose` to classify mailbox types, so you can correlate user principal names across the two reports to confirm that an unlicensed identity is actually a shared mailbox rather than a missed assignment.

### Step 4: Isolate the real gaps

After removing guests, disabled accounts, and shared mailboxes from your mental model, the remaining unlicensed identities with `accountEnabled: true` and `userType: Member` are your high-priority follow-up set. These are active internal members who have no licenses -- the exact population that typically represents missed onboarding steps or provisioning automation failures.

## Security implications of stale unlicensed accounts

Unlicensed identities are often overlooked in security reviews because they do not consume subscription budget. However, they still represent authentication targets in your directory. An enabled, unlicensed user object can still authenticate to Microsoft Entra if it has a valid password or credential. This creates several risks:

- **Credential stuffing surface.** An attacker who obtains credentials for a stale unlicensed account can authenticate and potentially escalate through lateral movement, even if the account has no mailbox or Teams access.
- **Conditional access blind spots.** Many conditional access policies are scoped by license assignment or group membership. Unlicensed accounts may fall outside the targeting criteria of policies that require MFA, compliant devices, or named locations.
- **Audit trail gaps.** If sign-in logging is configured to focus on licensed users, sign-in activity from unlicensed accounts may go unmonitored.

M365 Tenant Reporter's security insights module complements the unlicensed users report by surfacing MFA registration status and last sign-in timestamps. When these two data sources are combined, you can identify the most dangerous pattern: enabled, unlicensed, no MFA registered, and no recent sign-in activity. That combination suggests an identity that exists in the directory, is not protected by a second factor, and is not being actively used -- the ideal target for an attacker.

## Remediation workflows

Once you have identified your actionable unlicensed accounts, the remediation path depends on the category:

### For provisioning gaps

Work with your identity lifecycle team to determine why the license assignment failed. Common root causes include:

- Group-based licensing rules that do not cover the user's department or location.
- Insufficient available seats at the time of provisioning, causing the assignment to fail silently.
- Manual onboarding processes where the license step was forgotten.
- HR-driven provisioning pipelines with incomplete attribute mappings that prevent group-based licensing from triggering.

The fix usually involves either assigning the license directly, adding the user to the correct license assignment group, or correcting the attribute that drives group-based licensing.

### For stale disabled accounts

If the account has been disabled beyond your organization's retention period, schedule it for deletion. Before deleting, verify that no resources (OneDrive files, mailbox archives, Teams data) still need to be preserved. Microsoft 365 retains deleted user data for 30 days by default, but some organizations require longer preservation through litigation hold or inactive mailbox configurations.

### For service accounts

Evaluate whether the service account should be converted to an app registration with managed identity or whether it legitimately needs to remain as a user object. If it must stay as a user object, document it in your service account inventory and ensure it is covered by appropriate conditional access policies.

## Export strategies for handoff to provisioning teams

The unlicensed users report is most valuable when it leaves the app and enters the workflow of the team responsible for fixing the gaps. M365 Tenant Reporter supports four export formats, and each serves a different handoff scenario:

- **CSV** is the best choice when the provisioning team already has a spreadsheet-based workflow or when the data needs to be imported into a ticketing system like ServiceNow or Jira.
- **Excel** works well when the receiving team needs to add columns for triage status, owner assignment, or remediation notes directly in the workbook.
- **JSON** is the right format when the unlicensed user list needs to feed an automation pipeline -- for example, a Power Automate flow that creates provisioning tickets automatically or an Azure Function that attempts license assignment.
- **HTML** produces a self-contained, browser-readable artifact that is useful for sharing with stakeholders who need to review the data but should not be expected to open a spreadsheet.

When exporting for provisioning handoff, include all columns. The user principal name is essential for matching the record in your identity system, the account enabled flag tells the receiving team whether the account is active, and the last sign-in timestamp (when available) helps prioritize accounts that are actively being used without a license over accounts that appear dormant.

## Integration with the security insights module

The unlicensed users report and the security insights module in M365 Tenant Reporter are designed to complement each other. The security module surfaces MFA registration status, last sign-in activity, and inactive account flags across the entire user population -- including unlicensed identities.

By reviewing both reports in the same snapshot session, you can answer questions that neither report addresses alone:

- Which unlicensed accounts are actively signing in? (These may need licenses urgently.)
- Which unlicensed accounts have never signed in? (These may be safe to disable or delete.)
- Which unlicensed accounts lack MFA registration? (These represent the highest-risk identities.)
- Which unlicensed guest accounts are inactive beyond the 30-day threshold? (These are candidates for access review revocation.)

The security score calculation in M365 Tenant Reporter factors in inactive users and guest ratios, which means cleaning up stale unlicensed accounts can directly improve your tenant's computed security posture.

## Building a recurring review cadence

Unlicensed identity review should not be a one-time exercise. Directory drift is continuous -- new users are created, employees leave, guest invitations accumulate, and provisioning pipelines evolve. A sustainable approach involves:

- **Monthly snapshot.** Run M365 Tenant Reporter monthly and export the unlicensed users report. Compare the current export against the previous month's export to identify new unlicensed identities that appeared since the last review.
- **Quarterly deep review.** Every quarter, perform the full triage workflow described above. Segment by type, cross-reference with mailbox and security data, and generate remediation tickets for any provisioning gaps.
- **Annual access review alignment.** Coordinate the unlicensed identity review with your organization's formal access review cycle. Microsoft Entra access reviews can automate guest account revocation, but they do not typically cover unlicensed member accounts -- the M365 Tenant Reporter export fills that gap.

The zero-storage architecture of M365 Tenant Reporter means that each snapshot is generated fresh from the Microsoft Graph API at the time you run it. There is no stale cache to worry about. Every export reflects the current state of your directory at the moment the collection completed.
