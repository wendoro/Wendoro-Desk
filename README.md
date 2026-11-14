# WENDORO ERP

**Universal, Multi-Industry, AI-Powered Business Operating System**  
*Built in India by **BakeWeb** — engineered for global business.*

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/bakeweb/wendoro)

> **Note for forks:** Replace `https://github.com/bakeweb/wendoro` in the Deploy to Cloudflare link above with your repository URL if deploying from a custom fork.

---

## Overview

**WENDORO** unifies ERP, CRM, HRMS & Payroll, Double-Entry Accounting, Inventory, Procurement, Projects, Support, Automation, and AI into a single modular, multi-tenant operating system.

Designed by **BakeWeb** (India) for startups, SMEs, and multi-company global enterprises, WENDORO supports both **India-native compliance** (GST, CGST/SGST/IGST, HSN/SAC, TDS, E-Invoice, E-Way Bill) and **international operations** (multi-currency with PostgreSQL `NUMERIC(19, 4)` precision, configurable fiscal calendars, and country-specific payroll).

### Core Principles
- **One Platform, Multiple Industries**: No hardcoded retail, textile, electronics, or manufacturing assumptions in the core. Supports physical goods, digital products, services, rentals, subscriptions, and custom entities.
- **Open-Source Core + Paid Commercial Licensing**: Self-host the open-source core freely or unlock multi-company scale, advanced compliance, SSO, white-labeling, and managed cloud quotas through tiered commercial licenses.
- **Strict Tenant Isolation**: Every business record is scoped by `tenant_id` and `company_id` with transaction-scoped PostgreSQL Row-Level Security (`SET LOCAL`).
- **Cloudflare-First & Portable**: Built for **Cloudflare Workers + Hyperdrive + R2 + Queues**, **PostgreSQL (Neon)**, and **Firebase (Firestore Realtime Presence & FCM)** while keeping domain logic portable for self-hosted Linux and desktop editions.

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

All entitlement quotas (users, companies, branches, storage, AI tokens, API calls, and active modules) are validated on the backend via `src/core/contracts/licensing.ts`.

---

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4, TanStack Query, Lucide Icons
- **Database & ORM**: PostgreSQL (Neon / Hyperdrive), Drizzle ORM, Versioned SQL Migrations, Row-Level Security
- **Edge & Cloud**: Cloudflare Workers & Static Assets (`wrangler.jsonc`), Cloudflare R2, Queues, KV
- **Realtime & Push**: Firebase Firestore (presence & notifications) + Firebase Auth
- **AI**: Server-side AI Gateway (`@google/genai` Gemini primary, multi-provider abstraction)

---

## Deploy on Cloudflare

### Option 1: One-Click Deploy
Click the **Deploy to Cloudflare** button at the top of this README. Cloudflare will clone the repository, install dependencies, run `npm run build`, and deploy `dist/` using [`wrangler.jsonc`](./wrangler.jsonc).

### Option 2: CLI Deploy via Wrangler
```bash
# 1. Install dependencies
npm install

# 2. Build the production bundle
npm run build

# 3. Deploy to Cloudflare Workers & Static Assets
npx wrangler deploy
```

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
