---
title: "How to track total users in M365 Tenant Reporter"
description: "A complete guide to the total users metric — how it is collected from Microsoft Graph, what the count includes, how it breaks down by user type and account status, and operational strategies for tracking tenant growth over time."
category: "Users"
reading_time: "12 min read"
featured: true
keywords:
  - total users report
  - microsoft 365 user inventory
  - m365 total users
  - graph api users endpoint
  - member vs guest users
  - enabled vs disabled accounts
  - tenant growth tracking
  - user inventory export
  - microsoft 365 admin center comparison
  - user account lifecycle
cta_title: "Start with a fresh user inventory"
cta_body: "Open the login section, collect a new session snapshot, and verify the total users metric before drilling into licensed and unlicensed views."
---

The total users metric is the most fundamental number in any Microsoft 365 tenant review. It answers the simplest possible question — how many user objects exist in this tenant right now — and serves as the baseline from which every other report derives its context. In M365 Tenant Reporter, the total users count comes directly from the Microsoft Graph API, collected in real time during the authenticated session. This guide explains exactly how that number is calculated, what it includes and excludes, and how to use it effectively in operational workflows.

## How the total users count is collected from Microsoft Graph

When the reporting session begins, M365 Tenant Reporter calls the Microsoft Graph `/users` endpoint with the delegated `User.Read.All` permission. This endpoint returns every user object in the tenant's Microsoft Entra directory. The application paginates through the full result set — Graph returns users in pages of up to 999 objects — until all user objects have been retrieved.

The total users metric is simply the count of all user objects returned by this enumeration. It includes every object type that Microsoft Entra classifies as a user: standard member accounts, guest (B2B) accounts, and in some configurations, contact-synced objects that appear in the user directory.

> **Technical note:** The `/users` endpoint returns user objects from the Microsoft Entra directory, which is the authoritative identity source for Microsoft 365. This is the same data source that powers the "Active users" page in the Microsoft 365 admin center, though the admin center applies additional filtering that can cause the numbers to differ slightly.

## What userType and accountEnabled mean

Two properties on the user object are critical for understanding the composition of the total users count.

### userType

The `userType` property distinguishes between two categories:

- **Member** — A user account that belongs to your organization. This includes employees, contractors with organizational accounts, service accounts, room mailboxes, shared mailboxes, and any other account created directly in your Entra directory or synced from on-premises Active Directory.
- **Guest** — An external user invited through Microsoft Entra B2B collaboration. Guest accounts have a `userType` of "Guest" and typically authenticate against their home tenant or a consumer identity provider. They appear in your tenant's user directory but are not "owned" by your organization in the same way member accounts are.

Understanding the member-to-guest ratio is operationally important. A tenant with 5,000 members and 12,000 guests has a very different management and security profile than one with 5,000 members and 200 guests. Guest sprawl is a common finding in tenants that have been using Teams external collaboration or SharePoint external sharing for several years.

### accountEnabled

The `accountEnabled` property is a boolean that indicates whether the account can authenticate. Disabled accounts remain in the directory — they count toward the total user number — but they cannot sign in to any Microsoft 365 service.

Common reasons for disabled accounts include:

- **Employee offboarding.** Many organizations disable accounts rather than deleting them immediately, preserving the mailbox and OneDrive data during a retention period.
- **Contractor project completion.** Contractor accounts are often disabled at the end of an engagement and deleted after a grace period.
- **Security incidents.** Accounts may be disabled as an emergency response to compromised credentials.
- **Seasonal or leave-of-absence accounts.** Some organizations disable accounts during extended leave rather than maintaining active access.

Tracking the ratio of enabled to disabled accounts over time is a useful hygiene metric. A growing number of disabled accounts that are never cleaned up may indicate gaps in the offboarding lifecycle.

## How the total users count breaks down

M365 Tenant Reporter presents the total users metric as an overview card, but the real value comes from understanding its internal composition. The total user count breaks down along several dimensions:

- **Members vs. Guests** — How many user objects are organizational members versus external B2B guests.
- **Enabled vs. Disabled** — How many accounts are active versus blocked from sign-in.
- **Licensed vs. Unlicensed** — How many accounts have at least one assigned SKU versus zero assigned licenses. (This dimension is covered in the licensed users report but is conceptually part of the total users breakdown.)
- **Mailbox type** — How many accounts are standard user mailboxes, shared mailboxes, or room/equipment mailboxes. (Requires the MailboxSettings.Read scope.)

These dimensions interact in important ways. For example, a disabled account that still has licenses assigned represents a cost optimization opportunity. A guest account with licenses assigned may be intentional (if your organization licenses external collaborators) or may be an oversight. The total users count is the starting point for surfacing all of these patterns.

## Operational patterns for tracking tenant growth

Because M365 Tenant Reporter operates on a zero-storage model, historical trend analysis requires an export-based workflow. Here are practical approaches for tracking total users over time:

### Periodic export cadence

Establish a regular cadence — weekly, biweekly, or monthly depending on your organization's pace of change — for collecting and exporting the user report. Save each export with a date-stamped filename (e.g., `user-report-2026-03-28.xlsx`) in a shared location accessible to your operations team.

### Baseline comparison

Each time you collect a new snapshot, compare the total users count against the previous export. Look for:

- **Unexpected growth** — A sudden increase in user objects may indicate a bulk provisioning event, an automated account creation process, or B2B guest invitation sprawl.
- **Unexpected shrinkage** — A drop in total users may indicate bulk deletions, automated cleanup scripts, or a directory sync issue that removed accounts.
- **Stagnation in disabled account cleanup** — If total users keeps growing but the enabled/disabled ratio is shifting toward disabled, the offboarding pipeline may not be completing its cleanup phase.

### Thresholds and alerts

While M365 Tenant Reporter itself does not provide alerting, you can build a lightweight monitoring workflow by scripting a comparison between consecutive exports. If the total user count changes by more than a defined threshold (e.g., more than 5% change in a week), flag the snapshot for manual review.

## Comparison with Microsoft 365 admin center counts

Administrators often notice that the total users count in M365 Tenant Reporter differs slightly from the numbers shown in the Microsoft 365 admin center. This is expected and has straightforward explanations:

- **Admin center "Active users" page** applies default filters that may exclude soft-deleted users, guest accounts, or certain system accounts. The Graph `/users` endpoint returns the full directory without these filters.
- **Admin center count timing** may reflect a cached value that is not updated in real time, whereas the Graph API call retrieves the current state of the directory at the moment of the request.
- **Soft-deleted users** in the Entra recycle bin are not returned by the standard `/users` endpoint and are excluded from the total users count in M365 Tenant Reporter. If you see a higher number in the admin center, it may be because the admin center is showing a count that includes recently deleted users still within the 30-day recovery window.

> **Best practice:** When reconciling counts between different tools, always note the exact timestamp of each count and the filters applied. Discrepancies of a few accounts are normal and rarely indicate a problem. Discrepancies of hundreds or thousands of accounts warrant investigation into filter differences or directory sync issues.

## Export strategies for different audiences

The total users report serves different audiences with different needs:

- **IT operations** typically wants the full user list with all properties — display name, UPN, user type, account status, creation date, and assigned licenses. The Excel export is usually the most practical format because it supports sorting, filtering, and pivot tables.
- **Security teams** are most interested in disabled accounts, guest accounts, and accounts without recent sign-in activity. Exporting the full dataset and filtering in Excel is effective, or you can use the in-app filters to narrow the view before exporting.
- **Management reporting** often needs a summary rather than raw data. The overview cards (total users, members, guests, enabled, disabled) provide the summary-level view. A screenshot or the HTML export of the overview section is often sufficient for management presentations.
- **Compliance auditors** may need a complete point-in-time inventory export with a timestamp and an indication of who ran the report. The Excel export combined with a note documenting the date, the authenticated account, and the tenant ID satisfies most audit evidence requirements.

## Real-world use cases

### Pre-merger due diligence

Before a merger or acquisition, IT teams need to understand the size and composition of the target tenant. The total users count provides immediate context: how many identities will need to be migrated, how many are guests versus members, and how many are currently disabled. This data feeds directly into migration planning tools and project scoping.

### Annual license reconciliation

Many organizations reconcile their Microsoft 365 license inventory annually as part of their Enterprise Agreement renewal. The total users count is the starting point — if you have 8,000 total users but only 6,500 licenses, the breakdown of who is licensed and who is not becomes the critical next step. The total users report provides the denominator for every licensing ratio.

### Security posture assessment

A security team assessing identity hygiene will want to know the total number of accounts, the guest-to-member ratio, and the enabled-to-disabled ratio. Anomalies in any of these ratios — an unusually high guest count, a large number of disabled accounts that have been sitting for months — are signals that warrant deeper investigation.

### Tenant cleanup projects

Organizations that have grown through acquisition, reorganization, or rapid scaling often accumulate identity sprawl. The total users count, combined with the user type and account status breakdowns, provides the scoping data for a cleanup project. Knowing that you have 2,400 disabled accounts and 3,100 guest accounts gives the project clear targets and measurable outcomes.

## Summary

The total users metric is deceptively simple — it is just a count of user objects in your tenant — but it anchors every other reporting dimension. Understanding what the count includes, how it breaks down by user type and account status, and how it compares to other tools' counts gives administrators the confidence to use it as a reliable baseline for licensing decisions, security assessments, and operational planning. Establish a regular export cadence, compare snapshots over time, and use the breakdown dimensions to surface the patterns that matter most to your organization.
