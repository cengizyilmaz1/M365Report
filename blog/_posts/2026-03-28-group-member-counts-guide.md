---
title: "How to inspect direct group member counts"
description: "Understand how the group report surfaces direct member counts and how to interpret the documented Microsoft Graph v1.0 caveats."
category: "Groups"
reading_time: "5 min read"
featured: true
keywords:
  - group member counts
  - microsoft graph groups report
  - direct group membership
---
Group member counts are most useful when they are direct, predictable, and easy to explain. That is why M365 Tenant Reporter focuses on direct membership counts instead of trying to turn the report into a transitive directory expansion engine.

## What the groups report shows

You get a compact table with group name, normalized group type, mail or security flags, and the direct member count used by the UI.

## Caveat handling

The report keeps the Microsoft Graph v1.0 caveat visible so operators know when service principal visibility can affect direct membership totals.

## Best export choice

CSV is a strong default when directory teams want to inspect group sizing in another system, while HTML is useful for portable review during cleanup meetings.
