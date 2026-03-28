---
title: "How to inspect and analyze direct group member counts in Microsoft 365"
description: "A comprehensive guide to understanding group types, interpreting direct vs transitive membership counts, navigating Graph API caveats, and using M365 Tenant Reporter's group report for access reviews, cleanup, and governance."
category: "Groups"
reading_time: "14 min read"
featured: true
keywords:
  - group member counts
  - microsoft graph groups report
  - direct group membership
  - microsoft 365 group types
  - security group audit
  - distribution group cleanup
  - group access review
  - transitive membership
  - group governance
  - orphaned groups
---

Groups are the foundational building block of access control, license assignment, policy targeting, and communication routing in Microsoft 365. Yet in many tenants, the group landscape is poorly understood -- organizations accumulate hundreds or thousands of groups over time, with inconsistent naming, overlapping membership, and unclear ownership. M365 Tenant Reporter's group report provides a compact, sortable inventory of every group in the directory, including the normalized group type, mail and security flags, and the direct member count for each group.

## Microsoft 365 group types explained

Before analyzing group data, it is important to understand the four primary group types that exist in Microsoft Entra and how M365 Tenant Reporter normalizes them for consistent reporting.

### Security groups

Security groups are the classic access control primitive. They are `securityEnabled: true` and `mailEnabled: false`, and they are used to assign permissions to Azure resources, scope Conditional Access policies, target device compliance policies, and manage application access. They do not have an associated mailbox or collaboration surface. Security groups can be assigned-membership (static) or dynamic, where membership is computed from user attribute rules.

### Distribution groups

Distribution groups exist for email routing. They are `mailEnabled: true` and `securityEnabled: false`, and their primary purpose is to deliver email to a set of recipients simultaneously. Distribution groups are managed in Exchange Online and cannot be used for access control to Azure resources or applications. They are among the oldest group types in the Microsoft ecosystem and frequently accumulate stale membership over time.

### Mail-enabled security groups

These hybrid groups are both `mailEnabled: true` and `securityEnabled: true`. They can receive email like a distribution group while also being used for access control like a security group. They are less common than pure security or distribution groups but appear frequently in organizations that migrated from on-premises Active Directory where this dual-purpose pattern was standard.

### Microsoft 365 groups (Unified groups)

Microsoft 365 groups are the modern collaboration-oriented group type, identified by the presence of `"Unified"` in the `groupTypes` array. Each Microsoft 365 group provisions a shared mailbox, a SharePoint site, a Planner board, and optionally a Teams team. They are `mailEnabled: true` and `securityEnabled: false` by default. Microsoft 365 groups are the only type that supports dynamic membership through Azure AD dynamic group rules without requiring Azure AD Premium licensing for the dynamic membership feature itself (though premium licensing unlocks additional dynamic rule capabilities).

> M365 Tenant Reporter normalizes these four types into human-readable labels -- "Security," "Distribution," "Mail-enabled security," and "Microsoft 365" -- so you do not need to interpret boolean flag combinations manually.

## Direct vs transitive membership: why the distinction matters

Membership in Microsoft 365 groups can be direct or transitive. Direct membership means the user (or service principal, or nested group) is explicitly listed as a member of the group. Transitive membership includes everyone who is a member through nested group chains -- if Group A contains Group B, and Group B contains User C, then User C is a transitive member of Group A.

M365 Tenant Reporter reports **direct member counts** exclusively. This is a deliberate design choice for several reasons:

- **Predictability.** Direct counts are deterministic and easy to explain. A direct count of 47 means there are exactly 47 entities listed as members of that group. Transitive counts can vary depending on the depth of nesting, circular references, and dynamic group evaluation timing.
- **Performance.** Computing transitive membership requires the `$count` endpoint with ConsistencyLevel: eventual or recursive expansion of nested groups, both of which are significantly more expensive in terms of API calls and latency. For tenants with thousands of groups, transitive expansion would dramatically increase snapshot collection time.
- **Operational relevance.** When administrators review group membership for cleanup or governance purposes, they typically care about what is directly assigned to the group. Removing a nested group from a parent group's membership is a single operation; understanding transitive membership requires understanding the full nesting chain, which is better suited to purpose-built governance tools.

### How direct counts are collected

For each group in the directory, M365 Tenant Reporter first attempts to call `/groups/{id}/members/$count` with the `ConsistencyLevel: eventual` header. This endpoint returns the count as a plain text integer, which is the most efficient way to get the number without downloading the full member list.

If the `$count` endpoint fails (which can happen due to server-side issues or specific group configurations), the report falls back to expanding the members collection with `/groups/{id}?$expand=members($select=id)` and counting the returned objects. When this fallback is used, the snapshot notes it so administrators understand that the count method differed for those specific groups.

## The Microsoft Graph v1.0 caveat about service principals

M365 Tenant Reporter keeps a specific Graph API caveat visible in the report: the v1.0 endpoint for `/groups/{id}/members` does not consistently include service principal members in the count. Service principals (representing applications) can be members of security groups for role assignment and access control purposes, but the v1.0 members endpoint may not return them depending on the tenant configuration and API version behavior.

This means that for groups where service principals are members, the direct count shown in the report may be lower than the actual total membership. The discrepancy is documented by Microsoft and is not a bug in M365 Tenant Reporter. If precise service principal membership counts are critical for your audit, you should supplement the report with targeted queries using the beta endpoint or Microsoft Graph PowerShell.

> The report makes this caveat visible rather than hiding it because transparency about data quality is more valuable than presenting artificially clean numbers. When you see the caveat note in your snapshot, it means the report is being honest about a known limitation.

## Using group data for access reviews

Microsoft Entra access reviews can be configured to review membership of specific groups, but deciding which groups to review and how to prioritize them requires the kind of inventory that M365 Tenant Reporter provides. The group report enables several access review preparation workflows:

### Identifying oversized groups

Groups with unusually large member counts deserve scrutiny. A security group with 5,000 direct members may be granting broad access to a resource that should have more granular controls. Sort the group report by member count in descending order to identify the largest groups and evaluate whether their size reflects intentional broad access or membership drift.

### Flagging empty groups

Groups with zero members are either newly created and awaiting population, or they are abandoned artifacts from decommissioned projects. Empty groups that have existed for more than a few weeks without gaining members are strong candidates for deletion. They clutter the directory, appear in people pickers and group selection dialogs, and create confusion about what access they were supposed to grant.

### Reviewing group type distribution

The normalized group type column lets you assess the overall health of your group landscape. A tenant with a disproportionately high number of distribution groups relative to Microsoft 365 groups may indicate that the organization has not adopted modern collaboration patterns. A tenant with many security groups but no access review program may have accumulated excessive standing access over time.

### Preparing access review scope

Export the group report to Excel and add columns for review status, assigned reviewer, and review outcome. Use this workbook as the planning artifact for your quarterly access review cycle. For each group, record whether it has been reviewed, who reviewed it, and what action was taken (kept as-is, membership trimmed, group deleted, converted to a different type).

## Cleanup strategies for problematic groups

### Orphaned groups

A group is effectively orphaned when it has no owners. In Microsoft 365 groups, the owners list determines who can manage membership and group settings. When all owners leave the organization without transferring ownership, the group becomes unmanageable through self-service. M365 Tenant Reporter's group report does not directly show owner counts (this would require additional Graph queries), but the member count data can be combined with separate owner audits to identify orphaned groups.

### Stale distribution groups

Distribution groups are notorious for accumulating stale membership because they are often not covered by automated access review processes. If your tenant has distribution groups that have not been modified in over a year, export the list and work with team leads to validate whether each group is still in active use.

### Duplicate and overlapping groups

Large organizations frequently end up with multiple groups serving the same purpose -- for example, "Marketing Team," "Marketing," and "Marketing-All" may all exist with overlapping but not identical membership. The group report's alphabetical sorting makes name-based duplicates easy to spot. For access control groups, overlapping membership can lead to permission sprawl that is difficult to audit.

### Groups with suspicious membership patterns

A security group that suddenly has significantly more members than expected may indicate unauthorized membership changes. While M365 Tenant Reporter provides a point-in-time snapshot rather than change tracking, comparing exports from different snapshot dates can reveal unexpected membership growth.

## Export use cases for group data

The group report serves different audiences depending on the export format:

- **CSV** is the most versatile format for group data. It imports cleanly into PowerShell scripts that perform bulk group operations, feeds SIEM platforms that correlate group membership with access events, and loads into database tables for trend analysis across multiple snapshot dates.
- **Excel** is best for governance teams who need to annotate the group inventory with ownership, review status, and remediation actions. Conditional formatting can be applied to highlight groups above a certain member count threshold or groups of a specific type.
- **JSON** serves automation scenarios where the group inventory feeds a governance workflow -- for example, a scheduled function that compares the current group list against an approved group registry and flags unrecognized groups.
- **HTML** provides a portable reference artifact for cleanup meetings. The self-contained format means it can be opened on any device with a browser, shared via email, or attached to a change management ticket as evidence of the pre-cleanup group state.

## Building a group governance practice

Group data from M365 Tenant Reporter is most valuable when it feeds a recurring governance cycle rather than serving as a one-time audit. A practical group governance cadence includes:

- **Monthly inventory snapshot.** Export the group report monthly and track the total count, type distribution, and average member count over time. Trending data reveals whether group sprawl is accelerating or under control.
- **Quarterly cleanup sweep.** Identify and remediate empty groups, investigate groups with zero or one member that are older than 90 days, and verify ownership for the largest groups.
- **Annual type review.** Evaluate whether legacy distribution groups should be migrated to Microsoft 365 groups to take advantage of modern collaboration features. Assess whether mail-enabled security groups still serve their dual purpose or should be split into separate security and distribution groups.

The combination of direct member counts, normalized group types, and flexible export formats makes the M365 Tenant Reporter group report a practical starting point for organizations that need to bring order to a sprawling group landscape without investing in a full governance platform.
