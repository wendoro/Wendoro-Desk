# WENDORO ERP — Implementation Milestone 1 & Acceptance Criteria

**Milestone:** Phase 1 — Authentication, Organizations, Tenant Isolation & Core RBAC  
**Prerequisite:** Phase 0 Foundation (Approved)

---

## 1. Milestone 1 Scope & Objectives

Establish live, end-to-end multi-tenant identity, company onboarding, branch management, and permission-enforced API access backed by PostgreSQL, Drizzle ORM, and Better Auth.

### Planned Deliverables
1. **Server Entry & Worker/API Boundary**:
   - Configure modular REST API router (`/api/v1/*`) with Zod request/response validation and OpenAPI metadata.
   - Integrate Better Auth with PostgreSQL `identity.*` tables (email/password, session cookies, CSRF protection, password recovery hooks).
2. **Database Provisioning & Migrations**:
   - Execute migration `0000_core_foundation_rls.sql` against PostgreSQL.
   - Verify RLS enforcement with dedicated cross-tenant isolation integration tests.
3. **Organization & RBAC Services**:
   - Tenant & company creation workflow (auto-provisioning default HQ branch, Owner role, and baseline system permissions).
   - Company switcher API (`GET /api/v1/auth/context`, `POST /api/v1/auth/switch-company`).
   - Branch & department CRUD endpoints (`/api/v1/org/branches`, `/api/v1/org/departments`).
   - Team invitation & role assignment workflow (`/api/v1/org/invitations`, `/api/v1/org/roles`).
   - Module activation & entitlement enforcement (`/api/v1/org/modules`).
4. **Frontend Auth & Organization Management UI**:
   - Sign-in, sign-up, and company onboarding flows.
   - Organization Settings workspace (Company profile, Branch directory, Department tree, Roles & Permissions matrix, Team Members & Invitations, Module Activation panel).
5. **Automated Test Suite**:
   - Unit tests for permission evaluation and entitlement checks.
   - Integration tests proving Company A cannot read, mutate, or enumerate Company B records even with forged headers or direct query attempts.

---

## 2. Phase 0 Acceptance Criteria (Foundation Sign-Off)

| ID | Criterion | Verification Method |
|----|-----------|---------------------|
| AC-0.1 | Technical architecture document defines 3-layer modularity, RLS strategy, and portable adapters | Inspect `/docs/ARCHITECTURE.md` |
| AC-0.2 | Core PostgreSQL Drizzle schemas exist for `identity`, `organization`, `core`, `subscriptions`, and `audit` with UUID PKs | Inspect `/src/db/schema/*.ts` |
| AC-0.3 | Versioned SQL migration defines tables, indexes, and PostgreSQL RLS policies using transaction-scoped settings | Inspect `/src/db/migrations/0000_core_foundation_rls.sql` |
| AC-0.4 | Identity and multi-tenancy Zod contracts separate user identity from company memberships & roles | Inspect `/src/core/contracts/tenancy.ts` |
| AC-0.5 | Design system supports Light & Dark themes with WENDORO palette (`#101B35`, `#4169F5`, `#8B5CF6`, `#16B8A6`) and tabular numerals | Visual & CSS token verification |
| AC-0.6 | Responsive application shell provides collapsible sidebar, breadcrumbs, company/branch switchers, `⌘K` command palette, and notification drawer | Interactive UI verification & `npm run build` / `npm run lint` |
| AC-0.7 | Zero fake business data or unwired controls in the shell; non-implemented modules display honest roadmap specs | Code & UI audit |

---

## 3. Milestone 1 Acceptance Criteria (Upcoming Phase 1 Gate)

- **AC-1.1**: A user can register, verify session, and create two separate companies (`Company A` and `Company B`) under the same identity.
- **AC-1.2**: The same user can hold `Owner` role in `Company A` and `Viewer` role in `Company B`, and permission checks adapt immediately on company switch.
- **AC-1.3**: An automated test asserting cross-tenant isolation passes: querying `Company B` resources while authenticated with `Company A` context returns `403 Forbidden` at the API layer and 0 rows at the PostgreSQL RLS layer.
- **AC-1.4**: Every state-changing organization action (`branch.created`, `role.updated`, `member.invited`, `module.toggled`) writes an immutable record to `audit.audit_logs`.
- **AC-1.5**: Unentitled or deactivated modules return `403 MODULE_NOT_ACTIVE` on backend routes and are hidden/locked in navigation.
