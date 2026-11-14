# WENDORO ERP — Technical Architecture Document (V1.0)

**Status:** Phase 0 Foundation  
**Primary Database:** PostgreSQL (Neon Dev / Cloudflare Hyperdrive Prod)  
**ORM & Migrations:** Drizzle ORM + Versioned SQL Migrations  
**Authentication:** Better Auth (PostgreSQL Adapter)  
**Runtime Target:** Cloudflare Workers (Portable Domain Core for Self-Hosted / Tauri Future)

---

## 1. Three-Layer Modular Architecture

WENDORO enforces strict separation between platform infrastructure, business domains, and vertical industry extensions:

```
┌─────────────────────────────────────────────────────────────────────────┐
│ LAYER C — INDUSTRY APPLICATION PACKAGES (Optional, Installable)         │
│ Retail/Ecommerce · Manufacturing · Electronics · Real Estate ·          │
│ Construction · Healthcare · Education · Logistics · Professional Svcs   │
├─────────────────────────────────────────────────────────────────────────┤
│ LAYER B — BUSINESS APPLICATIONS (Independently Activatable)             │
│ CRM · Sales · Purchase · Catalogue · Inventory · Accounting & Finance · │
│ HRMS & Payroll · Marketing · Projects · Support · Communication · Docs  │
├─────────────────────────────────────────────────────────────────────────┤
│ LAYER A — WENDORO CORE (Shared Platform Services)                       │
│ Identity (Better Auth) · Multi-Tenancy & Companies · RBAC · Branches ·  │
│ Audit Engine · Global Search · Notifications · Workflows · Documents ·  │
│ Custom Fields · WENDORO Connect · WENDORO AI Gateway · Licensing        │
└─────────────────────────────────────────────────────────────────────────┘
```

### Architectural Invariants
1. **No Industry Assumptions in Core**: Core entities (`core`, `organization`, `identity`, `finance`, `catalogue`) must never hardcode retail, manufacturing, or textile assumptions.
2. **Independent Module Activation**: Every Layer B and Layer C application is gated per company via `organization.company_modules` and backend subscription entitlements.
3. **Single Source of Truth**: PostgreSQL is the authoritative transactional database. Cloudflare KV is strictly used for configuration/session caching; Firebase is strictly used for optional push notifications (FCM) and real-time presence.
4. **Monetary Precision**: All monetary columns must use `NUMERIC(19, 4)` (or explicit currency scale), never IEEE-754 floating-point numbers.

---

## 2. Directory Structure

```text
/
├── docs/
│   ├── ARCHITECTURE.md               # System topology, boundaries & invariants
│   └── MILESTONE_1_PLAN.md           # Phase 1 deliverables & acceptance criteria
├── src/
│   ├── core/
│   │   ├── contracts/                # Zod schemas & API/domain contracts
│   │   │   ├── platform.ts           # Portable infrastructure adapter interfaces
│   │   │   └── tenancy.ts            # Tenant, company, branch & RBAC contracts
│   │   └── registry/
│   │       └── modules.ts            # Canonical Layer A/B/C module registry
│   ├── db/
│   │   ├── migrations/
│   │   │   └── 0000_core_foundation_rls.sql  # Initial DDL + PostgreSQL RLS policies
│   │   ├── schema/
│   │   │   ├── enums.ts              # PostgreSQL enums
│   │   │   ├── identity.ts           # identity.* (Better Auth + security)
│   │   │   ├── organization.ts       # organization.* (tenants, companies, RBAC)
│   │   │   ├── core.ts               # core.*, subscriptions.*, audit.*
│   │   │   └── index.ts              # Consolidated schema exports
│   │   └── rls-context.ts            # Transaction-scoped tenant isolation helper
│   ├── components/
│   │   ├── ui/                       # Reusable enterprise design system primitives
│   │   └── shell/                    # AppShell, Sidebar, TopBar, CommandPalette
│   ├── features/
│   │   └── foundation/               # Phase 0 workspace views & architecture tools
│   ├── lib/
│   │   └── utils.ts                  # Formatting & class composition utilities
│   ├── App.tsx                       # Root application & query provider
│   ├── index.css                     # Tailwind v4 tokens & light/dark variables
│   └── main.tsx                      # Entry point
└── package.json
```

---

## 3. Multi-Tenancy & Identity Isolation Model

### Separation of Identity & Business Authorization
- **Identity (`identity.users`)** represents a global human or service account authenticated via Better Auth (email/password, OAuth, magic links, passkeys, MFA).
- **Business Authorization (`organization.memberships`, `organization.user_role_assignments`)** binds a `user_id` to a `tenant_id` and `company_id`. A single user can belong to multiple companies with completely different roles (e.g., *Owner* in Company A, *External Auditor* in Company B).

### Defense-in-Depth Tenant Isolation
1. **API Middleware**: Extracts authenticated session, verifies requested `X-Company-Id` against active `organization.memberships`, and resolves effective permissions and module entitlements.
2. **Transaction-Scoped PostgreSQL RLS**: Every database operation executes inside `withTenantContext(db, { tenantId, companyId, userId }, async (tx) => ...)`, which issues:
   ```sql
   SELECT set_config('app.current_tenant_id', $1, true);
   SELECT set_config('app.current_company_id', $2, true);
   ```
   Using `is_local = true` ensures transaction-level scoping compatible with Cloudflare Hyperdrive / PgBouncer transaction pooling.
3. **Database Policies**: Tenant-owned tables enforce `USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid)` at the PostgreSQL row level.

---

## 4. Infrastructure & Portable Adapter Strategy

Business services depend solely on TypeScript interfaces defined in `src/core/contracts/platform.ts`:
- `DatabaseAdapter`: Implemented by Neon/Hyperdrive in Cloudflare Workers, or local `pg` / embedded Postgres in self-hosted Linux & Tauri editions.
- `StorageAdapter`: Implemented by Cloudflare R2 in cloud deployments, or S3-compatible / local filesystem storage in self-hosted deployments.
- `QueueAdapter`: Implemented by Cloudflare Queues/Workflows in cloud deployments, or Redis/SQL-backed worker queues locally.
- `AiGatewayAdapter`: Server-side provider abstraction starting with Google Gemini (`@google/genai`), supporting OpenAI and Anthropic without exposing keys to browsers. Every AI tool execution checks the caller's RBAC permissions and logs to `audit.audit_logs`.

---

## 5. Security & Compliance Baseline
- **Zero Secret Leakage**: Database URLs, Better Auth secrets, Gemini/LLM API keys, and integration OAuth client secrets remain strictly server-side.
- **Immutable Audit Trail**: Financial postings, stock ledger movements, role changes, and administrative support impersonation events write append-only rows to `audit.audit_logs`.
- **No Unverified External Assets**: All UI icons and typography are bundled or explicitly loaded; static data never masquerades as live business operations.
