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

### Option 1: One-Click Deploy (No Keys Required)
Click the **Deploy to Cloudflare** button at the top of this README. Cloudflare will clone [`https://github.com/wendoro/Wendoro-Desk`](https://github.com/wendoro/Wendoro-Desk), run `npm ci`, `npm run build`, and publish `dist/` using [`wrangler.jsonc`](./wrangler.jsonc) — **zero API keys or database secrets are required to deploy**.

> **Add keys only when needed:** Once deployed, you can add your own `GEMINI_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`, or `VITE_FIREBASE_*` values anytime under **Cloudflare Dashboard -> Workers & Pages -> Settings -> Variables and Secrets** (or `npx wrangler secret put <KEY>`).

### Option 2: Automated Deployment (Every Push to `main`)

**Method A — Cloudflare Workers Git Integration (Recommended):**
1. In Cloudflare Dashboard, go to **Workers & Pages -> Create -> Import a repository**.
2. Connect your GitHub repository (`Wendoro-Desk` / `wendoro-desk`).
3. Set **Build command** to `npm run build` and **Deploy command** to `npx wrangler deploy`.
4. Every push to `main` will automatically build and deploy.

**Method B — GitHub Actions CI/CD (`.github/workflows/deploy-cloudflare.yml`):**
1. Add two repository secrets in GitHub (**Settings -> Secrets and variables -> Actions**):
   - `CLOUDFLARE_API_TOKEN` (Cloudflare API Token with *Edit Cloudflare Workers* permissions)
   - `CLOUDFLARE_ACCOUNT_ID` (Your Cloudflare Account ID)
2. Push to `main` (or trigger **Run workflow** manually) to run `npm ci`, `npm run lint`, `npm run build`, and `wrangler deploy`.

### Option 3: CLI Deploy via Wrangler
```bash
# 1. Clone the repository
git clone https://github.com/wendoro/Wendoro-Desk.git
cd Wendoro-Desk

# 2. Install dependencies
npm ci

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

## Multi-Platform Self-Hosting & Distribution

WENDORO ERP avoids vendor lock-in. In addition to Cloudflare Workers, you can deploy the exact same codebase across containers, bare-metal Linux, PaaS platforms, and edge CDNs.

### Option A: Docker Compose + PostgreSQL 16 (Self-Hosted Stack)
Boots a `postgres:16-alpine` database (automatically initialized with `src/db/migrations/0000_core_foundation_rls.sql`) and the Node 24 production server (`server.ts` with `/api/health`):

```bash
cp .env.example .env
docker compose up -d --build
curl -fsS http://localhost:3000/api/health
```

### Option B: Node.js 24 / Coolify / Railway / Render / VPS
```bash
npm ci
npm run build
psql "$DATABASE_URL" -f src/db/migrations/0000_core_foundation_rls.sql
npm start
```
`npm start` executes `node server.ts` on `0.0.0.0:${PORT:-3000}` with Express SPA routing and health checks. Schema migrations are configured in [`drizzle.config.ts`](./drizzle.config.ts).

### Option C: Vercel & Netlify
- **Vercel**: Pre-configured via [`vercel.json`](./vercel.json) (`npm run build` -> `dist/`).
- **Netlify**: Pre-configured via [`netlify.toml`](./netlify.toml) (`npm run build` -> `dist/` with SPA redirects).

---

## Local Development

```bash
# Install packages (requires Node.js >= 24.12)
npm install

# Start Vite development server on port 3000
npm run dev

# Typecheck and build
npm run lint
npm run build
```

---

## Security & Public Repository Hygiene

This repository is safe for public hosting:
- `firebase-applet-config.json`, `.env*` (except `.env.example`), `.dev.vars`, `.wrangler/`, and `bun.lock` are excluded via `.gitignore`.
- No API keys, database URLs, personal emails, or signing secrets are committed.
- **For self-hosters**: Copy `firebase-applet-config.example.json` to `firebase-applet-config.json` (gitignored) or configure `VITE_FIREBASE_*` build variables from `.env.example`. Server-side secrets (`GEMINI_API_KEY`, `DATABASE_URL`, `BETTER_AUTH_SECRET`) must only be set via `npx wrangler secret put`, `.env` on your server, or your deployment provider's encrypted secrets panel.

---

## Open-Source Governance & Licensing

- **Open-Source Core**: [`LICENSE`](./LICENSE) (Apache-2.0 License — Copyright 2026 BakeWeb)
- **Contributing Guide**: [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- **Security Policy**: [`SECURITY.md`](./SECURITY.md)
- **Commercial Plans & Enterprise Modules**: Licensed by **BakeWeb** (India)

