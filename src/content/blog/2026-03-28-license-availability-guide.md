---
title: "How to monitor purchased, consumed, and available licenses for capacity planning"
description: "A complete guide to using M365 Tenant Reporter's license availability report for capacity planning, procurement forecasting, cost optimization, and stakeholder communication using subscribedSkus data from Microsoft Graph."
category: "Licenses"
reading_time: "15 min read"
featured: true
keywords:
  - license availability report
  - subscribedskus capacity
  - available microsoft 365 licenses
  - license capacity planning
  - microsoft 365 procurement
  - license cost optimization
  - prepaidUnits consumedUnits
  - SKU management
  - license warning suspended
  - microsoft 365 license audit
---

License management in Microsoft 365 is deceptively complex. What appears on the surface as a simple question -- "do we have enough licenses?" -- quickly expands into a multi-dimensional problem involving SKU families, prepaid unit states, consumption rates, trial expirations, and budget forecasting. M365 Tenant Reporter's license availability report transforms raw `subscribedSkus` data from the Microsoft Graph API into an operations-friendly capacity view that shows purchased, consumed, and available counts for every subscription in your tenant.

## How the subscribedSkus API works

The Microsoft Graph `/subscribedSkus` endpoint returns the complete list of commercial subscriptions associated with your Microsoft 365 tenant. Each subscription record (a SKU) includes several key properties that M365 Tenant Reporter uses to build the license report:

- **skuId** -- The globally unique identifier for the subscription SKU.
- **skuPartNumber** -- The internal Microsoft product code (e.g., `ENTERPRISEPACK` for Office 365 E3, `SPE_E5` for Microsoft 365 E5).
- **capabilityStatus** -- The current state of the subscription: Enabled, Warning, Suspended, Deleted, or LockedOut.
- **prepaidUnits** -- An object containing seat counts broken down by state: enabled, warning, suspended, and lockedOut.
- **consumedUnits** -- The number of seats currently assigned to users.
- **servicePlans** -- The individual service plans (Exchange Online, SharePoint Online, Teams, etc.) included in the SKU.

M365 Tenant Reporter resolves the `skuPartNumber` to a human-readable friendly name so that the report displays "Microsoft 365 E5" instead of `SPE_E5`, making the data accessible to stakeholders who are not familiar with Microsoft's internal product codes.

## Understanding prepaidUnits vs consumedUnits

The relationship between `prepaidUnits` and `consumedUnits` is where capacity planning becomes precise. The `prepaidUnits` object is not a single number -- it contains four sub-counts:

### Enabled units

These are the seats that are currently active and available for assignment. When you purchase 500 E3 licenses and the subscription is fully active, `prepaidUnits.enabled` will be 500. This is the number most administrators think of as "purchased."

### Warning units

Seats in the warning state indicate that the subscription is in a grace period. This typically occurs when a subscription has expired but Microsoft has not yet suspended it. Users assigned to warning-state seats can still use the service, but the subscription needs renewal attention. M365 Tenant Reporter includes warning units in the total purchased count so you can see the full picture.

### Suspended units

Suspended seats are no longer functional. Users assigned to suspended seats lose access to the associated services. Suspension occurs after a subscription has been in warning state for the grace period (typically 30 days for most subscriptions). Suspended units appear in the report's total count but represent seats that cannot be used without reactivating the subscription.

### LockedOut units

LockedOut is the final state before deletion. Seats in this state cannot be used, and the subscription is scheduled for permanent removal. LockedOut units rarely appear in production tenants unless a subscription has been abandoned for an extended period.

> M365 Tenant Reporter calculates total purchased as the sum of all four states: enabled + warning + suspended + lockedOut. Available is calculated as total minus consumed, floored at zero. This gives you the complete capacity picture, including seats that may need subscription renewal to remain usable.

## What capability status states mean for operations

The `capabilityStatus` field on each SKU tells you the overall health of that subscription line:

- **Enabled** -- Normal operation. Seats can be assigned and are fully functional.
- **Warning** -- The subscription is in a grace period. Existing assignments continue to work, but the subscription needs renewal. This is your signal to engage procurement.
- **Suspended** -- Service access has been removed for users on this subscription. This is urgent -- affected users cannot access the services associated with this SKU.
- **LockedOut** -- The subscription is scheduled for deletion. Data associated with these licenses may be at risk of permanent loss.
- **Deleted** -- The subscription has been removed. It may still appear briefly in the API response during cleanup.

The license availability report surfaces the capability status for each SKU so you can immediately identify subscriptions that are not in the Enabled state and prioritize remediation.

## Identifying SKUs approaching capacity limits

The most operationally critical use of the license report is identifying subscriptions that are running low on available seats. When a SKU has zero or near-zero available seats, the next license assignment attempt will fail, blocking onboarding workflows and potentially disrupting HR-driven provisioning pipelines.

A practical capacity monitoring workflow:

1. **Sort by available seats ascending.** This puts the most constrained SKUs at the top of the report.
2. **Flag any SKU with fewer than 10% available seats.** If you have 500 E3 licenses purchased and 475 consumed, you have 25 available -- a 5% headroom that could be consumed within a single onboarding wave.
3. **Cross-reference with hiring plans.** If your organization has 30 new hires starting next month and only 25 E3 seats available, you need to procure additional licenses before the start date.
4. **Check for trial SKUs.** Trial subscriptions have fixed expiration dates and limited seat counts. If users are assigned to trial SKUs, those assignments will fail when the trial expires.

## Building a license procurement calendar

The license report, when exported regularly, becomes the foundation for a procurement calendar that prevents capacity emergencies:

### Monthly capacity snapshot

Export the license report at the same time each month. Track the consumed count for each major SKU over time. A simple spreadsheet with columns for date, SKU name, purchased, consumed, and available will reveal consumption trends.

### Consumption rate calculation

If your E3 consumption has grown from 400 to 450 over the past three months, you are consuming approximately 17 additional seats per month. At that rate, your remaining 50 available seats will last about three months. This gives your procurement team a clear timeline.

### Renewal date tracking

Supplement the M365 Tenant Reporter export with subscription renewal dates from the Microsoft 365 admin center. The report shows current capacity status but does not include contract dates. Combining both datasets gives you a complete procurement planning view.

### Budget cycle alignment

Most organizations procure Microsoft 365 licenses on annual agreements. Time your capacity analysis to align with your budget cycle so that license requests are included in the appropriate fiscal year planning.

## Handling trial vs paid SKUs

Trial subscriptions appear in the `subscribedSkus` response alongside paid subscriptions. They behave identically in terms of license assignment -- you can assign a trial SKU to a user just as you would a paid SKU -- but they have critical differences:

- **Trial SKUs expire.** When a trial expires, the capability status transitions from Enabled to Warning to Suspended. Users assigned to the trial lose access to the associated services.
- **Trial seat counts are fixed.** You cannot purchase additional seats for a trial subscription. If you need more seats, you must convert to a paid subscription.
- **Trial-to-paid conversion resets the SKU.** When you convert a trial to a paid subscription, the skuId typically changes, which means users may need to be reassigned depending on how the conversion is handled.

M365 Tenant Reporter surfaces trial SKUs in the same report as paid SKUs because they consume the same namespace in the directory. If you see a SKU with `capabilityStatus: Warning` and a small seat count (25 is a common trial allocation), it is likely a trial approaching or past expiration. Export the report and flag these for conversion or removal.

## Cost optimization strategies

The license availability report is not just about ensuring you have enough seats -- it is also about ensuring you are not paying for seats you do not need. Common optimization opportunities include:

### Reclaiming unused licenses

Cross-reference the license report with the user report. If you have 500 E5 seats purchased and 480 consumed, but the user report shows 30 licensed users who have not signed in for over 90 days, those 30 seats may be candidates for reclamation. M365 Tenant Reporter's security insights module provides inactive user data that makes this analysis possible.

### Right-sizing SKU assignments

Many organizations assign E5 licenses to users who only need E3 functionality. The license services report in M365 Tenant Reporter shows which individual service plans within each SKU are actually enabled per user. If the majority of your E5 users have Power BI, Phone System, and Audio Conferencing disabled, they may be better served by E3 plus targeted add-ons.

### Eliminating redundant SKUs

Tenants that have grown through acquisition or that have undergone licensing changes often carry redundant SKUs. For example, a tenant might have both `ENTERPRISEPACK` (Office 365 E3) and `SPE_E3` (Microsoft 365 E3) active simultaneously, with users split across both. Consolidating to a single SKU simplifies management and may unlock volume pricing benefits.

### Managing add-on SKU sprawl

Add-on SKUs like Visio, Project, Power BI Pro, and Defender for Office 365 each appear as separate lines in the license report. Review these periodically to confirm that each add-on still has active consumers. An add-on SKU with 50 seats purchased and 3 consumed represents significant waste.

## Export formats for finance stakeholders

License data frequently needs to be shared with finance, procurement, and executive stakeholders who are not Microsoft 365 administrators. The export format should match the audience:

- **Excel** is the default recommendation for finance teams. It supports pivot tables, conditional formatting to highlight SKUs in Warning or Suspended state, and formula-based consumption rate calculations. Finance stakeholders can add cost-per-seat columns and build total-cost-of-ownership models directly in the workbook.
- **CSV** works when the data needs to feed a financial planning system, ERP, or procurement tool that accepts structured flat files. CSV is also the best choice for automated ingestion into BI platforms like Power BI or Tableau.
- **JSON** serves technical stakeholders who want to build custom dashboards or feed the license data into monitoring systems that can alert when available seats drop below a threshold.
- **HTML** produces a self-contained report that is ideal for email attachments to executive stakeholders. The HTML format preserves table formatting and is readable on any device with a browser, making it suitable for mobile review during approval workflows.

## Integrating license data with other report modules

The license availability report becomes significantly more powerful when combined with data from other M365 Tenant Reporter modules:

- **License + User report:** Identify which users are assigned to which SKUs and whether any licensed users are inactive.
- **License + License Services report:** Drill into individual service plan utilization to find right-sizing opportunities.
- **License + Security Insights:** Find licensed users who lack MFA registration -- these represent both a cost investment and a security risk.
- **License + Mailbox report:** Identify shared mailboxes that have licenses assigned unnecessarily, or shared mailboxes approaching the 50 GB threshold that will soon require licensing.

By reviewing multiple report modules in the same snapshot session, you build a holistic picture of license utilization that no single report can provide independently. The snapshot model ensures all data reflects the same point in time, eliminating inconsistencies that arise when different reports are pulled at different times.
