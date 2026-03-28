---
title: "Why zero-storage reporting matters for Microsoft 365 operations"
description: "A comprehensive look at the zero-storage architecture — how browser-only data processing works, why no tenant data is persisted server-side, and how this model compares to traditional SaaS reporting tools for compliance, data residency, and threat surface reduction."
category: "Security"
reading_time: "13 min read"
keywords:
  - zero storage reporting
  - browser only microsoft graph
  - microsoft 365 reporting privacy
  - data residency compliance
  - gdpr microsoft 365 reporting
  - zero trust architecture
  - client side data processing
  - tenant data governance
  - saas security comparison
  - browser memory data processing
---

Most reporting tools for Microsoft 365 follow a familiar pattern: they authenticate against your tenant, pull data into their own infrastructure, store it in a database, and serve it back through a dashboard. That model is well understood, but it creates a second long-lived copy of your tenant data — one that now lives outside your direct control, in a vendor's environment, subject to their security practices and data retention policies. M365 Tenant Reporter takes a fundamentally different approach. The entire data lifecycle — collection, processing, rendering, and export — happens in the browser. No tenant data ever reaches a server operated by the application.

## How browser-only data processing works

When an administrator signs in and the reporting session begins, the browser makes authenticated calls directly to the Microsoft Graph API at `graph.microsoft.com`. The access token used for these calls is held in browser memory by the Microsoft Authentication Library (MSAL) and is never sent to any third-party server.

The Graph API responses — user objects, group memberships, license assignments, mailbox settings, and optionally usage reports and sign-in activity — are received by the browser and held in JavaScript memory. The application's reporting engine processes this data client-side: it aggregates counts, resolves SKU IDs to product names, classifies mailbox types, and builds the data structures that power the overview cards, charts, and detailed report tables.

> **What this means technically:** The data exists in the browser's heap memory for the duration of the session. It is not written to `localStorage`, `sessionStorage`, `IndexedDB`, cookies, or any other persistent browser storage mechanism. When the user closes the tab or navigates away, the JavaScript runtime is torn down and the memory is released by the browser's garbage collector.

## The session lifecycle from a data perspective

Understanding where data lives at each stage of the session helps security reviewers evaluate the threat surface:

1. **Pre-authentication.** No tenant data exists anywhere in the application. The static site assets (HTML, CSS, JavaScript) are served from the hosting platform and contain no tenant-specific information.
2. **Authentication.** The browser obtains an access token from Microsoft Entra. The token is held in MSAL's in-memory cache and is scoped to the consented Graph permissions.
3. **Data collection.** The browser calls Graph API endpoints and receives JSON responses containing tenant data. This data is parsed and stored in JavaScript variables within the application's runtime.
4. **Reporting.** The in-memory data is processed, aggregated, and rendered into the reporting UI. All computation happens in the browser's main thread or web workers.
5. **Export (optional).** If the user initiates an export, the browser generates a file (CSV, Excel, or HTML) from the in-memory data and triggers a browser download. The file lands in the user's local Downloads folder.
6. **Session end.** When the tab is closed, all in-memory data is discarded. There is no background process, service worker, or persistent cache that retains tenant data after the session ends.

## Comparison with traditional SaaS reporting tools

To appreciate why the zero-storage model matters, consider the typical architecture of a SaaS-based Microsoft 365 reporting product:

- **Authentication:** The SaaS tool registers an application in your tenant with application permissions (not delegated). This grants the tool tenant-wide access without requiring a user to be signed in.
- **Data sync:** A background service runs on the vendor's infrastructure, periodically calling the Graph API to pull your tenant data. This data is stored in the vendor's database — often in a multi-tenant environment shared with other customers.
- **Data retention:** The vendor retains historical data to provide trend analysis and comparative reporting. This means months or years of your tenant data accumulates in their systems.
- **Access control:** The vendor's employees, support staff, and potentially their subprocessors have some level of access to the infrastructure where your data is stored.
- **Data residency:** Your tenant data is stored in whatever region the vendor operates their infrastructure, which may not align with your organization's data residency requirements.

M365 Tenant Reporter sidesteps every one of these concerns because there is no vendor infrastructure in the data path. The browser talks directly to Microsoft's Graph API, processes the data locally, and discards it when the session ends.

| Concern | Traditional SaaS tool | M365 Tenant Reporter |
|---|---|---|
| Data storage location | Vendor's cloud infrastructure | Browser memory only |
| Data retention | Weeks, months, or years | Duration of browser session |
| Background access | Application permissions (always-on) | Delegated permissions (session-bound) |
| Vendor employee access | Possible through infrastructure access | Not applicable — no vendor infrastructure |
| Data residency control | Determined by vendor | Determined by your browser location and Microsoft Graph region |

## Compliance benefits for regulated organizations

The zero-storage architecture provides tangible compliance advantages for organizations operating under strict regulatory frameworks.

### GDPR and data protection regulations

Under the General Data Protection Regulation (GDPR), any entity that stores or processes personal data is considered a data processor and must comply with a range of obligations — including data processing agreements, breach notification requirements, and data subject access requests. Because M365 Tenant Reporter does not store personal data on any server, the application does not act as a data processor in the GDPR sense. The data processing relationship remains exclusively between your organization (as the data controller) and Microsoft (as the data processor for Graph API data).

This dramatically simplifies the compliance paperwork. There is no Data Processing Agreement (DPA) to negotiate with the tool vendor, no subprocessor list to review, and no data breach notification chain that extends through a third party.

### Data residency and sovereignty

Organizations with data residency requirements — whether driven by regulation, contractual obligation, or internal policy — often struggle with SaaS tools that store data in regions outside their jurisdiction. With zero-storage reporting, the only copies of your tenant data are (a) the authoritative data in Microsoft's Graph API, hosted in your tenant's designated region, and (b) the transient copy in the administrator's browser, which is physically located wherever the administrator is sitting. No intermediate data store exists in a third-party region.

### Audit and procurement simplification

When onboarding a new tool, many organizations require a vendor security assessment (VSA), SOC 2 report review, penetration test results, and evidence of encryption at rest. These requirements exist because the vendor is storing your data. When the tool stores nothing, the scope of the vendor assessment shrinks considerably. The conversation shifts from "how do you protect our data in your environment" to "show us what permissions the app requests and confirm it is client-side only."

## Threat model analysis

A thorough security evaluation should consider what attack vectors exist and how the zero-storage model mitigates them.

### Server-side data breach

In a traditional SaaS architecture, a breach of the vendor's infrastructure exposes stored tenant data for all customers. This is the most consequential risk in multi-tenant SaaS platforms. M365 Tenant Reporter eliminates this vector entirely — there is no server-side data store to breach.

### Token theft

The access token is held in browser memory and is valid for a limited time (typically one hour for Graph API tokens). An attacker who gains access to the browser session could potentially extract the token from memory, but this requires either physical access to the machine or a browser-level exploit. This risk is equivalent to the risk of using any browser-based application that authenticates against Microsoft Entra, including the Microsoft 365 admin center itself.

### Export file handling

The primary residual risk is in the exported files. Once a user downloads a CSV, Excel, or HTML export, that file contains tenant data and is subject to the organization's own data handling policies. The application cannot control what happens to exported files after download — this responsibility falls on the organization's data governance framework.

> **Recommendation:** Treat exported reports with the same sensitivity as any other document containing employee directory data, licensing information, or mailbox configuration details. Apply your existing classification, retention, and sharing policies.

### Supply chain risk

As an open-source application, the source code is publicly auditable. Organizations can review the codebase to confirm that no data exfiltration, telemetry, or external network calls exist outside of the Microsoft Graph API communication. This level of transparency is rarely available with proprietary SaaS reporting tools.

## Recommendations for organizations with strict data governance

For organizations that operate under particularly rigorous data governance requirements — such as government agencies, financial institutions, healthcare providers, or defense contractors — consider the following practices when adopting zero-storage reporting:

- **Audit the source code** before deployment. Confirm that no external network calls are made beyond `graph.microsoft.com` and `login.microsoftonline.com`.
- **Deploy from a controlled fork** if your security policy requires it. Hosting the static site from your own infrastructure gives you full control over the assets served to administrators' browsers.
- **Restrict export permissions** through organizational policy. Define who is authorized to export data and where exports may be stored.
- **Use browser isolation** if your organization employs browser isolation technology for accessing sensitive web applications. The zero-storage model is fully compatible with browser isolation environments.
- **Monitor Entra sign-in logs** for the M365 Tenant Reporter app registration. Because every session requires authentication, all usage is recorded in your Entra sign-in logs and can be reviewed through your existing SIEM or log analytics platform.

## What zero-storage does not replace

It is important to be clear about what zero-storage reporting is and is not. It is not a replacement for a data warehouse or a historical trend analysis platform. Because data is not persisted between sessions, there is no built-in mechanism for comparing this week's snapshot to last month's snapshot. Organizations that need historical trend analysis should establish a workflow where periodic exports are saved to a controlled location and compared manually or through external tooling.

Zero-storage reporting is optimized for point-in-time visibility — answering questions like "how many licensed users do we have right now" or "which accounts have not signed in recently." For organizations that need continuous monitoring, alerting, or historical baselines, the export workflow provides the raw data, but the trend analysis happens outside the tool.

## Summary

The zero-storage architecture of M365 Tenant Reporter is a deliberate design choice that prioritizes data minimization, compliance simplicity, and threat surface reduction. By keeping all tenant data in the browser and discarding it at session end, the tool avoids the security, privacy, and regulatory complexities that come with server-side data storage. For organizations evaluating reporting tools, this model offers a compelling alternative — especially when the primary need is point-in-time visibility rather than continuous data warehousing.
