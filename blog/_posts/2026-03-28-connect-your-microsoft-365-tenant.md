---
title: "How to connect your Microsoft 365 tenant to M365 Tenant Reporter"
description: "Start from the dedicated /login route, review delegated Graph scopes, and open a fresh reporting session."
category: "Getting Started"
reading_time: "5 min read"
keywords:
  - connect microsoft 365 tenant
  - m365report login
  - microsoft entra consent flow
---
The safest way to start using M365 Tenant Reporter is to begin on the dedicated `/login` route. That page separates consent and authentication from the public marketing surface so operators know exactly when the app is requesting delegated Microsoft Graph access.

## What happens during sign-in

The user is redirected to Microsoft Entra, reviews the delegated scope request, and returns to the reporting workspace after a successful authorization flow.

## Why the login route matters

It gives administrators a single production URL they can document internally, test in staging, and approve during onboarding.
