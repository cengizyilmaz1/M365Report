# Security Policy

## Supported versions

This project currently supports the latest state of the `main` branch.

## Reporting a vulnerability

Please do not open a public GitHub issue for security-sensitive findings.

Report vulnerabilities privately to the project maintainers with:

- a description of the issue
- reproduction steps
- potential impact
- any suggested mitigation

The goal is to acknowledge reports quickly, validate the impact, and coordinate a fix before public disclosure when needed.

## Security boundaries

- The app is designed to avoid server-side storage of tenant report data
- Public runtime configuration must not contain confidential secrets
- Operators are responsible for securing downloaded report files on their own devices or within their own organization
