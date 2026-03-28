---
title: "How to analyze licensed users across your tenant"
description: "A comprehensive guide to the licensed users report — how assignedLicenses from Microsoft Graph maps to readable SKU names, identifying over-licensed users, preparing for procurement and renewal conversations, compliance audit readiness, and export strategies for finance, IT ops, and security audiences."
category: "Licensing"
reading_time: "14 min read"
featured: true
keywords:
  - licensed users report
  - microsoft 365 licensed accounts
  - m365 licensing visibility
  - assigned licenses graph api
  - sku name resolution
  - license stacking
  - over-licensed users
  - license optimization
  - enterprise agreement renewal
  - license compliance audit
  - microsoft 365 procurement
  - license reclamation
cta_title: "Run a licensed users snapshot"
cta_body: "Sign in to collect a fresh session, review the licensed users overview card, and export the detailed report to prepare for your next licensing conversation."
---

Licensing is one of the most financially significant dimensions of Microsoft 365 tenant management. For organizations with thousands of users, the difference between an accurate license inventory and an estimated one can represent tens or hundreds of thousands of dollars in annual spend. M365 Tenant Reporter provides a clear, point-in-time view of licensed users across your tenant — who has licenses, what products they are assigned, and where optimization opportunities may exist. This guide covers the technical foundations of the licensed users report, practical strategies for analysis, and recommendations for sharing the data with different stakeholders.

## How assignedLicenses maps to readable SKU names

The Microsoft Graph API represents license assignments on user objects through the `assignedLicenses` property, which is an array of objects each containing a `skuId` — a GUID that identifies the specific license SKU. While technically precise, a raw GUID like `05e9a617-0261-4cee-bb44-138d3ef5d965` conveys nothing to a human reader.

M365 Tenant Reporter resolves these GUIDs to human-readable product names by cross-referencing the user's assigned SKU IDs against the tenant's `subscribedSkus` endpoint, which returns the catalog of all SKUs your organization has purchased or been assigned. This resolution step transforms the raw data into something actionable:

- `05e9a617-0261-4cee-bb44-138d3ef5d965` becomes **Microsoft 365 E3**
- `06ebc4ee-1bb5-47dd-8120-11324bc54e06` becomes **Microsoft 365 E5**
- `f8a1db68-be16-40ed-86d5-cb42ce701560` becomes **Power BI Pro**

> **Why this matters:** Without SKU name resolution, license reports are unusable by anyone outside the Graph API developer community. Finance teams, procurement leads, and executive stakeholders need product names they recognize — the same names that appear on invoices and Enterprise Agreement order forms.

## Understanding the licensed users count

The licensed users count in M365 Tenant Reporter represents the number of user objects in your tenant that have at least one entry in their `assignedLicenses` array. This is a straightforward binary classification: if the array has one or more SKU assignments, the user is counted as licensed. If the array is empty, the user is counted as unlicensed.

This simplicity is intentional, but it is important to understand what the count does and does not capture:

- **It counts users, not license units.** A user with three assigned SKUs (e.g., E3 + Power BI Pro + Visio Plan 2) counts as one licensed user, not three.
- **It includes all assignment methods.** Both direct license assignments and group-based license assignments are reflected in the `assignedLicenses` property.
- **It includes disabled accounts.** A user account that has been disabled (`accountEnabled = false`) but still has licenses assigned will appear in the licensed users count. This is a common source of wasted spend.
- **It does not distinguish between paid and trial SKUs.** Trial licenses assigned to users appear in the same property and are counted the same way.

## License stacking: what it is and why it matters

License stacking occurs when a single user has multiple SKU assignments. In Microsoft 365, this is common and sometimes intentional:

- **Intentional stacking:** An E3 user who also needs Power BI Pro, Project Plan 3, or Visio Plan 2 will have multiple SKUs assigned. This is standard practice and reflects legitimate entitlement requirements.
- **Redundant stacking:** An E5 user who also has a standalone Exchange Online Plan 2 license assigned has redundant entitlements — E5 already includes Exchange Online Plan 2. The standalone license is consuming an available unit without providing additional functionality.
- **Migration artifacts:** Organizations that have upgraded from E1 to E3, or from E3 to E5, sometimes fail to remove the old SKU after assigning the new one. The user ends up with both licenses, and the old one consumes inventory unnecessarily.

M365 Tenant Reporter shows the full list of resolved SKU names for each licensed user, making it straightforward to identify stacking patterns. When reviewing the licensed users report, look for users with SKU combinations that suggest redundancy:

- E5 + Exchange Online Plan 2 (redundant)
- E5 + SharePoint Online Plan 2 (redundant)
- E3 + E5 on the same user (almost always a migration artifact)
- E3 + Microsoft Defender for Office 365 Plan 1 (included in E5, but not in E3 — may be intentional)

> **Cost impact:** In a tenant with 5,000 licensed users, even a 3-5% rate of redundant stacking can represent 150-250 wasted license units. At enterprise SKU pricing, this can easily exceed $50,000 annually in unnecessary spend.

## Identifying over-licensed users

Beyond stacking redundancy, over-licensing occurs when a user has a higher-tier SKU than their role requires. Common patterns include:

- **E5 assigned to users who only need email and basic Office apps.** These users would be adequately served by E3 or even E1 plus standalone Office licenses.
- **E3 assigned to shared mailbox accounts.** Shared mailboxes in Exchange Online do not require a license in most configurations. If a shared mailbox has an E3 license, it may be an unnecessary assignment.
- **Licensed accounts for room and equipment mailboxes.** Resource mailboxes require a Meeting Room license (or no license in some configurations), not a full E3 or E5 SKU.
- **Licensed disabled accounts.** As mentioned above, disabled accounts with licenses assigned represent clear reclamation opportunities.

When preparing a license optimization recommendation, the licensed users report provides the data foundation. Export the report, sort by SKU assignments, and cross-reference with the user type and account status columns to build a reclamation candidate list.

## Preparing for procurement and renewal conversations

License inventory data from M365 Tenant Reporter directly supports procurement workflows. Here is how to use the report at different stages of the procurement cycle:

### Pre-renewal assessment

Before entering Enterprise Agreement renewal negotiations, export the licensed users report and summarize:

- Total licensed users by SKU (e.g., 3,200 E3 users, 800 E5 users, 450 Power BI Pro users).
- Stacking analysis to identify redundant assignments that could be reclaimed before renewal.
- Disabled account analysis to identify licenses that can be freed up.
- Growth projection based on the trend of licensed users over the past several export cycles.

This data gives procurement teams a defensible position when negotiating quantities. Instead of renewing based on the previous agreement's numbers, you can renew based on actual current consumption plus a justified growth buffer.

### True-up preparation

Many Enterprise Agreements include annual true-up requirements where the organization must report and pay for any license consumption that exceeds the committed quantities. The licensed users report provides a verifiable count that matches what Microsoft can see in your tenant. Running a snapshot shortly before the true-up deadline ensures your reported numbers are accurate and defensible.

### New SKU evaluation

When evaluating whether to add a new SKU to your agreement (e.g., adding Power BI Pro or Project Plan), the licensed users report helps you understand your current baseline. If 200 users already have Power BI Pro through individual license purchases, you know the minimum committed quantity for an enterprise-level agreement.

## Compliance audit readiness

License compliance is a frequent audit topic, both for internal audits and for Microsoft's own compliance verification programs. The licensed users report supports audit readiness in several ways:

- **Point-in-time evidence.** Each export represents a dated snapshot of license assignments. Maintaining a regular export cadence creates an audit trail that demonstrates ongoing license management.
- **Completeness.** The report covers all user objects in the tenant, not a sample. Auditors can verify that the inventory is comprehensive.
- **Traceability.** The export includes the user's UPN, display name, and full SKU assignment list, providing the detail needed to trace any specific assignment back to its justification.

> **Auditor-friendly format:** When preparing for a compliance audit, export the licensed users report in Excel format and add a cover sheet documenting the export date, the authenticated account that ran the report, the tenant ID, and the total counts by SKU. This provides the context auditors need without requiring them to re-run the tool.

## Export format recommendations for different audiences

The licensed users data serves multiple stakeholders, and the optimal export format varies by audience.

### Finance and procurement teams

**Recommended format: Excel (.xlsx)**

Finance teams need to manipulate the data — creating pivot tables by SKU, calculating costs by multiplying user counts by per-unit pricing, and comparing against purchase order quantities. Excel is the native format for this work. Export the full licensed users report, then guide the finance team to pivot on the resolved SKU name column to get per-product counts.

### IT operations

**Recommended format: Excel (.xlsx) or CSV (.csv)**

IT operations teams typically use the data for stacking analysis, disabled account cleanup, and assignment verification. Excel works well for interactive analysis. CSV is preferred when the data will be imported into another tool — such as a PowerShell script that cross-references license assignments with usage data from another source.

### Security and compliance teams

**Recommended format: Excel (.xlsx) or HTML**

Security teams reviewing license assignments as part of an access review will want to filter by specific criteria — disabled accounts with licenses, guest accounts with licenses, users with sensitive SKUs like E5 (which includes advanced security features). Excel's filtering capabilities make this straightforward. The HTML export is useful for embedding in an audit report or sharing as a read-only reference.

### Executive reporting

**Recommended format: HTML or screenshot of overview cards**

Executives rarely need row-level license data. The overview cards showing total licensed users, top SKUs, and the licensed-to-unlicensed ratio provide the summary they need. The HTML export of the overview section or a screenshot is typically sufficient for board decks and quarterly business reviews.

## Integration with license availability data

The licensed users report shows who has licenses assigned, but it does not directly show how many unassigned license units remain in the tenant's inventory. This data is available through the `subscribedSkus` endpoint, which includes both the total purchased quantity (`prepaidUnits.enabled`) and the consumed quantity (`consumedUnits`) for each SKU.

M365 Tenant Reporter uses the `subscribedSkus` data for SKU name resolution, and the license availability information may be surfaced in the overview section depending on the current feature set. When performing a comprehensive license review, consider the assigned-user view alongside the tenant-level availability data:

- **Over-provisioned SKUs** — SKUs where consumed units are well below purchased units, indicating that the organization is paying for more licenses than it uses.
- **Near-capacity SKUs** — SKUs where consumed units are approaching the purchased limit, indicating a potential need to purchase additional units before hitting the cap.
- **Exceeded SKUs** — In some configurations, Microsoft allows temporary over-assignment. If consumed units exceed purchased units, this represents a true-up liability.

## Real-world licensed users analysis workflow

Here is a practical workflow for conducting a licensed users analysis using M365 Tenant Reporter:

1. **Collect the snapshot.** Sign in and wait for the data collection to complete. Note the total licensed users count on the overview card.
2. **Review the overview.** Check the licensed-to-unlicensed ratio. In most production tenants, you should expect a majority of member users to be licensed. A low licensing ratio may indicate a large number of shared mailbox or room accounts, or it may indicate a cleanup opportunity.
3. **Open the detailed report.** Scan the resolved SKU names column for stacking patterns, redundant assignments, and unexpected SKUs.
4. **Filter for optimization candidates.** Look for disabled accounts with licenses, guest accounts with licenses, and users with redundant SKU combinations.
5. **Export the data.** Choose Excel for interactive analysis or CSV for scripted processing.
6. **Build the recommendation.** Quantify the reclamation opportunity — how many licenses can be freed by removing redundant stacking, cleaning up disabled accounts, and right-sizing over-licensed users.
7. **Share with stakeholders.** Distribute the appropriate format to each audience as described in the export recommendations section.

## Summary

The licensed users report in M365 Tenant Reporter transforms raw Graph API license data into an actionable inventory that supports procurement planning, compliance auditing, cost optimization, and operational hygiene. By understanding how SKU resolution works, recognizing stacking and over-licensing patterns, and tailoring the export format to each audience, administrators can turn a point-in-time snapshot into a meaningful input for licensing decisions that affect the organization's bottom line. Establish a regular reporting cadence, compare snapshots to track trends, and use the data to ensure every license dollar is spent on an account that needs it.
