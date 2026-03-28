---
title: "How to identify and manage shared mailboxes with mailbox purpose data"
description: "A complete guide to using M365 Tenant Reporter's mailbox purpose classification to inventory shared mailboxes, understand licensing implications, review delegation patterns, and plan Exchange migrations."
category: "Mailboxes"
reading_time: "15 min read"
featured: true
keywords:
  - shared mailbox report
  - mailbox purpose
  - microsoft 365 shared mailboxes
  - exchange online mailbox types
  - shared mailbox licensing
  - mailbox delegation audit
  - exchange migration planning
  - MailboxSettings.Read
  - mailbox inventory
---

Shared mailboxes are one of the most widely used yet poorly inventoried resources in Microsoft 365 tenants. They serve as team inboxes, departmental contact points, and service desk aliases, but because they are represented as user objects in the directory, they often blur together with regular user accounts in standard reporting tools. M365 Tenant Reporter addresses this by reading the `mailboxSettings.userPurpose` property through the Microsoft Graph API, enabling the snapshot to classify each mail-enabled identity by its actual mailbox type rather than relying on naming conventions or manual tagging.

## How MailboxSettings.Read enables purpose detection

The Microsoft Graph API exposes a `userPurpose` property within a user's `mailboxSettings` resource. This property returns one of several values that indicate how Exchange Online classifies the mailbox internally. When M365 Tenant Reporter collects mailbox data, it calls `/users/{id}/mailboxSettings?$select=userPurpose` for every mail-enabled user in the tenant directory.

The `userPurpose` value maps to Exchange Online's internal classification:

- **user** -- A standard user mailbox attached to a regular licensed account.
- **shared** -- A shared mailbox designed for multi-user access without requiring each accessor to have a separate license for the mailbox itself.
- **room** -- A room mailbox used for meeting room scheduling and calendar resource booking.
- **equipment** -- An equipment mailbox used for scheduling shared physical resources like projectors, vehicles, or conference phones.
- **unknown** -- Returned by M365 Tenant Reporter when the Graph API does not expose `userPurpose` for the given account, typically because the account does not have a mailbox provisioned or because permissions are insufficient.

> The MailboxSettings.Read permission is part of the core consent scope in M365 Tenant Reporter. No additional admin consent is needed beyond the standard sign-in flow to retrieve mailbox purpose data for identities the authenticated user can read.

This approach is significantly more reliable than inferring mailbox type from display name patterns (such as looking for prefixes like "SM-" or "Room-") or from license assignment status, both of which are prone to false positives and false negatives.

## Understanding the difference between mailbox types

Each mailbox type in Exchange Online serves a distinct operational purpose, and understanding these differences is essential for accurate reporting and capacity planning.

### User mailboxes

A user mailbox is the standard mailbox attached to a licensed Microsoft 365 account. It is owned by a single person, counts against the tenant's license consumption, and has a default storage quota determined by the assigned license plan. User mailboxes are the most common type in any tenant.

### Shared mailboxes

Shared mailboxes are designed for collaborative access. Multiple users can send and receive email from a shared mailbox without needing individual licenses for that specific mailbox. Exchange Online creates a user object in the directory for each shared mailbox, which is why they appear in user lists. Key characteristics include:

- No license is required if the mailbox stays under 50 GB. Once a shared mailbox exceeds 50 GB, it requires an Exchange Online Plan 2 license or an Exchange Online Archiving add-on.
- Shared mailboxes cannot be used for direct interactive sign-in. Users access them through delegation (Full Access, Send As, or Send on Behalf permissions).
- They are commonly used for team aliases like info@, support@, hr@, and sales@.

### Room and equipment mailboxes

Room and equipment mailboxes are resource mailboxes managed by Exchange Online's resource booking system. They appear in the directory as user objects with `accountEnabled: false` and are used to schedule conference rooms, vehicles, projectors, or other shared physical resources. Like shared mailboxes, they do not require a license under normal usage.

## Why shared mailbox licensing is often misunderstood

The licensing model for shared mailboxes is a frequent source of confusion, and M365 Tenant Reporter's mailbox report helps administrators cut through the ambiguity. Several common misconceptions persist:

**Misconception: Shared mailboxes never need a license.** This is only true when the mailbox remains under the 50 GB storage limit. Once it exceeds that threshold, Microsoft requires a license. Additionally, if you place a shared mailbox on In-Place Hold or Litigation Hold, or if you enable auto-expanding archiving, a license is required regardless of size.

**Misconception: A shared mailbox with a license assigned is misconfigured.** Not necessarily. Some organizations intentionally license shared mailboxes to increase storage quota, enable archive mailboxes, or comply with retention policies. The question is whether the license assignment is deliberate and documented, or accidental and wasteful.

**Misconception: Converting a user mailbox to shared removes the license requirement.** The conversion changes the mailbox type, but it does not automatically remove the license. Administrators must manually unassign the license after conversion. M365 Tenant Reporter can surface these cases by showing identities that are both classified as shared-purpose mailboxes and have licenses assigned -- a combination that warrants review.

By exporting the mailbox report and cross-referencing with the license report, you can identify shared mailboxes that are consuming paid seats unnecessarily.

## Ownership and delegation patterns

Shared mailboxes without clear ownership become operational liabilities. When no one is responsible for a shared mailbox, incoming messages go unread, auto-replies become outdated, and the mailbox accumulates storage without oversight.

M365 Tenant Reporter surfaces the identity information for each shared mailbox (display name, UPN, mail address), which provides the starting point for an ownership audit. While the Graph API's `userPurpose` property identifies the mailbox type, delegation details (Full Access, Send As, Send on Behalf assignments) require Exchange Online PowerShell or the Exchange admin center to inspect fully.

A practical ownership review workflow using M365 Tenant Reporter data:

1. **Export the shared mailbox subset.** Filter the mailbox report to purpose = shared and export to Excel.
2. **Add ownership columns.** In the exported workbook, add columns for Primary Owner, Department, and Last Reviewed Date.
3. **Cross-reference with Exchange admin center.** For each shared mailbox, verify delegation assignments and record the primary owner.
4. **Flag orphaned mailboxes.** Any shared mailbox where no active user has Full Access or Send As permissions is effectively orphaned and should be escalated for remediation or decommissioning.
5. **Schedule recurring review.** Repeat quarterly to catch newly created shared mailboxes that lack ownership documentation.

## Common cleanup scenarios

Shared mailbox sprawl is a normal byproduct of organizational growth. Teams create shared mailboxes for projects, campaigns, and temporary needs, but rarely decommission them when the purpose ends. M365 Tenant Reporter helps identify cleanup candidates:

### Stale project mailboxes

Shared mailboxes created for time-bound projects (events, product launches, hiring campaigns) frequently outlive their purpose. If a shared mailbox has not received mail activity in several months and is not subject to legal hold, it is a candidate for removal. Cross-referencing with the activity reports module can help identify these.

### Duplicate functional mailboxes

Large organizations sometimes end up with multiple shared mailboxes serving the same function -- for example, both support@ and helpdesk@ routing to different teams without coordination. The mailbox report provides a comprehensive inventory that makes duplicates visible.

### Oversized shared mailboxes approaching the license threshold

Any shared mailbox approaching the 50 GB limit needs attention. Either archive older content, convert to a licensed mailbox deliberately, or split the mailbox into functional sub-mailboxes. Catching this before the threshold is reached avoids unexpected license costs.

### Mailboxes with unknown purpose

M365 Tenant Reporter marks a mailbox as "unknown" when the Graph API does not return a `userPurpose` value. This typically occurs for accounts that have a mail address but no Exchange Online mailbox provisioned (such as mail-enabled contacts synced through directory synchronization) or for accounts where the MailboxSettings.Read permission is denied. These entries should be reviewed to determine whether they represent real mailboxes or directory artifacts.

## Using the report for Exchange migration planning

Organizations planning Exchange hybrid migrations, tenant-to-tenant migrations, or consolidation projects need a clean mailbox inventory as a prerequisite. M365 Tenant Reporter's mailbox report serves this purpose by providing:

- **Accurate type classification.** Knowing which mailboxes are shared, user, room, or equipment determines the migration approach for each. Shared mailboxes often require special handling during cross-tenant migrations because they depend on delegation relationships that must be re-established in the target tenant.
- **Scale estimation.** The total count of each mailbox type helps migration architects estimate timeline, licensing requirements in the target environment, and the scope of delegation re-mapping work.
- **Exception identification.** Mailboxes marked as "unknown" may indicate synchronization issues or hybrid configuration problems that need to be resolved before migration.

When preparing a migration plan, export the full mailbox report to Excel and use it as the foundation for your migration wave planning spreadsheet. Add columns for wave assignment, migration status, and post-migration validation.

## Export recommendations

The mailbox report supports all four export formats in M365 Tenant Reporter. The best choice depends on the audience and workflow:

- **Excel** is ideal for operational teams who will add columns, apply conditional formatting to highlight shared mailboxes exceeding storage thresholds, or use the data as input for migration planning workbooks.
- **CSV** works well when the data needs to be imported into a configuration management database (CMDB), an IT service management platform, or a PowerShell script that performs bulk operations on shared mailboxes.
- **JSON** is the right choice when the mailbox inventory feeds an automation pipeline -- for example, a Logic App that checks shared mailbox storage consumption weekly or a custom dashboard that tracks mailbox type distribution over time.
- **HTML** produces a portable, self-contained report that is useful for sharing with stakeholders who need visibility into the shared mailbox landscape but do not need to manipulate the data. It is particularly effective for management reviews and audit evidence collection.

## Handling the "unknown" classification gracefully

M365 Tenant Reporter deliberately surfaces unknown mailbox purposes rather than hiding them or guessing. This design choice reflects a core principle: report what the API returns honestly, and let the administrator decide what to do with incomplete data.

If your snapshot shows a significant number of unknown mailbox purposes, consider the following diagnostic steps:

- Verify that the authenticated account has MailboxSettings.Read permission for the affected users.
- Check whether the affected accounts are cloud-only or synced from on-premises Active Directory. Hybrid mailboxes with specific configurations may not expose `userPurpose` through the Graph API.
- Review whether any Conditional Access policies or Exchange Online transport rules are blocking mailbox settings access for certain user populations.

The `unknownMailboxPurposes` counter in the tenant overview gives you a quick signal. If the number is zero or very small, your mailbox classification data is comprehensive. If it is large relative to your total mail-enabled population, further investigation is warranted before relying on the report for critical decisions like migration planning or license reclamation.
