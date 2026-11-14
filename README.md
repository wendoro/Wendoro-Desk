# WENDORO ERP (`Wendoro-Desk`)

**Universal, Multi-Industry, AI-Powered Business Operating System**  
*Built in India by **BakeWeb** — engineered for global business.*

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/wendoro/Wendoro-Desk)

Repository: [`https://github.com/wendoro/Wendoro-Desk`](https://github.com/wendoro/Wendoro-Desk)

---

## Overview

**WENDORO** unifies ERP, CRM, HRMS & Payroll, Double-Entry Accounting, Inventory, Procurement, Projects, Support, Automation, and AI into a single modular, multi-tenant operating system.

Designed by **BakeWeb** (India) for startups, SMEs, and multi-company global enterprises, WENDORO supports both **India-native compliance** (GST, CGST/SGST/IGST, HSN/SAC, TDS, E-Invoice, E-Way Bill, April–March fiscal calendars) and **international operations** (multi-currency with PostgreSQL `NUMERIC(19, 4)` precision, configurable fiscal calendars, and country-specific payroll).

### Core Principles
- **One Platform, Multiple Industries**: No hardcoded retail, textile, electronics, or manufacturing assumptions in the core. Supports physical goods, digital products, services, rentals, subscriptions, and custom entities.
- **Open-Source Core + Paid Commercial Licensing**: Self-host the Apache-2.0 open-source core freely or unlock multi-company scale, advanced compliance, SSO, white-labeling, and managed cloud quotas through tiered commercial licenses.
- **Strict Tenant Isolation**: Every business record is scoped by `tenant_id` and `company_id` with transaction-scoped PostgreSQL Row-Level Security (`SET LOCAL`).
- **Cloudflare-First & Portable**: Built for **Cloudflare Workers + Hyperdrive + R2 + Queues**, **PostgreSQL (Neon)**, and **Firebase (Firestore Realtime Presence & FCM)** while keeping domain logic portable for self-hosted Linux and desktop editions.

---

## First-Run Setup Wizard (Post-Deploy Experience)

Right after deploying **Wendoro-Desk**, opening the application launches the guided **5-Step Setup Wizard** so anyone can configure a production-ready workspace in under 2 minutes:

1. **Organization & Regional Preset**: Configure Tenant, Legal Company Name, Headquarters Branch, and regional defaults (**India `INR` / GST / FY Apr–Mar**, **US `USD`**, **EU `EUR`**, **UK `GBP`**, **Singapore `SGD`**, or custom).
2. **Business Profile & Modules**: Pick a quick preset (*Services & Consulting*, *Retail & Distribution*, *Manufacturing & Engineering*) or selectively enable individual Layer B Business Apps and Layer C Industry Packages.
3. **Edition & License Activation**: Choose **Community Open Source (Apache-2.0)** or enter a commercial/self-hosted license tier (`Starter`, `Business`, `Professional`, `Enterprise`, `White Label`, `Self-Hosted`).
4. **Cloud & Identity Readiness**: Connect Google Sign-In via Firebase Auth, verify Firestore realtime connectivity, and copy ready-to-run Cloudflare Hyperdrive / PostgreSQL migration commands (`src/db/migrations/0000_core_foundation_rls.sql`).
5. **Launch Workspace**: Provisions the company context immediately and transitions into the WENDORO Enterprise Shell.

You can re-run the Setup Wizard at any time from the left navigation rail (**Setup Wizard**) to onboard additional companies.

---

## Architecture

| Layer | Responsibility | Key Modules |
|---|---|---|
| **Layer A — Core** | Shared platform services | Identity, Multi-Tenancy, RBAC, Branches, Audit Logs, Notifications, Workflows, WENDORO Connect, AI Gateway, Licensing |
| **Layer B — Business Apps** | Independently activatable domains | Universal Catalogue, CRM, Sales, Purchase, Inventory, Accounting & Finance, HRMS & Payroll, Marketing, Projects, Support, Documents |
| **Layer C — Industry Packages** | Optional vertical extensions | Retail & Ecommerce, Manufacturing, Electronics & Service, Real Estate, Construction, Logistics, Professional Services |

For full technical specifications, see [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) and [`docs/MILESTONE_1_PLAN.md`](./docs/MILESTONE_1_PLAN.md).

---

## Editions & Licensing Model

WENDORO uses an **open-core** licensing model enforced server-side (`subscriptions.plans` & `subscriptions.tenant_subscriptions`):

| Tier | Edition | Companies | Users | Target Use Case |
|---|---|---|---|---|
| **Free (OSS)** | Open-Source Community | 1 | Up to 5 | Startups, self-hosters & open-source contributors |
| **Starter** | Commercial | 1 | Up to 15 | Growing single-entity businesses |
| **Business** | Commercial | Up to 3 | Up to 50 | Multi-branch SMEs & GST-compliant operators |
| **Professional** | Commercial | Up to 10 | Up to 200 | Multi-company groups with AI & automation |
| **Enterprise** | Commercial | Up to 50+ | 1,000+ | Global enterprises, SSO, custom domains & SLA |
| **White Label** | Commercial OEM | Unlimited | Unlimited | Agencies & SaaS resellers rebranding WENDORO |
| **Self-Hosted** | Commercial Dedicated | Unlimited | Unlimited | Air-gapped & on-premise enterprise deployments |

All entitlement quotas (users, companies, branches, storage, AI tokens, API calls, and active modules) are validated via `src/core/contracts/licensing.ts`.

---

## Deploy on Cloudflare

### Option 1: One-Click Deploy
Click the **Deploy to Cloudflare** button at the top of this README. Cloudflare will clone [`https://github.com/wendoro/Wendoro-Desk`](https://github.com/wendoro/Wendoro-Desk), install dependencies, run `npm run build`, and publish `dist/` using [`wrangler.jsonc`](./wrangler.jsonc).

### Option 2: CLI Deploy via Wrangler
```bash
# 1. Clone the repository
git clone https://github.com/wendoro/Wendoro-Desk.git
cd Wendoro-Desk

# 2. Install dependencies
npm install

# 3. Build and deploy to Cloudflare Workers & Static Assets
npm run deploy:cloudflare
```

### Optional Production Bindings (`wrangler.jsonc`)
When enabling Phase 1+ persistent PostgreSQL & R2 storage on Cloudflare:
1. Create a Neon PostgreSQL database and run `src/db/migrations/0000_core_foundation_rls.sql`.
2. Create a Cloudflare Hyperdrive config pointing to Neon and uncomment the `hyperdrive` binding in `wrangler.jsonc`.
3. Create an R2 bucket (`wendoro-documents`) and KV namespace (`CONFIG_KV`) if using document storage and edge caching.
4. Set server-side secrets via Wrangler (`npx wrangler secret put GEMINI_API_KEY` and `npx wrangler secret put BETTER_AUTH_SECRET`).

---

## Local Development

```bash
# Install packages
npm install

# Start Vite development server on port 3000
npm run dev

# Typecheck and build
npm run lint
npm run build
```

---

## License & Attribution

- **Open-Source Core**: Apache-2.0 License
- **Commercial Plans & Enterprise Modules**: Licensed by **BakeWeb** (India)
