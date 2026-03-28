---
title: "How Microsoft Graph permissions and admin consent work in M365 Tenant Reporter"
description: "Understand the difference between core reporting scopes, usage report scopes, and optional audit access before production rollout."
category: "Permissions"
reading_time: "5 min read"
keywords:
  - microsoft graph delegated permissions
  - reports.read.all
  - auditlog.read.all
---
M365 Tenant Reporter is intentionally scoped for reporting, which means the delegated permission set is organized around read access rather than remediation or tenant management.

## Core scope group

Core scopes support inventory reporting across users, groups, license assignments, and mailbox purpose.

## Optional scope groups

Reports and audit capabilities are separated so operators can keep the initial consent boundary tighter if they do not need usage analytics or last sign-in visibility.

## Why that separation helps

It makes the open-source product easier to evaluate because teams can match the requested scopes to the reporting modules they actually plan to use.
