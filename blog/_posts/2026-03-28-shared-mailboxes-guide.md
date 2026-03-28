---
title: "How to identify shared mailboxes with mailbox purpose data"
description: "Use mailbox purpose classification to separate shared mailboxes from regular user accounts without switching to a different toolchain."
category: "Mailboxes"
reading_time: "5 min read"
featured: true
keywords:
  - shared mailbox report
  - mailbox purpose
  - microsoft 365 shared mailboxes
---
Shared mailboxes often blur together with user identities when teams only look at a broad user export. M365 Tenant Reporter reads mailbox purpose so the snapshot can distinguish shared mailboxes from standard user mailboxes and other specialized mailbox types.

## Why this matters

Mailbox type affects how teams reason about ownership, support, licensing expectations, and service desk workflows.

## Practical review pattern

- Start with the shared mailbox count in the overview.
- Open the mailbox report to review detailed rows.
- Export the subset when ownership or cleanup work needs to happen outside the app.

## Important caveat

If mailbox purpose is unavailable for a row, the app marks it as unknown instead of failing the entire collection run.
