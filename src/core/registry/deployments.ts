export type DeploymentTargetId =
  | 'cloudflare'
  | 'docker'
  | 'node-paas'
  | 'vercel-netlify'
  | 'desktop-airgap';

export interface DeploymentEnvVar {
  name: string;
  scope: 'server' | 'client';
  required: boolean;
  description: string;
  example: string;
}

export interface DeploymentCommandStep {
  title: string;
  command: string;
  note?: string;
}

export interface DeploymentTarget {
  id: DeploymentTargetId;
  name: string;
  shortLabel: string;
  category: string;
  runtime: string;
  scalingProfile: string;
  configFiles: string[];
  summary: string;
  highlights: string[];
  steps: DeploymentCommandStep[];
  envVars: DeploymentEnvVar[];
}

export const WENDORO_REPO_URL = 'https://github.com/wendoro/Wendoro-Desk';

export const WENDORO_DEPLOYMENT_TARGETS: DeploymentTarget[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare Workers + Static Assets',
    shortLabel: 'Cloudflare',
    category: 'Global Edge · Serverless',
    runtime: 'Cloudflare Workers + Hyperdrive + R2 + Queues',
    scalingProfile: 'Zero cold-start global edge across 300+ PoPs with Neon PostgreSQL pooling',
    configFiles: ['wrangler.jsonc', '.npmrc', 'package-lock.json', '.github/workflows/deploy-cloudflare.yml'],
    summary:
      'Recommended default cloud deployment. Zero API keys or secrets are required to deploy — click Deploy to Cloudflare, launch the Setup Wizard immediately, and add Hyperdrive, Better Auth, AI, or Firebase keys later only when needed.',
    highlights: [
      'Zero-key one-click Deploy to Cloudflare button directly from GitHub',
      'Automated CI/CD via GitHub Actions on every push to main',
      'SPA fallback handled natively via assets.not_found_handling',
      'Add Hyperdrive, R2, AI, or Firebase secrets later when enabling modules',
    ],
    steps: [
      {
        title: '1. Install dependencies cleanly (Node 24)',
        command: 'npm ci',
        note: 'Uses .npmrc (legacy-peer-deps=true) and package-lock.json.',
      },
      {
        title: '2. Build & deploy to Cloudflare Workers (no keys needed)',
        command: 'npm run deploy:cloudflare',
        note: 'Runs vite build then npx wrangler deploy using wrangler.jsonc.',
      },
      {
        title: '3. Add optional server secrets later when required',
        command:
          'npx wrangler secret put GEMINI_API_KEY\nnpx wrangler secret put BETTER_AUTH_SECRET',
        note: 'Or configure in Cloudflare Dashboard -> Workers & Pages -> Settings -> Variables and Secrets.',
      },
    ],
    envVars: [
      {
        name: 'GEMINI_API_KEY',
        scope: 'server',
        required: false,
        description: 'Optional server-side AI Gateway key (add only when enabling AI features)',
        example: 'Set later via npx wrangler secret put GEMINI_API_KEY',
      },
      {
        name: 'BETTER_AUTH_SECRET',
        scope: 'server',
        required: false,
        description: 'Optional 32+ byte session signing secret (required only when enabling Phase 1 DB auth)',
        example: 'Set later via npx wrangler secret put BETTER_AUTH_SECRET',
      },
      {
        name: 'VITE_FIREBASE_API_KEY',
        scope: 'client',
        required: false,
        description: 'Optional public Firebase Web SDK config (required only for Google Sign-In & Firestore)',
        example: 'Add in Cloudflare Workers Builds Variables when connecting Firebase',
      },
    ],
  },
  {
    id: 'docker',
    name: 'Docker Compose + PostgreSQL 16',
    shortLabel: 'Docker Compose',
    category: 'Self-Hosted · Containerized',
    runtime: 'Node 24 Alpine + Express + PostgreSQL 16 Alpine',
    scalingProfile: 'Single-node or Swarm/Kubernetes container stack with pre-applied RLS schema',
    configFiles: ['Dockerfile', 'docker-compose.yml', '.dockerignore', 'server.ts'],
    summary:
      'Complete self-hosted open-source stack. Boots PostgreSQL 16 with src/db/migrations/0000_core_foundation_rls.sql pre-loaded alongside the Node 24 production server.',
    highlights: [
      'Multi-stage Dockerfile minimizes production image footprint',
      'PostgreSQL 16 auto-initializes identity, organization, core, subscriptions & audit schemas',
      'Built-in /api/health endpoint for Docker, Kubernetes & Traefik probes',
      'Data sovereignty ready for India/EU on-premise & private VPCs',
    ],
    steps: [
      {
        title: '1. Configure environment overrides',
        command: 'cp .env.example .env',
        note: 'Set strong POSTGRES_PASSWORD and BETTER_AUTH_SECRET before booting.',
      },
      {
        title: '2. Start PostgreSQL 16 + WENDORO ERP container stack',
        command: 'docker compose up -d --build',
        note: 'Exposes the application on http://localhost:3000 and Postgres on 5432.',
      },
      {
        title: '3. Verify container health',
        command: 'curl -fsS http://localhost:3000/api/health',
      },
    ],
    envVars: [
      {
        name: 'POSTGRES_PASSWORD',
        scope: 'server',
        required: true,
        description: 'Database password injected into postgres & app services',
        example: 'Strong random password in local .env',
      },
      {
        name: 'DATABASE_URL',
        scope: 'server',
        required: true,
        description: 'PostgreSQL connection string used by Drizzle & RLS transactions',
        example: 'postgresql://wendoro:<password>@postgres:5432/wendoro',
      },
      {
        name: 'PORT',
        scope: 'server',
        required: false,
        description: 'HTTP listener port inside container',
        example: '3000',
      },
    ],
  },
  {
    id: 'node-paas',
    name: 'Node.js 24 / Coolify / Railway / VPS',
    shortLabel: 'Node / PaaS',
    category: 'PaaS & Bare Metal Linux',
    runtime: 'Node.js >= 24.12 + Express 4 (server.ts)',
    scalingProfile: 'Horizontal container replicas behind Nginx, Caddy, or PaaS load balancers',
    configFiles: ['server.ts', 'package.json', 'drizzle.config.ts', '.env.example'],
    summary:
      'Deploy effortlessly to Railway, Render, Fly.io, Coolify, DigitalOcean App Platform, or any Ubuntu/Debian VPS with standard Node build & start commands.',
    highlights: [
      'Zero external build step for server.ts on Node 24 native TypeScript execution',
      'Drizzle Kit configuration (drizzle.config.ts) ready for schema push & migrations',
      'Graceful SPA history fallback and strict x-powered-by hardening',
      'Compatible with PM2, systemd, Coolify, Railway, and Render',
    ],
    steps: [
      {
        title: '1. Install & build production bundle',
        command: 'npm ci && npm run build',
      },
      {
        title: '2. Apply PostgreSQL foundation schema & RLS',
        command: 'psql "$DATABASE_URL" -f src/db/migrations/0000_core_foundation_rls.sql',
        note: 'Or inspect/push Drizzle schema via npx drizzle-kit generate.',
      },
      {
        title: '3. Start Node.js production server',
        command: 'npm start',
        note: 'Runs node server.ts listening on 0.0.0.0:${PORT:-3000}.',
      },
    ],
    envVars: [
      {
        name: 'DATABASE_URL',
        scope: 'server',
        required: true,
        description: 'Managed PostgreSQL (Neon, Supabase, RDS, or local Postgres 16)',
        example: 'postgresql://user:pass@host:5432/wendoro?sslmode=require',
      },
      {
        name: 'APP_URL',
        scope: 'server',
        required: true,
        description: 'Canonical public URL for OAuth callbacks & multi-company links',
        example: 'https://erp.yourcompany.com',
      },
      {
        name: 'BETTER_AUTH_SECRET',
        scope: 'server',
        required: true,
        description: 'Cryptographic secret for session tokens',
        example: 'openssl rand -hex 32',
      },
    ],
  },
  {
    id: 'vercel-netlify',
    name: 'Vercel & Netlify Edge Hosting',
    shortLabel: 'Vercel / Netlify',
    category: 'Managed Frontend + Serverless',
    runtime: 'Static Edge CDN + External Postgres / Firebase',
    scalingProfile: 'Instant PR previews for open-source contributors and zero-ops CDN distribution',
    configFiles: ['vercel.json', 'netlify.toml', '.npmrc'],
    summary:
      'Pre-configured SPA rewrites and build settings for contributors and teams preferring Vercel or Netlify preview deployments alongside Neon PostgreSQL and Firebase.',
    highlights: [
      'Includes vercel.json and netlify.toml with SPA history fallback',
      'Automatic pull-request preview URLs for open-source maintainers',
      'Respects .npmrc legacy-peer-deps=true automatically on install',
      'Supports VITE_FIREBASE_* environment injection per preview/production branch',
    ],
    steps: [
      {
        title: '1. Deploy via Vercel CLI',
        command: 'npx vercel --prod',
        note: 'Reads vercel.json (buildCommand: npm run build, outputDirectory: dist).',
      },
      {
        title: '2. Or deploy via Netlify CLI',
        command: 'npx netlify-cli deploy --prod --dir=dist',
        note: 'Reads netlify.toml automatically on Git import.',
      },
    ],
    envVars: [
      {
        name: 'VITE_FIREBASE_API_KEY',
        scope: 'client',
        required: false,
        description: 'Firebase Web API key for Google Sign-In & Firestore presence',
        example: 'Configured in Vercel/Netlify Project Environment Variables',
      },
      {
        name: 'VITE_FIREBASE_PROJECT_ID',
        scope: 'client',
        required: false,
        description: 'Target Firebase project identifier',
        example: 'your-firebase-project-id',
      },
    ],
  },
  {
    id: 'desktop-airgap',
    name: 'Desktop & Air-Gapped Enterprise',
    shortLabel: 'Desktop / Air-Gap',
    category: 'Phase 2–3 · Local-First & OEM',
    runtime: 'Tauri Desktop Shell + Local PostgreSQL / Adapter Contracts',
    scalingProfile: 'Offline-capable retail POS, factory floor terminals, and air-gapped networks',
    configFiles: ['src/core/contracts/platform.ts', 'src/core/contracts/licensing.ts', 'LICENSE'],
    summary:
      'Because WENDORO abstracts auth, storage, queues, and AI behind portable TypeScript adapter contracts, the same React UI and domain logic can package for desktop POS or air-gapped self-hosted licenses.',
    highlights: [
      'Zero Cloudflare vendor lock-in in core domain services',
      'Offline signed license verification via licensing.ts contracts',
      'Same React SPA + Tailwind v4 UI compiles into Tauri WebView',
      'Commercial Self-Hosted & White Label OEM licensing supported',
    ],
    steps: [
      {
        title: '1. Inspect portable infrastructure contracts',
        command: 'cat src/core/contracts/platform.ts',
        note: 'DatabaseAdapter, ObjectStorageAdapter, QueueAdapter & AiGatewayAdapter.',
      },
      {
        title: '2. Run local production bundle without external cloud',
        command: 'docker compose up -d',
        note: 'Operates on local PostgreSQL 16 without Firebase config if unconfigured.',
      },
    ],
    envVars: [
      {
        name: 'WENDORO_LICENSE_KEY',
        scope: 'server',
        required: false,
        description: 'Signed commercial/air-gapped entitlement key (optional for OSS)',
        example: 'Provided via BakeWeb commercial licensing portal',
      },
    ],
  },
];

export const OSS_GOVERNANCE_FILES = [
  {
    file: 'LICENSE',
    purpose: 'Apache-2.0 open-source license protecting BakeWeb core & community contributions',
  },
  {
    file: 'CONTRIBUTING.md',
    purpose: 'Architecture boundaries, PostgreSQL RLS rules, and PR verification checklist',
  },
  {
    file: 'SECURITY.md',
    purpose: 'Responsible vulnerability disclosure and public-repo secret hygiene policy',
  },
  {
    file: 'drizzle.config.ts',
    purpose: 'Drizzle Kit schema/migration configuration targeting src/db/schema/index.ts',
  },
  {
    file: 'firebase-applet-config.example.json',
    purpose: 'Template for self-hosters configuring Firebase Auth & Firestore without leaking keys',
  },
];
