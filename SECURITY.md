# Security Policy

## Supported Versions

| Version | Supported |
| --- | --- |
| `main` (Phase 0+ Foundation) | Yes |

## Reporting a Vulnerability

Because **WENDORO** handles multi-tenant enterprise data, double-entry financials, and RBAC isolation, we take security issues seriously—especially:
- Cross-tenant data exposure or PostgreSQL RLS bypasses
- Authentication or session-context privilege escalation
- Firestore security rule bypasses
- Secret leakage in client bundles

Please **do not** open a public GitHub issue for unpatched security vulnerabilities. Instead, report vulnerabilities privately through GitHub's **Security Advisories** (*Security -> Advisories -> Report a vulnerability*) on `wendoro/Wendoro-Desk`.

Include:
1. Affected file(s), endpoint(s), or migration(s)
2. Reproduction steps or proof-of-concept payload
3. Potential impact across tenants or roles
